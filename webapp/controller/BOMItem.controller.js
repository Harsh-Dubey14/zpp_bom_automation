/* eslint-disable max-params */
/* global jQuery, Promise */

sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/export/Spreadsheet",
    "sap/ui/model/json/JSONModel",
    "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
    "sap/ui/comp/filterbar/FilterBar",
    "sap/ui/comp/filterbar/FilterGroupItem",
    "sap/m/Input",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/BusyIndicator"
  ],
  function (
    Controller,
    History,
    MessageToast,
    MessageBox,
    Spreadsheet,
    JSONModel,
    ValueHelpDialog,
    FilterBar,
    FilterGroupItem,
    Input,
    Filter,
    FilterOperator,
    BusyIndicator
  ) {
    "use strict";

    return Controller.extend("zppbomautomation.controller.BOMItem", {
      onInit: function () {
        this._initSharedItemModel();

        var oResultModel = new JSONModel({
          BomId: "",
          Status: "",
          StatusState: "None",
          Message: "",
          MessageType: "Information",
          ShowMessage: false,
          BillOfMaterial: "",
          CreatedBomVariant: "",
          CanSave: true,
          CanRetry: false,
          Editable: true
        });

        this.getView().setModel(oResultModel, "resultModel");

        var oRouter = this.getOwnerComponent().getRouter();

        oRouter
          .getRoute("RouteBOMItem")
          .attachPatternMatched(this._onRouteMatched, this);
      },

      _initSharedItemModel: function () {
        var oItemModel = this.getOwnerComponent().getModel("itemModel");

        if (!oItemModel) {
          oItemModel = new JSONModel({
            items: []
          });

          this.getOwnerComponent().setModel(oItemModel, "itemModel");
        }

        this.getView().setModel(oItemModel, "itemModel");
      },

      _onRouteMatched: async function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          this.getOwnerComponent().getRouter().navTo("RouteView1", {}, true);
          return;
        }

        this.getView().setModel(oHeaderModel, "headerModel");
        this._initSharedItemModel();
        this._resetResultModel();

        var oItemModel = this.getOwnerComponent().getModel("itemModel");
        var aItems = oItemModel.getProperty("/items") || [];

        if (aItems.length === 0) {
          this.onAddRow();
          return;
        }

        await this._fillCopiedAlternateBomDetails();
      },

      _resetResultModel: function () {
        var oResultModel = this.getView().getModel("resultModel");

        oResultModel.setData({
          BomId: "",
          Status: "",
          StatusState: "None",
          Message: "",
          MessageType: "Information",
          ShowMessage: false,
          BillOfMaterial: "",
          CreatedBomVariant: "",
          CanSave: true,
          CanRetry: false,
          Editable: true
        });
      },

  onNavBack: function () {
  var oResultModel = this.getView().getModel("resultModel");
  var sStatus = oResultModel ? oResultModel.getProperty("/Status") : "";

  if (sStatus === "SUCCESS") {
    this._clearBomDraftData();

    this.getOwnerComponent().getRouter().navTo(
      "RouteView1",
      {
        "?query": {}
      },
      true
    );

    return;
  }

  var sPreviousHash = History.getInstance().getPreviousHash();

  if (sPreviousHash !== undefined) {
    window.history.go(-1);
  } else {
    this.getOwnerComponent().getRouter().navTo("RouteView1", {}, true);
  }
},

      onAddRow: function () {
        var oModel = this.getOwnerComponent().getModel("itemModel");

        if (!oModel) {
          this._initSharedItemModel();
          oModel = this.getOwnerComponent().getModel("itemModel");
        }

        var aItems = oModel.getProperty("/items") || [];

        var iNextItem = 1;

        if (aItems.length > 0) {
          var iLastItem = parseInt(aItems[aItems.length - 1].item, 10);

          if (!isNaN(iLastItem)) {
            iNextItem = iLastItem + 1;
          }
        }

        aItems.push({
          item: String(iNextItem).padStart(2, "0"),
          component: "",
          description: "",
          quantity: "",
          uom: "",
          sortString: "",
          category: "L"
        });

        oModel.setProperty("/items", aItems);
      },

      onDelete: function () {
        var oTable = this.byId("bomItemsTable");
        var oModel = this.getOwnerComponent().getModel("itemModel");
        var aItems = oModel.getProperty("/items") || [];
        var aSelectedItems = oTable.getSelectedItems();

        if (aSelectedItems.length === 0) {
          MessageToast.show("Please select items to delete");
          return;
        }

        var aIndexesToDelete = aSelectedItems.map(function (oItem) {
          return oTable.indexOfItem(oItem);
        });

        aIndexesToDelete.sort(function (a, b) {
          return b - a;
        });

        aIndexesToDelete.forEach(function (iIndex) {
          aItems.splice(iIndex, 1);
        });

        aItems.forEach(function (oItem, iIndex) {
          oItem.item = String(iIndex + 1).padStart(2, "0");
        });

        oModel.setProperty("/items", aItems);
        oTable.removeSelections(true);

        MessageToast.show("Selected items deleted");
      },

      onSelectAll: function () {
        var oTable = this.byId("bomItemsTable");

        oTable.selectAll();
        MessageToast.show("All items selected");
      },

      onQuantityLiveChange: function (oEvent) {
        var oInput = oEvent.getSource();
        var sValue = oInput.getValue() || "";

        sValue = sValue.replace(/[^0-9.]/g, "");

        var aParts = sValue.split(".");

        if (aParts.length > 2) {
          sValue = aParts[0] + "." + aParts.slice(1).join("");
          aParts = sValue.split(".");
        }

        if (aParts.length === 2) {
          aParts[1] = aParts[1].substring(0, 3);
          sValue = aParts[0] + "." + aParts[1];
        }

        oInput.setValue(sValue);
      },

      onQuantityChange: function (oEvent) {
        var oInput = oEvent.getSource();
        var sValue = oInput.getValue() || "";

        if (!sValue) {
          return;
        }

        if (!this._isValidQuantityDecimal(sValue)) {
          oInput.setValueState("Error");
          oInput.setValueStateText(
            "Quantity can have maximum 3 digits after decimal."
          );
          return;
        }

        oInput.setValueState("None");
        oInput.setValueStateText("");
      },

      onSave: async function () {
        var oResultModel = this.getView().getModel("resultModel");

        try {
          var oValidation = await this._validateBeforeSaveAsync();

          if (!oValidation.valid) {
            MessageBox.error(oValidation.message);
            return;
          }

          var oPayload = this._buildBomCreatePayload();

          oResultModel.setProperty("/CanSave", false);
          oResultModel.setProperty("/Message", "Creating BOM...");
          oResultModel.setProperty("/MessageType", "Information");
          oResultModel.setProperty("/ShowMessage", true);

          BusyIndicator.show(0);

          var oResponse = await this._createBom(oPayload);

          this._handleCreateResponse(oResponse);
        } catch (oError) {
          var sErrorText = this._getErrorText(oError);

          oResultModel.setProperty("/CanSave", true);
          oResultModel.setProperty("/Message", sErrorText);
          oResultModel.setProperty("/MessageType", "Error");
          oResultModel.setProperty("/ShowMessage", true);

          MessageBox.error(sErrorText);
        } finally {
          BusyIndicator.hide();
        }
      },

      _validateBeforeSaveAsync: async function () {
        var oValidation = this._validateBeforeSave();

        if (!oValidation.valid) {
          return oValidation;
        }

        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var sPlant = oHeaderModel ? oHeaderModel.getProperty("/Plant") : "";
        var oItemModel = this.getOwnerComponent().getModel("itemModel");
        var aItems = oItemModel.getProperty("/items") || [];

        for (var i = 0; i < aItems.length; i++) {
          var oItem = aItems[i];
          var sComponent = String(oItem.component || "").trim().toUpperCase();

          var oCheckResult = await this._checkComponentPlantExtension(
            sComponent,
            sPlant
          );

          if (!oCheckResult.valid) {
            return {
              valid: false,
              message:
                "Row " +
                (i + 1) +
                ": Component " +
                sComponent +
                " is not available in Plant " +
                sPlant +
                "."
            };
          }

          oItem.component = oCheckResult.component || sComponent;
          oItem.description = oCheckResult.description || "";
          oItem.uom = oCheckResult.uom || "";
        }

        oItemModel.setProperty("/items", aItems);
        oItemModel.refresh(true);

        return {
          valid: true,
          message: ""
        };
      },

      _validateBeforeSave: function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          return {
            valid: false,
            message:
              "Header data is missing. Please go back and enter header details."
          };
        }

        var oHeader = oHeaderModel.getData();
        var oItemModel = this.getOwnerComponent().getModel("itemModel");
        var aItems = oItemModel ? oItemModel.getProperty("/items") || [] : [];

        if (!oHeader.Material) {
          return {
            valid: false,
            message: "Material is required."
          };
        }

        if (!oHeader.Plant) {
          return {
            valid: false,
            message: "Plant is required."
          };
        }

        if (!oHeader.BomUsage) {
          return {
            valid: false,
            message: "BOM Usage is required."
          };
        }

        if (!oHeader.AltBom) {
          return {
            valid: false,
            message: "Alternative BOM is required."
          };
        }

        if (!oHeader.BaseQty || Number(oHeader.BaseQty) <= 0) {
          return {
            valid: false,
            message: "Base Quantity must be greater than zero."
          };
        }

        if (!oHeader.ValidFrom) {
          return {
            valid: false,
            message: "Valid From date is required."
          };
        }

        if (!aItems.length) {
          return {
            valid: false,
            message: "Please add at least one BOM item."
          };
        }

        for (var i = 0; i < aItems.length; i++) {
          var oItem = aItems[i];
          var sPrefix = "Row " + (i + 1) + ": ";

          if (!oItem.component) {
            return {
              valid: false,
              message: sPrefix + "Component is required."
            };
          }

          if (!oItem.quantity || Number(oItem.quantity) <= 0) {
            return {
              valid: false,
              message: sPrefix + "Quantity must be greater than zero."
            };
          }

          if (!this._isValidQuantityDecimal(oItem.quantity)) {
            return {
              valid: false,
              message:
                sPrefix + "Quantity can have maximum 3 digits after decimal."
            };
          }
        }

        return {
          valid: true,
          message: ""
        };
      },

      _isValidQuantityDecimal: function (vQuantity) {
        var sQuantity = String(vQuantity || "");

        return /^\d+(\.\d{1,3})?$/.test(sQuantity);
      },

      _buildBomCreatePayload: function () {
        var oHeader = this.getOwnerComponent()
          .getModel("headerModel")
          .getData();

        var oItemModel = this.getOwnerComponent().getModel("itemModel");
        var aItems = oItemModel ? oItemModel.getProperty("/items") || [] : [];

        return {
          Material: oHeader.Material,
          Plant: oHeader.Plant,
          BomUsage: oHeader.BomUsage || "1",
          AltBom: oHeader.AltBom,
          BaseQty: Number(oHeader.BaseQty || 1),
          ValidFrom: oHeader.ValidFrom,
          _Item: aItems.map(
            function (oItem, iIndex) {
              return {
                ItemNo: this._formatItemNo(oItem.item || iIndex + 1),
                ItemCategory: oItem.category || "L",
                Component: oItem.component,
                Quantity: Number(oItem.quantity),
                Uom: oItem.uom
              };
            }.bind(this)
          )
        };
      },

      _createBom: async function (oPayload) {
        return await this._postAction("/BomCreate", oPayload);
      },

      _handleCreateResponse: function (oResponse) {
        var oResultModel = this.getView().getModel("resultModel");

        var sStatus = oResponse.Status || "";
        var sMessage = oResponse.Message || "";
        var sBomId = oResponse.BomId || "";
        var sBillOfMaterial = this._extractBillOfMaterial(
          oResponse.ApiResponse
        );

        oResultModel.setProperty("/BomId", sBomId);
        oResultModel.setProperty("/Status", sStatus);
        oResultModel.setProperty("/Message", sMessage);
        oResultModel.setProperty("/ShowMessage", true);
        oResultModel.setProperty("/BillOfMaterial", sBillOfMaterial);

        if (sStatus === "SUCCESS") {
          oResultModel.setProperty("/StatusState", "Success");
          oResultModel.setProperty("/MessageType", "Success");
          oResultModel.setProperty("/CanSave", false);
          oResultModel.setProperty("/CanRetry", false);
          oResultModel.setProperty("/Editable", false);

          var sSuccessMessage = sBillOfMaterial
            ? "BOM created successfully. BOM Number: " + sBillOfMaterial
            : sMessage || "BOM created successfully.";

          MessageBox.success(sSuccessMessage);
          return;
        }

        if (sStatus === "ERROR") {
          oResultModel.setProperty("/StatusState", "Error");
          oResultModel.setProperty("/MessageType", "Error");
          oResultModel.setProperty("/CanSave", true);
          oResultModel.setProperty("/CanRetry", !!sBomId);
          oResultModel.setProperty("/Editable", true);

          MessageBox.error(sMessage || "BOM creation failed.");
          return;
        }

        oResultModel.setProperty("/StatusState", "Warning");
        oResultModel.setProperty("/MessageType", "Warning");
        oResultModel.setProperty("/CanSave", true);
        oResultModel.setProperty("/CanRetry", !!sBomId);
        oResultModel.setProperty("/Editable", true);

        MessageBox.warning(
          sMessage || "BOM request saved, but final status is not SUCCESS."
        );
      },

      onRetrySubmit: async function () {
        var oResultModel = this.getView().getModel("resultModel");

        try {
          var sBomId = oResultModel.getProperty("/BomId");

          if (!sBomId) {
            MessageBox.error("Cannot retry because BOM Request ID is missing.");
            return;
          }

          oResultModel.setProperty("/Message", "Retrying BOM submit...");
          oResultModel.setProperty("/MessageType", "Information");
          oResultModel.setProperty("/ShowMessage", true);

          BusyIndicator.show(0);

          var sActionPath = this._buildSubmitActionPath(sBomId);
          var oResponse = await this._postAction(sActionPath, {});

          this._handleCreateResponse(oResponse);
        } catch (oError) {
          var sErrorText = this._getErrorText(oError);

          oResultModel.setProperty("/Message", sErrorText);
          oResultModel.setProperty("/MessageType", "Error");
          oResultModel.setProperty("/ShowMessage", true);

          MessageBox.error(sErrorText);
        } finally {
          BusyIndicator.hide();
        }
      },

      _buildSubmitActionPath: function (sBomId) {
        return (
          "/BomCreate(" +
          encodeURIComponent(sBomId) +
          ")/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.SubmitBOM"
        );
      },

      onCancel: function () {
  var that = this;

  MessageBox.warning(
    "Are you sure you want to cancel? All item data will be lost.",
    {
      actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
      emphasizedAction: MessageBox.Action.OK,

      onClose: function (sAction) {
        if (sAction === MessageBox.Action.OK) {
          that._clearBomDraftData();

          that.getOwnerComponent().getRouter().navTo(
            "RouteView1",
            {
              "?query": {}
            },
            true
          );
        }
      }
    }
  );
},

      onNewBOM: function () {
  this._clearBomDraftData();

  this.getOwnerComponent().getRouter().navTo(
    "RouteView1",
    {
      "?query": {}
    },
    true
  );
},

      onExportExcel: function () {
        var oTable = this.byId("bomItemsTable");
        var aSelectedItems = oTable.getSelectedItems();

        if (aSelectedItems.length === 0) {
          MessageToast.show("Please select items to export");
          return;
        }

        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          MessageBox.error("Header data is missing.");
          return;
        }

        var oHeader = oHeaderModel.getData();

        var aExportData = aSelectedItems.map(function (oItem) {
          var oData = oItem.getBindingContext("itemModel").getObject();

          return {
            Material: oHeader.Material,
            Plant: oHeader.Plant,
            BomUsage: oHeader.BomUsage || "1",
            AltBom: oHeader.AltBom,
            item: oData.item,
            component: oData.component,
            description: oData.description,
            quantity: oData.quantity,
            uom: oData.uom,
            sortString: oData.sortString,
            category: oData.category
          };
        });

        var aCols = [
          {
            label: "Material",
            property: "Material"
          },
          {
            label: "Plant",
            property: "Plant"
          },
          {
            label: "BOM Usage",
            property: "BomUsage"
          },
          {
            label: "Alternative BOM",
            property: "AltBom"
          },
          {
            label: "Item",
            property: "item"
          },
          {
            label: "Component",
            property: "component"
          },
          {
            label: "Description",
            property: "description"
          },
          {
            label: "Quantity",
            property: "quantity"
          },
          {
            label: "UoM",
            property: "uom"
          },
          {
            label: "Sort String",
            property: "sortString"
          },
          {
            label: "Category",
            property: "category"
          }
        ];

        var oSettings = {
          workbook: {
            columns: aCols
          },
          dataSource: aExportData,
          fileName: "BOM_Items.xlsx"
        };

        var oSpreadsheet = new Spreadsheet(oSettings);

        oSpreadsheet.build().then(function () {
          MessageToast.show("Excel downloaded");
        });
      },

      onComponentChange: async function (oEvent) {
        var oInput = oEvent.getSource();
        var oContext = oInput.getBindingContext("itemModel");

        if (!oContext) {
          MessageBox.error("Could not determine selected item row.");
          return;
        }

        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var sPlant = oHeaderModel ? oHeaderModel.getProperty("/Plant") : "";
        var sComponent = (oInput.getValue() || "").trim().toUpperCase();
        var oItemModel = oContext.getModel();
        var sPath = oContext.getPath();

        if (!sComponent) {
          oItemModel.setProperty(sPath + "/component", "");
          oItemModel.setProperty(sPath + "/description", "");
          oItemModel.setProperty(sPath + "/uom", "");
          return;
        }

        oInput.setValue(sComponent);

        oItemModel.setProperty(sPath + "/component", sComponent);
        oItemModel.setProperty(sPath + "/description", "");
        oItemModel.setProperty(sPath + "/uom", "");

        if (!sPlant) {
          MessageBox.warning("Please select Plant first.");
          return;
        }

        await this._fillComponentDetails(oContext, sComponent, sPlant);
      },

      _getComponentUom: function (oData) {
        return (
          oData.uom ||
          oData.Uom ||
          oData.UOM ||
          oData.BaseUnit ||
          oData.BaseUom ||
          oData.BillOfMaterialItemUnit ||
          oData.BillOfMaterialItemUnit_Text ||
          ""
        );
      },

      _getComponentDescription: function (oData) {
        return (
          oData.ProductDescription ||
          oData.productDescription ||
          oData.Description ||
          oData.description ||
          oData.MaterialDescription ||
          ""
        );
      },

      _fillCopiedAlternateBomDetails: async function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var sPlant = oHeaderModel ? oHeaderModel.getProperty("/Plant") : "";

        var oItemModel = this.getOwnerComponent().getModel("itemModel");
        var aItems = oItemModel ? oItemModel.getProperty("/items") || [] : [];

        if (!sPlant || !aItems.length) {
          return;
        }

        for (var i = 0; i < aItems.length; i++) {
          var oItem = aItems[i];
          var sComponent = String(oItem.component || "").trim().toUpperCase();

          if (!sComponent) {
            continue;
          }

          oItem.component = sComponent;

          if (oItem.description && oItem.uom) {
            continue;
          }

          oItem.description = "";
          oItem.uom = "";

          var oResult = await this._checkComponentPlantExtension(
            sComponent,
            sPlant
          );

          if (oResult.valid) {
            oItem.component = oResult.component || sComponent;
            oItem.description = oResult.description || "";
            oItem.uom = oResult.uom || "";
          }
        }

        oItemModel.setProperty("/items", aItems);
        oItemModel.refresh(true);
      },

      _fillComponentDetails: function (oContext, sComponent, sPlant) {
        var that = this;
        var oODataModel = this.getOwnerComponent().getModel();
        var oItemModel = oContext.getModel();
        var sPath = oContext.getPath();

        oItemModel.setProperty(sPath + "/component", sComponent);
        oItemModel.setProperty(sPath + "/description", "");
        oItemModel.setProperty(sPath + "/uom", "");

        return new Promise(function (resolve) {
          var oListBinding = oODataModel.bindList(
            "/plant_component_vh",
            undefined,
            undefined,
            [
              new Filter("Plant", FilterOperator.EQ, sPlant),
              new Filter("component", FilterOperator.EQ, sComponent)
            ],
            {
              $select: "component,ProductDescription,uom"
            }
          );

          oListBinding
            .requestContexts(0, 1)
            .then(function (aContexts) {
              if (!aContexts.length) {
                oItemModel.setProperty(sPath + "/description", "");
                oItemModel.setProperty(sPath + "/uom", "");

                MessageBox.warning(
                  "Component " +
                    sComponent +
                    " is not available in Plant " +
                    sPlant +
                    "."
                );

                resolve(false);
                return;
              }

              var oData = aContexts[0].getObject();

              oItemModel.setProperty(
                sPath + "/component",
                oData.component || sComponent
              );

              oItemModel.setProperty(
                sPath + "/description",
                that._getComponentDescription(oData)
              );

              oItemModel.setProperty(sPath + "/uom", that._getComponentUom(oData));

              resolve(true);
            })
            .catch(function () {
              oItemModel.setProperty(sPath + "/description", "");
              oItemModel.setProperty(sPath + "/uom", "");

              MessageBox.error("Could not validate component against plant.");
              resolve(false);
            });
        });
      },

      _checkComponentPlantExtension: function (sComponent, sPlant) {
        var that = this;
        var oODataModel = this.getOwnerComponent().getModel();

        return new Promise(function (resolve) {
          var oListBinding = oODataModel.bindList(
            "/plant_component_vh",
            undefined,
            undefined,
            [
              new Filter("Plant", FilterOperator.EQ, sPlant),
              new Filter("component", FilterOperator.EQ, sComponent)
            ],
            {
              $select: "component,ProductDescription,uom"
            }
          );

          oListBinding
            .requestContexts(0, 1)
            .then(function (aContexts) {
              if (!aContexts.length) {
                resolve({
                  valid: false,
                  component: "",
                  description: "",
                  uom: ""
                });

                return;
              }

              var oData = aContexts[0].getObject();

              resolve({
                valid: true,
                component: oData.component || sComponent,
                description: that._getComponentDescription(oData),
                uom: that._getComponentUom(oData)
              });
            })
            .catch(function () {
              resolve({
                valid: false,
                component: "",
                description: "",
                uom: ""
              });
            });
        });
      },

      onComponentValueHelp: function (oEvent) {
        var oInput = oEvent.getSource();

        this._oCurrentComponentContext = oInput.getBindingContext("itemModel");

        if (!this._oCurrentComponentContext) {
          MessageBox.error("Could not determine selected item row.");
          return;
        }

        this._openComponentValueHelp();
      },

      _loadComponentVHData: function () {
        var that = this;
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var sPlant = oHeaderModel ? oHeaderModel.getProperty("/Plant") : "";

        if (!sPlant) {
          MessageBox.warning("Please select Plant first.");

          return Promise.reject({
            message: "Plant is missing."
          });
        }

        if (this._oComponentVHModel && this._sComponentVHPlant === sPlant) {
          return Promise.resolve(this._oComponentVHModel);
        }

        return new Promise(function (resolve, reject) {
          var oODataModel = that.getOwnerComponent().getModel();

          var oListBinding = oODataModel.bindList(
            "/plant_component_vh",
            null,
            null,
            [new Filter("Plant", FilterOperator.EQ, sPlant)],
            {
              $select: "component,ProductDescription,uom"
            }
          );

          oListBinding
            .requestContexts(0, 5000)
            .then(function (aContexts) {
              var aResults = aContexts.map(function (oContext) {
                return oContext.getObject();
              });

              that._sComponentVHPlant = sPlant;
              that._oComponentVHModel = new JSONModel({
                items: aResults
              });

              resolve(that._oComponentVHModel);
            })
            .catch(function (oError) {
              reject(oError);
            });
        });
      },

      _openComponentValueHelp: function () {
        var that = this;

        this._loadComponentVHData()
          .then(function (oLocalModel) {
            if (!that._oComponentVHD) {
              var oComponentInput;
              var oDescriptionInput;
              var oFilterBar;

              var fnDoSearch = function () {
                var aFilters = [];

                var sComponent = (
                  oComponentInput.getValue() || ""
                ).toUpperCase();

                var sDescription = oDescriptionInput.getValue();

                if (sComponent) {
                  aFilters.push(
                    new Filter(
                      "component",
                      FilterOperator.Contains,
                      sComponent
                    )
                  );
                }

                if (sDescription) {
                  aFilters.push(
                    new Filter(
                      "ProductDescription",
                      FilterOperator.Contains,
                      sDescription
                    )
                  );
                }

                var oBinding = that._oComponentTable.getBinding("items");

                if (oBinding) {
                  oBinding.filter(aFilters);
                }
              };

              oComponentInput = new Input({
                liveChange: function (oEvent) {
                  var sValue = oEvent.getSource().getValue();

                  oEvent.getSource().setValue(sValue.toUpperCase());
                },
                submit: fnDoSearch
              });

              oDescriptionInput = new Input({
                submit: fnDoSearch
              });

              oFilterBar = new FilterBar({
                showFilterConfiguration: false,
                showGoOnFB: true,
                filterBarExpanded: true,
                useToolbar: true,
                search: fnDoSearch,
                filterGroupItems: [
                  new FilterGroupItem({
                    groupName: "basic",
                    name: "component",
                    label: "Component",
                    visibleInFilterBar: true,
                    control: oComponentInput
                  }),
                  new FilterGroupItem({
                    groupName: "basic",
                    name: "ProductDescription",
                    label: "Description",
                    visibleInFilterBar: true,
                    control: oDescriptionInput
                  })
                ]
              });

              that._oComponentInput = oComponentInput;
              that._oComponentDescriptionInput = oDescriptionInput;

              that._oComponentTable = new sap.m.Table({
                growing: true,
                growingThreshold: 100,
                mode: "SingleSelectLeft",
                includeItemInSelection: true,
                columns: [
                  new sap.m.Column({
                    header: new sap.m.Label({
                      text: "Component"
                    })
                  }),
                  new sap.m.Column({
                    header: new sap.m.Label({
                      text: "Description"
                    })
                  }),
                  new sap.m.Column({
                    header: new sap.m.Label({
                      text: "UOM"
                    })
                  })
                ]
              });

              that._oComponentTable.bindItems({
                path: "componentVH>/items",
                template: new sap.m.ColumnListItem({
                  type: "Active",
                  cells: [
                    new sap.m.Text({
                      text: "{componentVH>component}"
                    }),
                    new sap.m.Text({
                      text: "{componentVH>ProductDescription}"
                    }),
                    new sap.m.Text({
                      text: "{componentVH>uom}"
                    })
                  ]
                })
              });

              that._oComponentTable.attachItemPress(function (oEvent) {
                var oItem = oEvent.getParameter("listItem");

                if (oItem) {
                  that._oComponentTable.setSelectedItem(oItem, true);
                }
              });

              that._oComponentVHD = new ValueHelpDialog({
                title: "Select Component",
                supportMultiselect: false,
                supportRanges: false,
                filterBar: oFilterBar,
                stretch: false,
                contentWidth: "70%",
                contentHeight: "60%",

                ok: function () {
                  var oSelectedItem = that._oComponentTable.getSelectedItem();

                  if (!oSelectedItem) {
                    MessageBox.error("Please select one component.");
                    return;
                  }

                  var oData = oSelectedItem
                    .getBindingContext("componentVH")
                    .getObject();

                  var oContext = that._oCurrentComponentContext;

                  if (!oContext) {
                    MessageBox.error("Could not determine selected item row.");
                    return;
                  }

                  var oItemModel = oContext.getModel();
                  var sPath = oContext.getPath();

                  oItemModel.setProperty(
                    sPath + "/component",
                    oData.component || ""
                  );

                  oItemModel.setProperty(
                    sPath + "/description",
                    that._getComponentDescription(oData)
                  );

                  oItemModel.setProperty(
                    sPath + "/uom",
                    that._getComponentUom(oData)
                  );

                  that._clearComponentValueHelpSearch();
                  that._oComponentVHD.close();
                },

                cancel: function () {
                  that._clearComponentValueHelpSearch();
                  that._oComponentVHD.close();
                }
              });

              that._oComponentTable.setModel(oLocalModel, "componentVH");
              that._oComponentVHD.setTable(that._oComponentTable);
            } else {
              that._oComponentTable.setModel(oLocalModel, "componentVH");
            }

            that._clearComponentValueHelpSearch();
            that._oComponentVHD.open();
          })
          .catch(function (oError) {
            MessageBox.error(that._getErrorText(oError));
          });
      },

      _clearComponentValueHelpSearch: function () {
        if (this._oComponentInput) {
          this._oComponentInput.setValue("");
        }

        if (this._oComponentDescriptionInput) {
          this._oComponentDescriptionInput.setValue("");
        }

        if (this._oComponentTable) {
          this._oComponentTable.removeSelections(true);

          var oBinding = this._oComponentTable.getBinding("items");

          if (oBinding) {
            oBinding.filter([]);
          }
        }
      },

      _formatItemNo: function (vItem) {
        var iItem = parseInt(vItem, 10);

        if (isNaN(iItem)) {
          iItem = 1;
        }

        return String(iItem).padStart(2, "0");
      },

      _extractBillOfMaterial: function (sApiResponse) {
        if (!sApiResponse) {
          return "";
        }

        try {
          var oApiResponse =
            typeof sApiResponse === "string"
              ? JSON.parse(sApiResponse)
              : sApiResponse;

          if (oApiResponse.BillOfMaterial) {
            return oApiResponse.BillOfMaterial;
          }

          if (oApiResponse.d && oApiResponse.d.BillOfMaterial) {
            return oApiResponse.d.BillOfMaterial;
          }

          return "";
        } catch (oParseError) {
          void oParseError;

          var aMatch = String(sApiResponse).match(
            /"BillOfMaterial"\s*:\s*"([^"]+)"/
          );

          return aMatch ? aMatch[1] : "";
        }
      },
