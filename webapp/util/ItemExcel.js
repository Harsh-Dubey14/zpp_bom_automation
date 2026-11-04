sap.ui.define([
  "sap/m/MessageBox",
  "sap/ui/core/BusyIndicator",
  "sap/ui/model/json/JSONModel",
  "zppbomautomation/model/ItemModel",
  "zppbomautomation/service/ItemScreenService"
], function (MessageBox, BusyIndicator, JSONModel, ItemModel, ItemScreenService) {
  "use strict";
  return {
      _ensureXlsxLibrary: function () {
        if (window.XLSX) {
          return Promise.resolve(window.XLSX);
        }

        return Promise.reject(
          new Error("Excel processing library could not be loaded.")
        );
      },

      onDownloadExcelTemplate: async function () {
        try {
          var XLSX = await this._ensureXlsxLibrary();
          var oWorkbook = XLSX.utils.book_new();
          var oWorksheet = XLSX.utils.aoa_to_sheet([
            ["Component", "Quantity", "Sort String", "Remarks"],
            ["47", 1, "DNEROS2XL", "Sample remarks"]
          ]);

          oWorksheet["!cols"] = [
            { wch: 40 },
            { wch: 12 },
            { wch: 14 },
            { wch: 40 }
          ];
          XLSX.utils.book_append_sheet(oWorkbook, oWorksheet, "BOM Items");
          XLSX.writeFile(oWorkbook, "BOM_Item_Upload_Template.xlsx");
        } catch (oError) {
          MessageBox.error(this._getErrorText(oError));
        }
      },

      onUploadExcelTemplate: function () {
        this.byId("bomExcelUploadDialog").open();
      },

      onCloseExcelUploadDialog: function () {
        this.byId("bomExcelUploadDialog").close();
      },

      onExcelFileSelected: function (oEvent) {
        var oUploader = oEvent.getSource();
        var aFiles = oEvent.getParameter("files") || [];

        if (aFiles[0]) {
          this.byId("bomExcelUploadDialog").close();
          this._processBomExcelFile(aFiles[0]);
        }

        oUploader.clear();
      },

      _processBomExcelFile: async function (oFile) {
        BusyIndicator.show(0);

        try {
          var XLSX = await this._ensureXlsxLibrary();
          var aBuffer = await oFile.arrayBuffer();
          var oWorkbook = XLSX.read(aBuffer, { type: "array" });
          var oSheet = oWorkbook.Sheets[oWorkbook.SheetNames[0]];
          var aRawRows = XLSX.utils.sheet_to_json(oSheet, { defval: "" });
          var aRows = this._normalizeExcelBomRows(aRawRows);

          if (!aRows.length) {
            throw new Error("The Excel file contains no BOM item rows.");
          }

          var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
          var sPlant = oHeaderModel ? oHeaderModel.getProperty("/Plant") : "";

          if (!sPlant) {
            throw new Error("Plant is missing. Please complete the BOM header first.");
          }

          var aComponentChecks = await Promise.all(
            aRows.map(function (oRow) {
              return ItemScreenService.checkComponentPlantExtension(
                this.getOwnerComponent().getModel(),
                this._toBackendMaterial(oRow.component),
                sPlant
              );
            }.bind(this))
          );
          var oComponentModel = new JSONModel({
            items: aComponentChecks.filter(function (oResult) {
              return oResult.valid;
            })
          });
          var mValidSortStrings = {};

          if (aRows.some(function (oRow) { return Boolean(oRow.sortString); })) {
            var sHeaderMaterial = this._toBackendMaterial(
              oHeaderModel.getProperty("/Material") || ""
            );
            var oSortStringModel = await ItemScreenService.loadSortStringVHData(
              this,
              sHeaderMaterial
            );

            (oSortStringModel.getProperty("/items") || []).forEach(function (oItem) {
              var sValue = String(
                oItem.Zcomb ||
                oItem.zcomb ||
                oItem.sortString ||
                oItem.SortString ||
                oItem.BOMItemSorter ||
                oItem.BomItemSorter ||
                ""
              ).trim().toUpperCase();

              if (sValue) {
                mValidSortStrings[sValue] = true;
              }
            });
          }

          var aInvalidRows = [];
          var aValidatedRows = [];

          aRows.forEach(function (oRow, iIndex) {
            var oMatch = this._findComponentInValueHelp(oRow.component, oComponentModel);

            if (!oMatch) {
              aInvalidRows.push("Row " + (iIndex + 2) + ": " + oRow.component);
              return;
            }

            if (!oRow.quantity || !ItemScreenService.isValidQuantityDecimal(oRow.quantity) || Number(oRow.quantity) <= 0) {
              aInvalidRows.push("Row " + (iIndex + 2) + ": invalid quantity");
              return;
            }

            if (oRow.sortString && !mValidSortStrings[oRow.sortString]) {
              aInvalidRows.push(
                "Row " + (iIndex + 2) + ": invalid Sort String " + oRow.sortString
              );
              return;
            }

            aValidatedRows.push({
              component: this._toBackendMaterial(this._getComponentValue(oMatch)),
              description: ItemScreenService.getComponentDescription(oMatch),
              quantity: oRow.quantity,
              uom: ItemScreenService.getComponentUom(oMatch),
              sortString: oRow.sortString.substring(0, 10),
              remarks: oRow.remarks.substring(0, 40)
            });
          }, this);

          if (aInvalidRows.length) {
            throw new Error(
              "Upload stopped. Correct these rows and upload again:\n" +
              aInvalidRows.slice(0, 20).join("\n") +
              (aInvalidRows.length > 20 ? "\n...and " + (aInvalidRows.length - 20) + " more." : "")
            );
          }

          this._appendExcelBomRows(aValidatedRows);
          MessageBox.success(aValidatedRows.length + " BOM item(s) validated and added.");
        } catch (oError) {
          MessageBox.error(this._getErrorText(oError));
        } finally {
          BusyIndicator.hide();
        }
      },

      _normalizeExcelBomRows: function (aRawRows) {
        return (aRawRows || []).map(function (oRawRow) {
          var mRow = {};
          Object.keys(oRawRow).forEach(function (sKey) {
            mRow[String(sKey).toLowerCase().replace(/[^a-z]/g, "")] = oRawRow[sKey];
          });

          return {
            component: String(mRow.component || "").trim().substring(0, 40),
            quantity: ItemScreenService.sanitizeQuantity(mRow.quantity),
            sortString: String(mRow.sortstring || "").trim().toUpperCase(),
            remarks: String(mRow.remarks || "").trim()
          };
        }).filter(function (oRow) {
          return oRow.component;
        });
      },

      _appendExcelBomRows: function (aNewRows) {
        var oItemModel = this.getOwnerComponent().getModel("itemModel");
        var aItems = (oItemModel.getProperty("/items") || []).filter(function (oItem) {
          return oItem.billOfMaterialItemNodeNumber || oItem.originalItemNumber ||
            oItem.component || oItem.quantity || oItem.sortString || oItem.remarks;
        });

        aNewRows.forEach(function (oRow) {
          var sNext = this._getNextFrontendItemNumber ?
            this._getNextFrontendItemNumber(aItems) : ItemModel.getNextItemNumber(aItems);
          var oItem = ItemModel.createBlankItem(sNext);
          aItems.push(oItem);
          if (this._markLastAddedRowAsNew) {
            oItemModel.setProperty("/items", aItems);
            this._markLastAddedRowAsNew(oItemModel, sNext);
          }
          Object.assign(oItem, oRow);
        }, this);

        ItemModel.setItems(oItemModel, aItems);
      },

      onDownloadDump: async function () {
        try {
          var XLSX = await this._ensureXlsxLibrary();
          var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
          var oItemModel = this.getOwnerComponent().getModel("itemModel");
          var oHeader = oHeaderModel ? oHeaderModel.getData() : {};
          var aItems = oItemModel ? oItemModel.getProperty("/items") || [] : [];
          var aRows = aItems.map(function (oItem) {
            return {
              "Item": oItem.item || "",
              "Component": oItem.component || "",
              "Description": oItem.description || "",
              "Quantity": oItem.quantity === undefined ? "" : oItem.quantity,
              "UoM": oItem.uom || "",
              "Sort String": oItem.sortString || "",
              "Remarks": oItem.remarks || "",
              "Status": oItem.rowStatus || "",
              "Change Mode": oItem.changeMode || ""
            };
          });
          var oWorkbook = XLSX.utils.book_new();
          var oSheet = XLSX.utils.json_to_sheet(aRows, {
            header: ["Item", "Component", "Description", "Quantity", "UoM", "Sort String", "Remarks", "Status", "Change Mode"]
          });
          oSheet["!cols"] = [8, 40, 45, 14, 10, 16, 42, 16, 14].map(function (n) { return { wch: n }; });
          XLSX.utils.book_append_sheet(oWorkbook, oSheet, "BOM Items");
          XLSX.utils.book_append_sheet(oWorkbook, XLSX.utils.json_to_sheet([oHeader]), "BOM Header");
          var aDeletes = oItemModel ? oItemModel.getProperty("/pendingDeletes") || [] : [];
          if (aDeletes.length) {
            XLSX.utils.book_append_sheet(oWorkbook, XLSX.utils.json_to_sheet(aDeletes), "Pending Deletions");
          }
          XLSX.writeFile(oWorkbook, oHeader.IsChangeMode ? "BOM_Change_Dump.xlsx" : "BOM_Create_Dump.xlsx");
        } catch (oError) {
          MessageBox.error(this._getErrorText(oError));
        }
      }
  };
});
