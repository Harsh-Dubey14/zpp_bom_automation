/* global Promise */

sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "zppbomautomation/config/Constants",
    "zppbomautomation/model/HeaderModel",
    "zppbomautomation/model/ItemModel",
    "zppbomautomation/service/BomActionService",
    "zppbomautomation/service/ValueHelpService",
    "zppbomautomation/util/ValueHelpHelper",
    "zppbomautomation/util/FormatterHelper",
    "zppbomautomation/util/ErrorHelper"
  ],
  function (
    Controller,
    MessageToast,
    MessageBox,
    Constants,
    HeaderModel,
    ItemModel,
    BomActionService,
    ValueHelpService,
    ValueHelpHelper,
    FormatterHelper,
    ErrorHelper
  ) {
    "use strict";

    return Controller.extend("zppbomautomation.controller.View1", {
      onInit: function () {
        HeaderModel.init(this.getOwnerComponent(), this.getView());
        ItemModel.init(this.getOwnerComponent(), this.getView());

        this.getOwnerComponent()
          .getRouter()
          .getRoute(Constants.ROUTES.HEADER)
          .attachPatternMatched(this._onRouteMatched, this);
      },

      _onRouteMatched: function (oEvent) {
        var oHeaderModel = HeaderModel.init(
          this.getOwnerComponent(),
          this.getView()
        );

        ItemModel.init(this.getOwnerComponent(), this.getView());

        var oArguments = oEvent.getParameter("arguments") || {};
        var oQuery = oArguments["?query"];

        if (oQuery && Object.keys(oQuery).length > 0) {
          oHeaderModel.setData(HeaderModel.createDataFromQuery(oQuery));
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
        HeaderModel.reset(oHeaderModel);

        ItemModel.reset(this.getOwnerComponent().getModel("itemModel"));
      },

      _syncHeaderToRoute: function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          return;
        }

        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

        var oHeader = oHeaderModel.getData();

        this.getOwnerComponent()
          .getRouter()
          .navTo(
            Constants.ROUTES.HEADER,
            {
              "?query": {
                Material: oHeader.Material || "",
                Plant: oHeader.Plant || "",
                BomUsage: Constants.BOM_USAGE,
                AltBom: oHeader.AltBom || "",
                BaseQty: String(
                  oHeader.BaseQty || Constants.DEFAULTS.BASE_QTY
                ),
                ValidFrom: oHeader.ValidFrom || "",
                BaseUom: oHeader.BaseUom || "",
                BomStatus: oHeader.BomStatus || Constants.BOM_STATUS,

                CopyMaterial: oHeader.CopyMaterial || "",
                CopyPlant: oHeader.CopyPlant || "",
                CopyAltBom: oHeader.CopyAltBom || "",

                IsValidated: String(!!oHeader.IsValidated),
                Message: oHeader.Message || "",
                MessageType:
                  oHeader.MessageType || Constants.DEFAULTS.MESSAGE_TYPE,
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

        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

        if (this._isCopyFromField(oEvent)) {
          this._clearCopiedItems();
          this._syncHeaderToRoute();
          return;
        }

        HeaderModel.clearValidation(oHeaderModel);

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
        ItemModel.clearItems(this.getOwnerComponent().getModel("itemModel"));
      },

      onContinue: async function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          MessageBox.error("Header model is missing.");
          return;
        }

        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

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

          this.getOwnerComponent()
            .getRouter()
            .navTo(Constants.ROUTES.ITEM);
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

        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

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
          oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

          oHeader.Material = oMatchedMaterial.Product;
          oHeader.BomUsage = Constants.BOM_USAGE;

          this._syncHeaderToRoute();

          var oValidateResponse = await BomActionService.validateMaterialPlant(
            this.getOwnerComponent().getModel(),
            {
              Material: oHeader.Material,
              Plant: oHeader.Plant
            }
          );

          if (!oValidateResponse.IsValid) {
            HeaderModel.setInvalidState(
              oHeaderModel,
              oValidateResponse.Message || "",
              "Error"
            );

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

          oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

          var oAltBomResponse = await BomActionService.getNextAltBOM(
            this.getOwnerComponent().getModel(),
            {
              Material: oHeader.Material,
              Plant: oHeader.Plant,
              BomUsage: Constants.BOM_USAGE
            }
          );

          oHeaderModel.setProperty("/Message", oAltBomResponse.Message || "");
          oHeaderModel.setProperty("/ShowMessage", true);
          oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

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
            HeaderModel.setInvalidState(
              oHeaderModel,
              oAltBomResponse.Message ||
                "Alternate BOM could not be determined.",
              "Error"
            );

            MessageBox.error(
              oAltBomResponse.Message ||
                "Alternate BOM could not be determined."
            );
          }

          this._syncHeaderToRoute();
        } catch (oError) {
          HeaderModel.setInvalidState(
            oHeaderModel,
            this._getErrorText(oError),
            "Error"
          );

          this._syncHeaderToRoute();

          MessageBox.error(this._getErrorText(oError));
        }
      },

      onCancel: function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        this._resetHeaderAndItemDraftData(oHeaderModel);

        this.getOwnerComponent().getRouter().navTo(
          Constants.ROUTES.HEADER,
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
          oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);
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
          oItemModel = ItemModel.init(
            this.getOwnerComponent(),
            this.getView()
          );
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

        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

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
              oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

              return BomActionService.getAlternateBOMItems(
                this.getOwnerComponent().getModel(),
                {
                  Material: oMatchedMaterial.Product,
                  Plant: String(oHeader.CopyPlant || "").trim(),
                  BomUsage: Constants.BOM_USAGE,
                  BillOfMaterialVariant: String(oHeader.CopyAltBom || "").trim()
                }
              );
            }.bind(this)
          )
          .then(
            function (oResponse) {
              var aItems = this._convertAlternateBomItemsToRows(oResponse);

              if (!aItems.length) {
                ItemModel.clearItems(oItemModel);

                return Promise.reject({
                  message: "No BOM items found for the selected Copy From BOM."
                });
              }

              ItemModel.setItems(oItemModel, aItems);

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

        return aResponseItems.map(function (oItem, iIndex) {
          return {
            item: FormatterHelper.formatItemNumber(iIndex + 1),
            component: FormatterHelper.formatComponentForDisplay(
              oItem.BillOfMaterialComponent || ""
            ),
            description: "",
            quantity: FormatterHelper.formatQuantityForDisplay(
              oItem.BillOfMaterialItemQuantity
            ),
            uom: oItem.BillOfMaterialItemUnit || "",
            sortString: "",
            category: "L",
            originalItemNumber: oItem.BillOfMaterialItemNumber || "",
            isCopied: true
          };
        });
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
        var sValue = FormatterHelper.normalizeMaterialInput(oInput.getValue());
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          return;
        }

        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

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
            oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

            if (!oMatchedMaterial) {
              oInput.setValueState("Warning");
              oInput.setValueStateText(
                "Material does not exist in value help."
              );

              oHeaderModel.setProperty(sTargetProperty, sValue);

              if (bResetValidation) {
                HeaderModel.setInvalidState(
                  oHeaderModel,
                  "Material does not exist.",
                  "Warning"
                );
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

      _resolveMaterialFromValueHelp: function (sMaterial) {
        sMaterial = FormatterHelper.normalizeMaterialInput(sMaterial);

        if (!sMaterial) {
          return Promise.resolve(null);
        }

        return ValueHelpService.loadMaterialVHData(this).then(function (
          oMaterialVHModel
        ) {
          return ValueHelpService.findMaterial(sMaterial, oMaterialVHModel);
        });
      },

      _setInvalidMaterialMessage: function (sMessage) {
        HeaderModel.setInvalidState(
          this.getOwnerComponent().getModel("headerModel"),
          sMessage,
          "Error"
        );

        this._syncHeaderToRoute();
      },

      _openMaterialValueHelp: function () {
        var that = this;

        ValueHelpHelper.openMaterialValueHelp(
          this,
          function (oData) {
            var oHeaderModel = that
              .getOwnerComponent()
              .getModel("headerModel");

            var sTargetProperty =
              that._sMaterialTargetProperty || "/Material";

            oHeaderModel.setProperty(sTargetProperty, oData.Product);
            oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

            that._sMaterialTargetProperty = "/Material";

            if (sTargetProperty === "/Material") {
              that.onHeaderFieldChange();
            } else {
              that._clearCopiedItems();
              that._syncHeaderToRoute();
            }
          },
          function () {
            that._sMaterialTargetProperty = "/Material";
          }
        );
      },

      onPlantValueHelp: function () {
        this._sPlantTargetProperty = "/Plant";
        this._openPlantValueHelp();
      },

      onCopyPlantValueHelp: function () {
        this._sPlantTargetProperty = "/CopyPlant";
        this._openPlantValueHelp();
      },

      _openPlantValueHelp: function () {
        var that = this;

        ValueHelpHelper.openPlantValueHelp(
          this,
          function (oData) {
            var oHeaderModel = that
              .getOwnerComponent()
              .getModel("headerModel");

            var sTargetProperty = that._sPlantTargetProperty || "/Plant";

            oHeaderModel.setProperty(sTargetProperty, oData.Plant);
            oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

            that._sPlantTargetProperty = "/Plant";

            if (sTargetProperty === "/Plant") {
              that.onHeaderFieldChange();
            } else {
              that._clearCopiedItems();
              that._syncHeaderToRoute();
            }
          },
          function () {
            that._sPlantTargetProperty = "/Plant";
          }
        );
      },

      _getErrorText: function (oError) {
        return ErrorHelper.getErrorText(oError);
      }
    });
  }
);