_clearBomDraftData: function () {
  var sToday = new Date().toISOString().slice(0, 10);

  var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

  if (oHeaderModel) {
    oHeaderModel.setData({
      Material: "",
      Plant: "",
      BomUsage: "1",
      AltBom: "",
      BaseQty: 1,
      ValidFrom: sToday,
      BaseUom: "",

      CopyMaterial: "",
      CopyPlant: "",
      CopyAltBom: "",

      IsValidated: false,
      Message: "",
      MessageType: "Information",
      ShowMessage: false
    });
  }

  var oItemModel = this.getOwnerComponent().getModel("itemModel");

  if (oItemModel) {
    oItemModel.setData({
      items: []
    });
  }

  this._resetResultModel();
},
      _postAction: function (sRelativePath, oPayload) {
        var oModel = this.getOwnerComponent().getModel();
        var sServiceUrl = oModel.getServiceUrl().replace(/\/$/, "");
        var sUrl = sServiceUrl + sRelativePath;

        return jQuery
          .ajax({
            url: sServiceUrl + "/",
            method: "GET",
            headers: {
              "X-CSRF-Token": "Fetch",
              Accept: "application/json"
            }
          })
          .then(function (data, textStatus, jqXHR) {
            var sToken = jqXHR.getResponseHeader("X-CSRF-Token");

            if (!sToken) {
              return jQuery
                .Deferred()
                .reject({
                  responseText:
                    "CSRF token could not be fetched from service root."
                })
                .promise();
            }

            return jQuery.ajax({
              url: sUrl,
              method: "POST",
              contentType: "application/json",
              headers: {
                Accept: "application/json",
                "X-CSRF-Token": sToken
              },
              data: JSON.stringify(oPayload || {})
            });
          });
      },

      _getErrorText: function (oError) {
        try {
          if (oError.responseJSON && oError.responseJSON.error) {
            var vMessage = oError.responseJSON.error.message;

            if (typeof vMessage === "string") {
              return vMessage;
            }

            if (vMessage && vMessage.value) {
              return vMessage.value;
            }

            return JSON.stringify(oError.responseJSON.error);
          }

          if (oError.responseText) {
            var oParsed = JSON.parse(oError.responseText);

            if (oParsed.error) {
              if (typeof oParsed.error.message === "string") {
                return oParsed.error.message;
              }

              if (oParsed.error.message && oParsed.error.message.value) {
                return oParsed.error.message.value;
              }
            }

            return oError.responseText;
          }

          return oError.message || "Unexpected error occurred.";
        } catch (oParseError) {
          void oParseError;

          return (
            oError.responseText ||
            oError.message ||
            "Unexpected error occurred."
          );
        }
      }
    });
  }
);