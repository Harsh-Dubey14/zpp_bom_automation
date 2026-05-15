/* global jQuery, Promise */

sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
    "sap/ui/comp/filterbar/FilterBar",
    "sap/ui/comp/filterbar/FilterGroupItem",
    "sap/m/Input",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
  ],
  function (
    Controller,
    MessageToast,
    MessageBox,
    ValueHelpDialog,
    FilterBar,
    FilterGroupItem,
    Input,
    Filter,
    FilterOperator,
    JSONModel
  ) {
    "use strict";

    return Controller.extend("zppbomautomation.controller.View1", {
      onInit: function () {
        this._initHeaderModel();
        this._initItemModel();

        var oRouter = this.getOwnerComponent().getRouter();

        oRouter
          .getRoute("RouteView1")
          .attachPatternMatched(this._onRouteMatched, this);
      },

      _onRouteMatched: function (oEvent) {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          this._initHeaderModel();
          oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        }

        this._initItemModel();

        var oArguments = oEvent.getParameter("arguments") || {};
        var oQuery = oArguments["?query"];

        if (oQuery && Object.keys(oQuery).length > 0) {
          var sToday = new Date().toISOString().slice(0, 10);

          var oHeaderData = {
            Material: oQuery.Material || "",
            Plant: oQuery.Plant || "",
            BomUsage: "1",
            AltBom: oQuery.AltBom || "",
            BaseQty: oQuery.BaseQty ? Number(oQuery.BaseQty) : 1,
            ValidFrom: oQuery.ValidFrom || sToday,
            BaseUom: oQuery.BaseUom || "",

            CopyMaterial: oQuery.CopyMaterial || "",
            CopyPlant: oQuery.CopyPlant || "",
            CopyAltBom: oQuery.CopyAltBom || "",

            IsValidated: oQuery.IsValidated === "true",
            Message: oQuery.Message || "",
            MessageType: oQuery.MessageType || "Information",
            ShowMessage: oQuery.ShowMessage === "true"
          };

          oHeaderModel.setData(oHeaderData);
        } else {
          this._resetHeaderAndItemDraftData(oHeaderModel);
        }

        this.getView().setModel(oHeaderModel, "headerModel");
        this.getView().setModel(
          this.getOwnerComponent().getModel("itemModel"),
          "itemModel"
        );
      },

      _resetHeaderAndItemDraftData: function (oHeaderModel) {
        var sToday = new Date().toISOString().slice(0, 10);

        if (!oHeaderModel) {
          oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        }

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
      },

      _initHeaderModel: function () {
        var oExistingModel = this.getOwnerComponent().getModel("headerModel");

        if (oExistingModel) {
          oExistingModel.setProperty("/BomUsage", "1");
          this.getView().setModel(oExistingModel, "headerModel");
          return;
        }

        var sToday = new Date().toISOString().slice(0, 10);

        var oHeaderData = {
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
        };

        var oModel = new JSONModel(oHeaderData);

        this.getOwnerComponent().setModel(oModel, "headerModel");
        this.getView().setModel(oModel, "headerModel");
      },

      _initItemModel: function () {
        var oExistingModel = this.getOwnerComponent().getModel("itemModel");

        if (oExistingModel) {
          this.getView().setModel(oExistingModel, "itemModel");
          return;
        }

        var oItemModel = new JSONModel({
          items: []
        });

        this.getOwnerComponent().setModel(oItemModel, "itemModel");
        this.getView().setModel(oItemModel, "itemModel");
      },

      _syncHeaderToRoute: function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          return;
        }

        oHeaderModel.setProperty("/BomUsage", "1");

        var oHeader = oHeaderModel.getData();

        this.getOwnerComponent()
          .getRouter()
          .navTo(
            "RouteView1",
            {
              "?query": {
                Material: oHeader.Material || "",
                Plant: oHeader.Plant || "",
                BomUsage: "1",
                AltBom: oHeader.AltBom || "",
                BaseQty: String(oHeader.BaseQty || 1),
                ValidFrom: oHeader.ValidFrom || "",
                BaseUom: oHeader.BaseUom || "",

                CopyMaterial: oHeader.CopyMaterial || "",
                CopyPlant: oHeader.CopyPlant || "",
                CopyAltBom: oHeader.CopyAltBom || "",

                IsValidated: String(!!oHeader.IsValidated),
                Message: oHeader.Message || "",
                MessageType: oHeader.MessageType || "Information",
                ShowMessage: String(!!oHeader.ShowMessage)
              }
            },
            true
          );
      },

      onHeaderFieldChange: function (oEvent) {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          return;
        }

        oHeaderModel.setProperty("/BomUsage", "1");

        /*
         * Copy From fields should not reset main header validation.
         * Your XML uses onHeaderFieldChange for CopyMaterial, CopyPlant and CopyAltBom also.
         * So this check keeps the already validated main header untouched.
         */
        if (this._isCopyFromField(oEvent)) {
          this._clearCopiedItems();
          this._syncHeaderToRoute();
          return;
        }

        oHeaderModel.setProperty("/IsValidated", false);
        oHeaderModel.setProperty("/BaseUom", "");
        oHeaderModel.setProperty("/AltBom", "");
        oHeaderModel.setProperty("/Message", "");
        oHeaderModel.setProperty("/MessageType", "Information");
        oHeaderModel.setProperty("/ShowMessage", false);

        this._clearCopiedItems();
        this._syncHeaderToRoute();
      },

      _isCopyFromField: function (oEvent) {
        if (!oEvent || !oEvent.getSource) {
          return false;
        }

        var sId = oEvent.getSource().getId();

        return (
          sId.indexOf("inpCopyMaterial") !== -1 ||
          sId.indexOf("inpCopyPlant") !== -1 ||
          sId.indexOf("inpCopyAltBom") !== -1
        );
      },

      _clearCopiedItems: function () {
        var oItemModel = this.getOwnerComponent().getModel("itemModel");

        if (oItemModel) {
          oItemModel.setProperty("/items", []);
        }
      },

      onContinue: async function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          MessageBox.error("Header model is missing.");
          return;
        }

        oHeaderModel.setProperty("/BomUsage", "1");

        var oHeader = oHeaderModel.getData();

        if (!oHeader.Material || !oHeader.Plant) {
          MessageBox.error("Please fill Material and Plant.");
          return;
        }

        if (!oHeader.BaseQty || Number(oHeader.BaseQty) <= 0) {
          MessageBox.error("Base Quantity must be greater than zero.");
          return;
        }

        if (!oHeader.IsValidated) {
          MessageBox.error(
            "Please validate Material and Plant before continuing."
          );
          return;
        }

        if (!oHeader.AltBom) {
          MessageBox.error("Alternate BOM is missing. Please validate again.");
          return;
        }

        try {
          if (oHeader.CopyMaterial || oHeader.CopyPlant || oHeader.CopyAltBom) {
            if (
              !oHeader.CopyMaterial ||
              !oHeader.CopyPlant ||
              !oHeader.CopyAltBom
            ) {
              MessageBox.error(
                "Please fill Copy Material, Copy Plant and Copy Alternate BOM, or keep all Copy From fields blank."
              );
              return;
            }

            await this._loadCopyFromAlternateBomItems(false);
          }

          this._syncHeaderToRoute();

          this.getOwnerComponent().getRouter().navTo("RouteBOMItem");
        } catch (oError) {
          MessageBox.error(this._getErrorText(oError));
        }
      },

      onValidateMaterial: async function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          MessageBox.error("Header model is missing.");
          return;
        }

        oHeaderModel.setProperty("/BomUsage", "1");

        var oHeader = oHeaderModel.getData();

        if (!oHeader.Material || !oHeader.Plant) {
          MessageBox.error("Please enter Material and Plant first.");
          return;
        }

        try {
          var oMatchedMaterial = await this._resolveMaterialFromValueHelp(
            oHeader.Material
          );

          if (!oMatchedMaterial) {
            this._setInvalidMaterialMessage(
              "Material does not exist. Please enter or select a valid material."
            );

            MessageBox.error(
              "Material does not exist. Please enter or select a valid material."
            );
            return;
          }

          oHeaderModel.setProperty("/Material", oMatchedMaterial.Product);
          oHeaderModel.setProperty("/BomUsage", "1");

          oHeader.Material = oMatchedMaterial.Product;
          oHeader.BomUsage = "1";

          this._syncHeaderToRoute();

          var oValidatePayload = {
            Material: oHeader.Material,
            Plant: oHeader.Plant
          };

          var oValidateResponse = await this._postAction(
            "/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.ValidateMaterialPlant",
            oValidatePayload
          );

          if (!oValidateResponse.IsValid) {
            oHeaderModel.setProperty("/BaseUom", "");
            oHeaderModel.setProperty("/AltBom", "");
            oHeaderModel.setProperty("/IsValidated", false);
            oHeaderModel.setProperty(
              "/Message",
              oValidateResponse.Message || ""
            );
            oHeaderModel.setProperty("/MessageType", "Error");
            oHeaderModel.setProperty("/ShowMessage", true);
            oHeaderModel.setProperty("/BomUsage", "1");

            MessageBox.error(
              oValidateResponse.Message ||
                "Material and Plant validation failed."
            );

            this._syncHeaderToRoute();
            return;
          }

          oHeaderModel.setProperty(
            "/BaseUom",
            oValidateResponse.BaseUnit || ""
          );

          oHeaderModel.setProperty("/BomUsage", "1");

          var oAltBomPayload = {
            Material: oHeader.Material,
            Plant: oHeader.Plant,
            BomUsage: "1"
          };

          var oAltBomResponse = await this._postAction(
            "/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.GetNextAltBOM",
            oAltBomPayload
          );

          oHeaderModel.setProperty("/Message", oAltBomResponse.Message || "");
          oHeaderModel.setProperty("/ShowMessage", true);
          oHeaderModel.setProperty("/BomUsage", "1");

          if (oAltBomResponse.Success) {
            oHeaderModel.setProperty(
              "/AltBom",
              oAltBomResponse.NextAltBom || ""
            );
            oHeaderModel.setProperty("/IsValidated", true);
            oHeaderModel.setProperty("/MessageType", "Success");

            MessageToast.show(
              oAltBomResponse.Message ||
                "Material and Plant are valid. BOM Usage is fixed as 1."
            );
          } else {
            oHeaderModel.setProperty("/AltBom", "");
            oHeaderModel.setProperty("/IsValidated", false);
            oHeaderModel.setProperty("/MessageType", "Error");

            MessageBox.error(
              oAltBomResponse.Message ||
                "Alternate BOM could not be determined."
            );
          }

          this._syncHeaderToRoute();
        } catch (oError) {
          oHeaderModel.setProperty("/BaseUom", "");
          oHeaderModel.setProperty("/AltBom", "");
          oHeaderModel.setProperty("/IsValidated", false);
          oHeaderModel.setProperty("/Message", this._getErrorText(oError));
          oHeaderModel.setProperty("/MessageType", "Error");
          oHeaderModel.setProperty("/ShowMessage", true);
          oHeaderModel.setProperty("/BomUsage", "1");

          this._syncHeaderToRoute();

          MessageBox.error(this._getErrorText(oError));
        }
      },

      onCancel: function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        this._resetHeaderAndItemDraftData(oHeaderModel);

        this.getOwnerComponent().getRouter().navTo(
          "RouteView1",
          {
            "?query": {}
          },
          true
        );

        MessageToast.show("Form cleared");
      },

      onBomUsageValueHelp: function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (oHeaderModel) {
          oHeaderModel.setProperty("/BomUsage", "1");
          this._syncHeaderToRoute();
        }

        MessageToast.show("BOM Usage is fixed as 1 - Production.");
      },

      onLoadCopyFromBomItems: function () {
        this._loadCopyFromAlternateBomItems(true)
          .then(function (aItems) {
            MessageToast.show(
              aItems.length + " BOM item(s) copied successfully."
            );
          })
          .catch(
            function (oError) {
              MessageBox.error(this._getErrorText(oError));
            }.bind(this)
          );
      },

      _loadCopyFromAlternateBomItems: function (bShowSuccessMessage) {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var oItemModel = this.getOwnerComponent().getModel("itemModel");

        if (!oHeaderModel) {
          return Promise.reject({
            message: "Header model is missing."
          });
        }

        if (!oItemModel) {
          this._initItemModel();
          oItemModel = this.getOwnerComponent().getModel("itemModel");
        }

        var oHeader = oHeaderModel.getData();

        if (
          !oHeader.CopyMaterial ||
          !oHeader.CopyPlant ||
          !oHeader.CopyAltBom
        ) {
          return Promise.reject({
            message:
              "Please enter Copy Material, Copy Plant and Copy Alternate BOM."
          });
        }

        oHeaderModel.setProperty("/BomUsage", "1");

       
        return this._resolveMaterialFromValueHelp(oHeader.CopyMaterial)
          .then(
            function (oMatchedMaterial) {
              if (!oMatchedMaterial) {
                return Promise.reject({
                  message:
                    "Copy Material does not exist. Please enter or select a valid material."
                });
              }

              oHeaderModel.setProperty(
                "/CopyMaterial",
                oMatchedMaterial.Product
              );
              oHeaderModel.setProperty("/BomUsage", "1");

              var oPayload = {
                Material: oMatchedMaterial.Product,
                Plant: String(oHeader.CopyPlant || "").trim(),
                BomUsage: "1",
                BillOfMaterialVariant: String(oHeader.CopyAltBom || "").trim()
              };

              return this._postAction(
                "/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.GetAlternateBOMItems",
                oPayload
              );
            }.bind(this)
          )
          .then(
            function (oResponse) {
              var aItems = this._convertAlternateBomItemsToRows(oResponse);

              if (!aItems.length) {
                oItemModel.setProperty("/items", []);

                return Promise.reject({
                  message: "No BOM items found for the selected Copy From BOM."
                });
              }

              oItemModel.setProperty("/items", aItems);
              oItemModel.refresh(true);

              this._syncHeaderToRoute();

              if (bShowSuccessMessage) {
                MessageToast.show(
                  aItems.length + " BOM item(s) copied successfully."
                );
              }

              return aItems;
            }.bind(this)
          );
      },

      _convertAlternateBomItemsToRows: function (oResponse) {
        var aResponseItems = [];

        if (oResponse && Array.isArray(oResponse.value)) {
          aResponseItems = oResponse.value;
        }

        aResponseItems = aResponseItems.filter(function (oItem) {
          return oItem.Success && oItem.BillOfMaterialComponent;
        });

        aResponseItems.sort(function (a, b) {
          return (
            Number(a.BillOfMaterialItemNumber || 0) -
            Number(b.BillOfMaterialItemNumber || 0)
          );
        });

        return aResponseItems.map(
          function (oItem, iIndex) {
            return {
              item: this._formatItemNumber(iIndex + 1),
              component: this._formatComponentForDisplay(
                oItem.BillOfMaterialComponent || ""
              ),
              description: "",
              quantity: this._formatQuantityForDisplay(
                oItem.BillOfMaterialItemQuantity
              ),
              uom: oItem.BillOfMaterialItemUnit || "",
              sortString: "",
              category: "L",
              originalItemNumber: oItem.BillOfMaterialItemNumber || "",
              isCopied: true
            };
          }.bind(this)
        );
      },

      _formatItemNumber: function (iNumber) {
        return String(iNumber).padStart(2, "0");
      },

      _formatQuantityForDisplay: function (vQuantity) {
        var fQuantity = Number(vQuantity || 0);

        if (!isFinite(fQuantity)) {
          return "0.000";
        }

        return fQuantity.toFixed(3);
      },

      _formatComponentForDisplay: function (sComponent) {
        sComponent = String(sComponent || "");

        if (/^\d+$/.test(sComponent)) {
          return sComponent.replace(/^0+/, "") || "0";
        }

        return sComponent;
      },

      onMaterialValueHelp: function () {
        this._sMaterialTargetProperty = "/Material";
        this._openMaterialValueHelp();
      },

      onCopyMaterialValueHelp: function () {
        this._sMaterialTargetProperty = "/CopyMaterial";
        this._openMaterialValueHelp();
      },

      onMaterialManualChange: function (oEvent) {
        this._handleManualMaterialChange(oEvent, "/Material", true);
      },

      onCopyMaterialManualChange: function (oEvent) {
        this._handleManualMaterialChange(oEvent, "/CopyMaterial", false);
      },

      _handleManualMaterialChange: function (
        oEvent,
        sTargetProperty,
        bResetValidation
      ) {
        var that = this;
        var oInput = oEvent.getSource();
        var sValue = this._normalizeMaterialInput(oInput.getValue());
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          return;
        }

        oHeaderModel.setProperty("/BomUsage", "1");

        if (!sValue) {
          oInput.setValueState("None");
          oInput.setValueStateText("");
          oHeaderModel.setProperty(sTargetProperty, "");

          if (bResetValidation) {
            this.onHeaderFieldChange(oEvent);
          } else {
            this._clearCopiedItems();
            this._syncHeaderToRoute();
          }

          return;
        }

        this._resolveMaterialFromValueHelp(sValue)
          .then(function (oMatchedMaterial) {
            oHeaderModel.setProperty("/BomUsage", "1");

            if (!oMatchedMaterial) {
              oInput.setValueState("Warning");
              oInput.setValueStateText(
                "Material does not exist in value help."
              );

              oHeaderModel.setProperty(sTargetProperty, sValue);

              if (bResetValidation) {
                oHeaderModel.setProperty("/IsValidated", false);
                oHeaderModel.setProperty("/BaseUom", "");
                oHeaderModel.setProperty("/AltBom", "");
                oHeaderModel.setProperty(
                  "/Message",
                  "Material does not exist."
                );
                oHeaderModel.setProperty("/MessageType", "Warning");
                oHeaderModel.setProperty("/ShowMessage", true);
              }

              that._clearCopiedItems();
              that._syncHeaderToRoute();
              return;
            }

            oInput.setValueState("None");
            oInput.setValueStateText("");

            oHeaderModel.setProperty(sTargetProperty, oMatchedMaterial.Product);

            if (bResetValidation) {
              that.onHeaderFieldChange(oEvent);
            } else {
              that._clearCopiedItems();
              that._syncHeaderToRoute();
            }
          })
          .catch(function (oError) {
            MessageBox.error(that._getErrorText(oError));
          });
      },

      _normalizeMaterialInput: function (sValue) {
        return String(sValue || "").trim();
      },

      _findMaterialInLocalVH: function (sMaterial, oMaterialVHModel) {
        var sSearch = this._normalizeMaterialInput(sMaterial).toUpperCase();
        var aItems = [];

        if (!sSearch || !oMaterialVHModel) {
          return null;
        }

        aItems = oMaterialVHModel.getProperty("/items") || [];

        return (
          aItems.find(function (oItem) {
            return String(oItem.Product || "").toUpperCase() === sSearch;
          }) || null
        );
      },

      _resolveMaterialFromValueHelp: function (sMaterial) {
        var that = this;

        sMaterial = this._normalizeMaterialInput(sMaterial);

        if (!sMaterial) {
          return Promise.resolve(null);
        }

        return this._loadMaterialVHData().then(function (oMaterialVHModel) {
          return that._findMaterialInLocalVH(sMaterial, oMaterialVHModel);
        });
      },

      _setInvalidMaterialMessage: function (sMessage) {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          return;
        }

        oHeaderModel.setProperty("/BaseUom", "");
        oHeaderModel.setProperty("/AltBom", "");
        oHeaderModel.setProperty("/IsValidated", false);
        oHeaderModel.setProperty("/Message", sMessage);
        oHeaderModel.setProperty("/MessageType", "Error");
        oHeaderModel.setProperty("/ShowMessage", true);
        oHeaderModel.setProperty("/BomUsage", "1");

        this._syncHeaderToRoute();
      },

      _loadMaterialVHData: function () {
        var that = this;

        if (this._oMaterialVHModel) {
          return Promise.resolve(this._oMaterialVHModel);
        }

        return new Promise(function (resolve, reject) {
          var oODataModel = that.getOwnerComponent().getModel();

          var oListBinding = oODataModel.bindList(
            "/product_plant_vh",
            null,
            null,
            null,
            {
              $select: "Product,ProductDescription"
            }
          );

          oListBinding
            .requestContexts(0, 5000)
            .then(function (aContexts) {
              var aResults = aContexts.map(function (oContext) {
                return oContext.getObject();
              });

              var oSeen = {};
              var aUniqueResults = [];

              aResults.forEach(function (oItem) {
                var sProduct = String(oItem.Product || "");

                if (sProduct && !oSeen[sProduct]) {
                  oSeen[sProduct] = true;
                  aUniqueResults.push(oItem);
                }
              });

              that._oMaterialVHModel = new JSONModel({
                items: aUniqueResults
              });

              resolve(that._oMaterialVHModel);
            })
            .catch(function (oError) {
              reject(oError);
            });
        });
      },

      _openMaterialValueHelp: function () {
        var that = this;

        this._loadMaterialVHData()
          .then(function (oLocalModel) {
            if (!that._oMatVHD) {
              var oProductInput;
              var oDescriptionInput;
              var oFilterBar;

              var fnDoSearch = function () {
                var aFilters = [];

                var sProduct = oProductInput.getValue();
                var sDescription = oDescriptionInput.getValue();

                if (sProduct) {
                  aFilters.push(
                    new Filter("Product", FilterOperator.Contains, sProduct)
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

                var oBinding = that._oMatTable.getBinding("items");

                if (oBinding) {
                  oBinding.filter(aFilters);
                }
              };

              oProductInput = new Input({
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
                    name: "Product",
                    label: "Product",
                    visibleInFilterBar: true,
                    control: oProductInput
                  }),
                  new FilterGroupItem({
                    groupName: "basic",
                    name: "ProductDescription",
                    label: "Product Description",
                    visibleInFilterBar: true,
                    control: oDescriptionInput
                  })
                ]
              });

              that._oMatProductInput = oProductInput;
              that._oMatDescriptionInput = oDescriptionInput;

              that._oMatTable = new sap.m.Table({
                growing: true,
                growingThreshold: 100,
                mode: "SingleSelectLeft",
                includeItemInSelection: true,
                columns: [
                  new sap.m.Column({
                    header: new sap.m.Label({
                      text: "Product"
                    })
                  }),
                  new sap.m.Column({
                    header: new sap.m.Label({
                      text: "Product Description"
                    })
                  })
                ]
              });

              that._oMatTable.bindItems({
                path: "materialVH>/items",
                template: new sap.m.ColumnListItem({
                  type: "Active",
                  cells: [
                    new sap.m.Text({
                      text: "{materialVH>Product}"
                    }),
                    new sap.m.Text({
                      text: "{materialVH>ProductDescription}"
                    })
                  ]
                })
              });

              that._oMatTable.attachItemPress(function (oEvent) {
                var oItem = oEvent.getParameter("listItem");

                if (oItem) {
                  that._oMatTable.setSelectedItem(oItem, true);
                }
              });

              that._oMatVHD = new ValueHelpDialog({
                title: "Select Product",
                supportMultiselect: false,
                supportRanges: false,
                filterBar: oFilterBar,
                stretch: false,
                contentWidth: "70%",
                contentHeight: "60%",

                ok: function () {
                  var oSelectedItem = that._oMatTable.getSelectedItem();

                  if (!oSelectedItem) {
                    MessageBox.error("Please select one product.");
                    return;
                  }

                  var oData = oSelectedItem
                    .getBindingContext("materialVH")
                    .getObject();

                  var oHeaderModel = that
                    .getOwnerComponent()
                    .getModel("headerModel");

                  var sTargetProperty =
                    that._sMaterialTargetProperty || "/Material";

                  oHeaderModel.setProperty(sTargetProperty, oData.Product);
                  oHeaderModel.setProperty("/BomUsage", "1");

                  that._sMaterialTargetProperty = "/Material";

                  if (sTargetProperty === "/Material") {
                    that.onHeaderFieldChange();
                  } else {
                    that._clearCopiedItems();
                    that._syncHeaderToRoute();
                  }

                  that._clearMaterialValueHelpSearch();

                  that._oMatVHD.close();
                },

                cancel: function () {
                  that._sMaterialTargetProperty = "/Material";

                  that._clearMaterialValueHelpSearch();

                  that._oMatVHD.close();
                }
              });

              that._oMatTable.setModel(oLocalModel, "materialVH");
              that._oMatVHD.setTable(that._oMatTable);
            } else {
              that._oMatTable.setModel(oLocalModel, "materialVH");
            }

            that._clearMaterialValueHelpSearch();

            that._oMatVHD.open();
          })
          .catch(function (oError) {
            MessageBox.error(that._getErrorText(oError));
          });
      },

      _clearMaterialValueHelpSearch: function () {
        if (this._oMatProductInput) {
          this._oMatProductInput.setValue("");
        }

        if (this._oMatDescriptionInput) {
          this._oMatDescriptionInput.setValue("");
        }

        if (this._oMatTable) {
          this._oMatTable.removeSelections(true);

          var oBinding = this._oMatTable.getBinding("items");

          if (oBinding) {
            oBinding.filter([]);
          }
        }
      },

      onPlantValueHelp: function () {
        this._sPlantTargetProperty = "/Plant";
        this._openPlantValueHelp();
      },

      onCopyPlantValueHelp: function () {
        this._sPlantTargetProperty = "/CopyPlant";
        this._openPlantValueHelp();
      },

      _loadPlantVHData: function () {
        var that = this;

        if (this._oPlantVHModel) {
          return Promise.resolve(this._oPlantVHModel);
        }

        return new Promise(function (resolve, reject) {
          var oODataModel = that.getOwnerComponent().getModel();

          var oListBinding = oODataModel.bindList(
            "/plant_vh",
            null,
            null,
            null,
            {
              $select: "Plant,PlantName"
            }
          );

          oListBinding
            .requestContexts(0, 5000)
            .then(function (aContexts) {
              var aResults = aContexts.map(function (oContext) {
                return oContext.getObject();
              });

              that._oPlantVHModel = new JSONModel({
                items: aResults
              });

              resolve(that._oPlantVHModel);
            })
            .catch(function (oError) {
              reject(oError);
            });
        });
      },

      _openPlantValueHelp: function () {
        var that = this;

        this._loadPlantVHData()
          .then(function (oLocalModel) {
            if (!that._oPlantVHD) {
              var oPlantInput;
              var oPlantNameInput;
              var oFilterBar;

              var fnDoSearch = function () {
                var aFilters = [];

                var sPlant = oPlantInput.getValue();
                var sPlantName = oPlantNameInput.getValue();

                if (sPlant) {
                  aFilters.push(
                    new Filter("Plant", FilterOperator.Contains, sPlant)
                  );
                }

                if (sPlantName) {
                  aFilters.push(
                    new Filter(
                      "PlantName",
                      FilterOperator.Contains,
                      sPlantName
                    )
                  );
                }

                var oBinding = that._oPlantTable.getBinding("items");

                if (oBinding) {
                  oBinding.filter(aFilters);
                }
              };

              oPlantInput = new Input({
                submit: fnDoSearch
              });

              oPlantNameInput = new Input({
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
                    name: "Plant",
                    label: "Plant",
                    visibleInFilterBar: true,
                    control: oPlantInput
                  }),
                  new FilterGroupItem({
                    groupName: "basic",
                    name: "PlantName",
                    label: "Plant Name",
                    visibleInFilterBar: true,
                    control: oPlantNameInput
                  })
                ]
              });

              that._oPlantInput = oPlantInput;
              that._oPlantNameInput = oPlantNameInput;

              that._oPlantTable = new sap.m.Table({
                growing: true,
                growingThreshold: 100,
                mode: "SingleSelectLeft",
                includeItemInSelection: true,
                columns: [
                  new sap.m.Column({
                    header: new sap.m.Label({
                      text: "Plant"
                    })
                  }),
                  new sap.m.Column({
                    header: new sap.m.Label({
                      text: "Plant Name"
                    })
                  })
                ]
              });

              that._oPlantTable.bindItems({
                path: "plantVH>/items",
                template: new sap.m.ColumnListItem({
                  type: "Active",
                  cells: [
                    new sap.m.Text({
                      text: "{plantVH>Plant}"
                    }),
                    new sap.m.Text({
                      text: "{plantVH>PlantName}"
                    })
                  ]
                })
              });

              that._oPlantTable.attachItemPress(function (oEvent) {
                var oItem = oEvent.getParameter("listItem");

                if (oItem) {
                  that._oPlantTable.setSelectedItem(oItem, true);
                }
              });

              that._oPlantVHD = new ValueHelpDialog({
                title: "Select Plant",
                supportMultiselect: false,
                supportRanges: false,
                filterBar: oFilterBar,
                stretch: false,
                contentWidth: "60%",
                contentHeight: "60%",

                ok: function () {
                  var oSelectedItem = that._oPlantTable.getSelectedItem();

                  if (!oSelectedItem) {
                    MessageBox.error("Please select one plant.");
                    return;
                  }

                  var oData = oSelectedItem
                    .getBindingContext("plantVH")
                    .getObject();

                  var sTargetProperty = that._sPlantTargetProperty || "/Plant";

                  var oHeaderModel = that
                    .getOwnerComponent()
                    .getModel("headerModel");

                  oHeaderModel.setProperty(sTargetProperty, oData.Plant);
                  oHeaderModel.setProperty("/BomUsage", "1");

                  that._sPlantTargetProperty = "/Plant";

                  if (sTargetProperty === "/Plant") {
                    that.onHeaderFieldChange();
                  } else {
                    that._clearCopiedItems();
                    that._syncHeaderToRoute();
                  }

                  that._clearPlantValueHelpSearch();

                  that._oPlantVHD.close();
                },

                cancel: function () {
                  that._sPlantTargetProperty = "/Plant";

                  that._clearPlantValueHelpSearch();

                  that._oPlantVHD.close();
                }
              });

              that._oPlantTable.setModel(oLocalModel, "plantVH");
              that._oPlantVHD.setTable(that._oPlantTable);
            } else {
              that._oPlantTable.setModel(oLocalModel, "plantVH");
            }

            that._clearPlantValueHelpSearch();

            that._oPlantVHD.open();
          })
          .catch(function (oError) {
            MessageBox.error(that._getErrorText(oError));
          });
      },

      _clearPlantValueHelpSearch: function () {
        if (this._oPlantInput) {
          this._oPlantInput.setValue("");
        }

        if (this._oPlantNameInput) {
          this._oPlantNameInput.setValue("");
        }

        if (this._oPlantTable) {
          this._oPlantTable.removeSelections(true);

          var oBinding = this._oPlantTable.getBinding("items");

          if (oBinding) {
            oBinding.filter([]);
          }
        }
      },

      _postAction: function (sRelativePath, oPayload) {
        var oModel = this.getOwnerComponent().getModel();
        var sServiceUrl = oModel.getServiceUrl().replace(/\/$/, "");
        var sUrl = sServiceUrl + sRelativePath;

        return new Promise(function (resolve, reject) {
          jQuery.ajax({
            url: sServiceUrl + "/",
            method: "GET",
            headers: {
              "X-CSRF-Token": "Fetch",
              Accept: "application/json"
            },
            success: function (data, textStatus, jqXHR) {
              var sToken = jqXHR.getResponseHeader("X-CSRF-Token");

              if (!sToken) {
                reject({
                  responseText:
                    "CSRF token could not be fetched from service root."
                });
                return;
              }

              jQuery.ajax({
                url: sUrl,
                method: "POST",
                contentType: "application/json",
                headers: {
                  Accept: "application/json",
                  "X-CSRF-Token": sToken
                },
                data: JSON.stringify(oPayload || {}),
                success: function (oData) {
                  resolve(oData);
                },
                error: function (oXHR) {
                  reject(oXHR);
                }
              });
            },
            error: function (oXHR) {
              reject(oXHR);
            }
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
        } catch (e) {
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