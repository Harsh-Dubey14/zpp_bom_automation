/* global Promise */

sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
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
    JSONModel,
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

        this._initSuggestionModels();
        this._warmUpValueHelpCache();

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
          oHeaderModel.setData(
            HeaderModel.createDataFromQuery(this._decodeRouteQuery(oQuery))
          );

          oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

          if (oHeaderModel.getProperty("/Material")) {
            oHeaderModel.setProperty(
              "/Material",
              this._toDisplayMaterial(oHeaderModel.getProperty("/Material"))
            );

            this._setBackendMaterialProperty(
              "/Material",
              oHeaderModel.getProperty("/Material")
            );
          }

          if (oHeaderModel.getProperty("/CopyMaterial")) {
            oHeaderModel.setProperty(
              "/CopyMaterial",
              this._toDisplayMaterial(
                oHeaderModel.getProperty("/CopyMaterial")
              )
            );

            this._setBackendMaterialProperty(
              "/CopyMaterial",
              oHeaderModel.getProperty("/CopyMaterial")
            );
          }

          if (oHeaderModel.getProperty("/Plant")) {
            oHeaderModel.setProperty(
              "/Plant",
              this._toUpperTrim(oHeaderModel.getProperty("/Plant"))
            );
          }

          if (oHeaderModel.getProperty("/CopyPlant")) {
            oHeaderModel.setProperty(
              "/CopyPlant",
              this._toUpperTrim(oHeaderModel.getProperty("/CopyPlant"))
            );
          }
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
                Material: this._encodeRouteValue(oHeader.Material || ""),
                Plant: this._encodeRouteValue(oHeader.Plant || ""),
                BomUsage: this._encodeRouteValue(Constants.BOM_USAGE),
                AltBom: this._encodeRouteValue(oHeader.AltBom || ""),
                BaseQty: this._encodeRouteValue(
                  String(oHeader.BaseQty || Constants.DEFAULTS.BASE_QTY)
                ),
                ValidFrom: this._encodeRouteValue(oHeader.ValidFrom || ""),
                BaseUom: this._encodeRouteValue(oHeader.BaseUom || ""),
                BomStatus: this._encodeRouteValue(
                  oHeader.BomStatus || Constants.BOM_STATUS
                ),

                CopyMaterial: this._encodeRouteValue(
                  oHeader.CopyMaterial || ""
                ),
                CopyPlant: this._encodeRouteValue(oHeader.CopyPlant || ""),
                CopyAltBom: this._encodeRouteValue(oHeader.CopyAltBom || ""),

                IsValidated: this._encodeRouteValue(
                  String(!!oHeader.IsValidated)
                ),
                Message: this._encodeRouteValue(oHeader.Message || ""),
                MessageType: this._encodeRouteValue(
                  oHeader.MessageType || Constants.DEFAULTS.MESSAGE_TYPE
                ),
                ShowMessage: this._encodeRouteValue(
                  String(!!oHeader.ShowMessage)
                )
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
          this._normalizeCopyFromInput(oEvent);
          this._clearCopiedItems();
          this._syncHeaderToRoute();
          return;
        }

        this._normalizeMainHeaderInput(oEvent);

        HeaderModel.clearValidation(oHeaderModel);
        this._clearCopiedItems();
        this._syncHeaderToRoute();
      },

      _normalizeMainHeaderInput: function (oEvent) {
        var oSource;
        var sId;
        var oHeaderModel;

        if (!oEvent || !oEvent.getSource) {
          return;
        }

        oSource = oEvent.getSource();
        sId = oSource.getId();
        oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          return;
        }

        if (sId.indexOf("inpMaterial") !== -1) {
          var sMaterial = this._toDisplayMaterial(oSource.getValue());

          oSource.setValue(sMaterial);
          oHeaderModel.setProperty("/Material", sMaterial);
          this._setBackendMaterialProperty("/Material", sMaterial);
        }

        if (sId.indexOf("inpPlant") !== -1) {
          var sPlant = this._toUpperTrim(oSource.getValue());

          oSource.setValue(sPlant);
          oHeaderModel.setProperty("/Plant", sPlant);
        }
      },

      _normalizeCopyFromInput: function (oEvent) {
        var oSource;
        var sId;
        var oHeaderModel;

        if (!oEvent || !oEvent.getSource) {
          return;
        }

        oSource = oEvent.getSource();
        sId = oSource.getId();
        oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          return;
        }

        if (sId.indexOf("inpCopyMaterial") !== -1) {
          var sCopyMaterial = this._toDisplayMaterial(oSource.getValue());

          oSource.setValue(sCopyMaterial);
          oHeaderModel.setProperty("/CopyMaterial", sCopyMaterial);
          this._setBackendMaterialProperty("/CopyMaterial", sCopyMaterial);
        }

        if (sId.indexOf("inpCopyPlant") !== -1) {
          var sCopyPlant = this._toUpperTrim(oSource.getValue());

          oSource.setValue(sCopyPlant);
          oHeaderModel.setProperty("/CopyPlant", sCopyPlant);
        }

        /*
         * No formatting, padding, or changing is done for CopyAltBom.
         */
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
        var oHeader;

        if (!oHeaderModel) {
          MessageBox.error("Header model is missing.");
          return;
        }

        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);
        oHeader = oHeaderModel.getData();

        if (!oHeader.Material || !oHeader.Plant) {
          MessageBox.error("Please fill Material and Plant.");
          return;
        }

        if (!oHeader.BaseQty || Number(oHeader.BaseQty) <= 0) {
          MessageBox.error("Base Quantity must be greater than zero.");
          return;
        }

        try {
          if (!oHeader.IsValidated || !oHeader.AltBom) {
            await this._validateMaterialAndFetchAltBom(false);
          }

          oHeader = oHeaderModel.getData();

          if (!oHeader.IsValidated || !oHeader.AltBom) {
            MessageBox.error("Material and Plant validation failed.");
            return;
          }

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

          this.getOwnerComponent().getRouter().navTo(Constants.ROUTES.ITEM);
        } catch (oError) {
          MessageBox.error(this._getErrorText(oError));
        }
      },

      onChangeBOMPress: function () {
        this.getOwnerComponent().getRouter().navTo("RouteBOMChange");
      },

      onValidateMaterial: async function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var oHeader;

        try {
          await this._validateMaterialAndFetchAltBom(true);

          oHeader = oHeaderModel.getData();

          if (
            oHeader.CopyMaterial &&
            oHeader.CopyPlant &&
            oHeader.CopyAltBom
          ) {
            await this._loadCopyFromAlternateBomItems(true);
          }
        } catch (oError) {
          MessageBox.error(this._getErrorText(oError));
        }
      },

      _validateMaterialAndFetchAltBom: async function (bShowToast) {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var oHeader;
        var sResolvedProduct;
        var sBackendMaterial;
        var sPlant;
        var oValidateResponse;
        var oAltBomResponse;

        if (!oHeaderModel) {
          throw new Error("Header model is missing.");
        }

        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

        oHeader = oHeaderModel.getData();

        if (!oHeader.Material || !oHeader.Plant) {
          throw new Error("Please enter Material and Plant first.");
        }

        /*
         * Important:
         * Even if user typed Product Description,
         * resolve it to actual Product before backend validation.
         */
        sResolvedProduct = await this._resolveTypedMaterialOrDescriptionToProduct(
          oHeader.Material,
          "/Material"
        );

        oHeader = oHeaderModel.getData();

        if (!sResolvedProduct || !this._looksLikeMaterialCode(oHeader.Material)) {
          throw new Error(
            "Please select or enter a valid Product before validating."
          );
        }

        oHeaderModel.setProperty(
          "/Material",
          this._toDisplayMaterial(oHeader.Material)
        );

        sBackendMaterial = this._setBackendMaterialProperty(
          "/Material",
          oHeader.Material
        );

        sPlant = this._toUpperTrim(oHeader.Plant);
        oHeaderModel.setProperty("/Plant", sPlant);

        this._syncHeaderToRoute();

        oValidateResponse = await BomActionService.validateMaterialPlant(
          this.getOwnerComponent().getModel(),
          {
            Material: sBackendMaterial,
            Plant: sPlant
          }
        );

        if (!oValidateResponse.IsValid) {
          HeaderModel.setInvalidState(
            oHeaderModel,
            oValidateResponse.Message || "Material and Plant validation failed.",
            "Error"
          );

          this._syncHeaderToRoute();

          throw new Error(
            oValidateResponse.Message || "Material and Plant validation failed."
          );
        }

        oHeaderModel.setProperty("/BaseUom", oValidateResponse.BaseUnit || "");
        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

        oAltBomResponse = await BomActionService.getNextAltBOM(
          this.getOwnerComponent().getModel(),
          {
            Material: sBackendMaterial,
            Plant: sPlant,
            BomUsage: Constants.BOM_USAGE
          }
        );

        oHeaderModel.setProperty("/Message", oAltBomResponse.Message || "");
        oHeaderModel.setProperty("/ShowMessage", true);
        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

        if (!oAltBomResponse.Success) {
          HeaderModel.setInvalidState(
            oHeaderModel,
            oAltBomResponse.Message || "Alternate BOM could not be determined.",
            "Error"
          );

          this._syncHeaderToRoute();

          throw new Error(
            oAltBomResponse.Message || "Alternate BOM could not be determined."
          );
        }

        /*
         * Main AltBom is set only from backend.
         * No user input formatting is done.
         */
        oHeaderModel.setProperty("/AltBom", oAltBomResponse.NextAltBom || "");
        oHeaderModel.setProperty("/IsValidated", true);
        oHeaderModel.setProperty("/MessageType", "Success");

        this._syncHeaderToRoute();

        if (bShowToast) {
          MessageToast.show(
            oAltBomResponse.Message ||
              "Material and Plant are valid. Alternate BOM fetched."
          );
        }

        return oAltBomResponse;
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
          oItemModel = ItemModel.init(this.getOwnerComponent(), this.getView());
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

        return this._resolveTypedMaterialOrDescriptionToProduct(
          oHeader.CopyMaterial,
          "/CopyMaterial"
        )
          .then(
            function (sResolvedProduct) {
              if (!sResolvedProduct) {
                return Promise.reject({
                  message:
                    "Please select or enter a valid Copy Product before fetching BOM."
                });
              }

              return this._getBackendCopyMaterialFromHeader();
            }.bind(this)
          )
          .then(
            function (sBackendCopyMaterial) {
              var oUpdatedHeader = oHeaderModel.getData();
              var sCopyPlant = this._toUpperTrim(oUpdatedHeader.CopyPlant);
              var sCopyAltBom = String(oUpdatedHeader.CopyAltBom || "").trim();

              oHeaderModel.setProperty(
                "/CopyMaterial",
                this._toDisplayMaterial(oUpdatedHeader.CopyMaterial)
              );
              oHeaderModel.setProperty(
                "/BackendCopyMaterial",
                sBackendCopyMaterial
              );
              oHeaderModel.setProperty("/CopyPlant", sCopyPlant);

              /*
               * No formatting/change to CopyAltBom input.
               * We only use trimmed value for API call.
               */
              oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

              return BomActionService.getAlternateBOMItems(
                this.getOwnerComponent().getModel(),
                {
                  Material: sBackendCopyMaterial,
                  Plant: sCopyPlant,
                  BomUsage: Constants.BOM_USAGE,
                  BillOfMaterialVariant: sCopyAltBom
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
            sortString: String(
              oItem.BOMItemSorter ||
                oItem.BomItemSorter ||
                oItem.bomItemSorter ||
                oItem.SortString ||
                oItem.sortString ||
                oItem.Zcomb ||
                oItem.ZCOMB ||
                oItem.zcomb ||
                ""
            )
              .trim()
              .toUpperCase(),
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
        var sValue = this._toDisplayMaterial(oInput.getValue());
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          return;
        }

        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

        if (!sValue) {
          oInput.setValueState("None");
          oInput.setValueStateText("");
          oHeaderModel.setProperty(sTargetProperty, "");

          if (sTargetProperty === "/Material") {
            oHeaderModel.setProperty("/BackendMaterial", "");
          }

          if (sTargetProperty === "/CopyMaterial") {
            oHeaderModel.setProperty("/BackendCopyMaterial", "");
          }

          if (bResetValidation) {
            HeaderModel.clearValidation(oHeaderModel);
          } else {
            this._clearCopiedItems();
          }

          this._syncHeaderToRoute();
          return;
        }

        this._resolveMaterialFromValueHelp(sValue)
          .then(function (oMatchedMaterial) {
            var sMaterialForDisplay = sValue;

            if (oMatchedMaterial && oMatchedMaterial.Product) {
              sMaterialForDisplay = that._toDisplayMaterial(
                oMatchedMaterial.Product
              );
            }

            oInput.setValueState("None");
            oInput.setValueStateText("");

            oHeaderModel.setProperty(sTargetProperty, sMaterialForDisplay);
            oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

            that._setBackendMaterialProperty(
              sTargetProperty,
              sMaterialForDisplay
            );

            if (bResetValidation) {
              HeaderModel.clearValidation(oHeaderModel);
            } else {
              that._clearCopiedItems();
            }

            that._syncHeaderToRoute();
          })
          .catch(function () {
            oInput.setValueState("None");
            oInput.setValueStateText("");

            oHeaderModel.setProperty(sTargetProperty, sValue);
            oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

            that._setBackendMaterialProperty(sTargetProperty, sValue);

            if (bResetValidation) {
              HeaderModel.clearValidation(oHeaderModel);
            } else {
              that._clearCopiedItems();
            }

            that._syncHeaderToRoute();
          });
      },

      _resolveMaterialFromValueHelp: function (sMaterial) {
        var sNormalizedMaterial = FormatterHelper.normalizeMaterialInput(
          sMaterial
        );
        var aCachedMatch;
        var sBackendMaterial;

        if (!sNormalizedMaterial) {
          return Promise.resolve(null);
        }

        sBackendMaterial = this._toBackendMaterial(sNormalizedMaterial);

        aCachedMatch = this._aMaterialVHCache.filter(
          function (oItem) {
            var sProduct = String(oItem.Product || "").toUpperCase();
            var sDisplayProduct = this._toDisplayMaterial(
              sProduct
            ).toUpperCase();

            return (
              sProduct === sNormalizedMaterial.toUpperCase() ||
              sProduct === sBackendMaterial.toUpperCase() ||
              sDisplayProduct === sNormalizedMaterial.toUpperCase()
            );
          }.bind(this)
        );

        if (aCachedMatch.length) {
          return Promise.resolve(aCachedMatch[0]);
        }

        return ValueHelpService.loadMaterialVHData(this).then(
          function (oMaterialVHModel) {
            this._aMaterialVHCache = this._getValueHelpRows(oMaterialVHModel);

            return ValueHelpService.findMaterial(
              sNormalizedMaterial,
              oMaterialVHModel
            );
          }.bind(this)
        );
      },

      _resolveTypedMaterialOrDescriptionToProduct: function (
        sValue,
        sTargetProperty
      ) {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var sSearch = String(sValue || "").trim().toUpperCase();
        var sBackendSearch;
        var aMatches;
        var oMatched;
        var sProduct;

        if (!oHeaderModel || !sSearch) {
          return Promise.resolve("");
        }

        sBackendSearch = this._toBackendMaterial(sSearch).toUpperCase();

        /*
         * First try exact match.
         */
        aMatches = this._aMaterialVHCache.filter(
          function (oItem) {
            var sProductNo = String(oItem.Product || "").toUpperCase();
            var sDisplayProduct = this._toDisplayMaterial(
              sProductNo
            ).toUpperCase();

            var sDescription = this._getMaterialDescription(oItem).toUpperCase();

            return (
              sProductNo === sSearch ||
              sProductNo === sBackendSearch ||
              sDisplayProduct === sSearch ||
              sDescription === sSearch
            );
          }.bind(this)
        );

        /*
         * If exact not found, use contains match.
         */
        if (!aMatches.length) {
          aMatches = this._aMaterialVHCache.filter(
            function (oItem) {
              var sProductNo = String(oItem.Product || "").toUpperCase();
              var sDisplayProduct = this._toDisplayMaterial(
                sProductNo
              ).toUpperCase();

              var sDescription = this._getMaterialDescription(
                oItem
              ).toUpperCase();

              return (
                sProductNo.indexOf(sSearch) !== -1 ||
                sProductNo.indexOf(sBackendSearch) !== -1 ||
                sDisplayProduct.indexOf(sSearch) !== -1 ||
                sDescription.indexOf(sSearch) !== -1
              );
            }.bind(this)
          );
        }

        if (!aMatches.length) {
          return Promise.resolve("");
        }

        /*
         * Pick first matching row.
         * This matches live suggestion behavior.
         */
        oMatched = aMatches[0];
        sProduct = this._toDisplayMaterial(oMatched.Product || "");

        if (!sProduct) {
          return Promise.resolve("");
        }

        oHeaderModel.setProperty(sTargetProperty, sProduct);
        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

        this._setBackendMaterialProperty(sTargetProperty, sProduct);

        return Promise.resolve(sProduct);
      },

      _resolveBackendMaterial: function (sMaterial) {
        var sInputMaterial = FormatterHelper.normalizeMaterialInput(sMaterial);

        if (!sInputMaterial) {
          return Promise.resolve("");
        }

        return this._resolveMaterialFromValueHelp(sInputMaterial)
          .then(
            function (oMatchedMaterial) {
              if (oMatchedMaterial && oMatchedMaterial.Product) {
                return this._toBackendMaterial(oMatchedMaterial.Product);
              }

              return this._toBackendMaterial(sInputMaterial);
            }.bind(this)
          )
          .catch(
            function () {
              return this._toBackendMaterial(sInputMaterial);
            }.bind(this)
          );
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
            var oHeaderModel = that.getOwnerComponent().getModel("headerModel");
            var sTargetProperty = that._sMaterialTargetProperty || "/Material";
            var sDisplayMaterial = that._toDisplayMaterial(oData.Product);

            oHeaderModel.setProperty(sTargetProperty, sDisplayMaterial);
            oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

            that._setBackendMaterialProperty(sTargetProperty, oData.Product);

            that._sMaterialTargetProperty = "/Material";

            if (sTargetProperty === "/Material") {
              HeaderModel.clearValidation(oHeaderModel);
              that._clearCopiedItems();
              that._syncHeaderToRoute();
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
            var oHeaderModel = that.getOwnerComponent().getModel("headerModel");

            var sTargetProperty = that._sPlantTargetProperty || "/Plant";
            var sPlant = that._toUpperTrim(oData.Plant);

            oHeaderModel.setProperty(sTargetProperty, sPlant);
            oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

            that._sPlantTargetProperty = "/Plant";

            if (sTargetProperty === "/Plant") {
              HeaderModel.clearValidation(oHeaderModel);
              that._clearCopiedItems();
              that._syncHeaderToRoute();
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

      /* =========================================================== */
      /* Live Suggestion Setup                                       */
      /* =========================================================== */

      _initSuggestionModels: function () {
        this.getView().setModel(
          new JSONModel({
            items: []
          }),
          "materialSuggestModel"
        );

        this.getView().setModel(
          new JSONModel({
            items: []
          }),
          "plantSuggestModel"
        );

        this._aMaterialVHCache = [];
        this._aPlantVHCache = [];
      },

      _warmUpValueHelpCache: function () {
        ValueHelpService.loadMaterialVHData(this)
          .then(
            function (oMaterialVHModel) {
              this._aMaterialVHCache = this._getValueHelpRows(
                oMaterialVHModel
              );
            }.bind(this)
          )
          .catch(
            function () {
              this._aMaterialVHCache = [];
            }.bind(this)
          );

        if (ValueHelpService.loadPlantVHData) {
          ValueHelpService.loadPlantVHData(this)
            .then(
              function (oPlantVHModel) {
                this._aPlantVHCache = this._getValueHelpRows(oPlantVHModel);
              }.bind(this)
            )
            .catch(
              function () {
                this._aPlantVHCache = [];
              }.bind(this)
            );
        }
      },

      _getValueHelpRows: function (oModel) {
        var oData;

        if (!oModel || !oModel.getData) {
          return [];
        }

        oData = oModel.getData();

        if (Array.isArray(oData)) {
          return oData;
        }

        if (Array.isArray(oData.value)) {
          return oData.value;
        }

        if (Array.isArray(oData.results)) {
          return oData.results;
        }

        if (Array.isArray(oData.items)) {
          return oData.items;
        }

        return [];
      },

      onMaterialLiveChange: function (oEvent) {
        this._handleLiveMaterialInput(oEvent, "/Material", true);
      },

      onCopyMaterialLiveChange: function (oEvent) {
        this._handleLiveMaterialInput(oEvent, "/CopyMaterial", false);
      },

      _handleLiveMaterialInput: function (
        oEvent,
        sTargetProperty,
        bResetValidation
      ) {
        var oInput = oEvent.getSource();
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var sRawValue;
        var sDisplayValue;

        if (!oHeaderModel) {
          return;
        }

        /*
         * Do not trim during live typing.
         * This allows product descriptions with spaces.
         */
        sRawValue = String(oInput.getValue() || "");
        sDisplayValue = sRawValue.toUpperCase();

        oInput.setValue(sDisplayValue);
        oHeaderModel.setProperty(sTargetProperty, sDisplayValue);
        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

        if (this._looksLikeMaterialCode(sDisplayValue)) {
          this._setBackendMaterialProperty(sTargetProperty, sDisplayValue);
        } else if (sTargetProperty === "/Material") {
          oHeaderModel.setProperty("/BackendMaterial", "");
        } else if (sTargetProperty === "/CopyMaterial") {
          oHeaderModel.setProperty("/BackendCopyMaterial", "");
        }

        this.getView()
          .getModel("materialSuggestModel")
          .setProperty(
            "/items",
            this._filterMaterialSuggestions(sDisplayValue)
          );

        if (bResetValidation) {
          HeaderModel.clearValidation(oHeaderModel);
        } else {
          this._clearCopiedItems();
        }
      },

      onMaterialSuggestionSelected: function (oEvent) {
        this._handleMaterialSuggestionSelected(oEvent, "/Material", true);
      },

      onCopyMaterialSuggestionSelected: function (oEvent) {
        this._handleMaterialSuggestionSelected(
          oEvent,
          "/CopyMaterial",
          false
        );
      },

      _handleMaterialSuggestionSelected: function (
        oEvent,
        sTargetProperty,
        bResetValidation
      ) {
        var oSelectedRow = oEvent.getParameter("selectedRow");
        var oSelectedItem = oEvent.getParameter("selectedItem");
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var oContext;
        var oData;
        var sMaterial;

        if (!oHeaderModel) {
          return;
        }

        if (oSelectedRow) {
          oContext = oSelectedRow.getBindingContext("materialSuggestModel");

          if (oContext) {
            oData = oContext.getObject();
            sMaterial = oData.Product;
          }
        }

        if (!sMaterial && oSelectedItem) {
          sMaterial = oSelectedItem.getKey() || oSelectedItem.getText();
        }

        if (!sMaterial) {
          return;
        }

        /*
         * Selecting by description must always put Product in input.
         */
        sMaterial = this._toDisplayMaterial(sMaterial);

        oHeaderModel.setProperty(sTargetProperty, sMaterial);
        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

        this._setBackendMaterialProperty(sTargetProperty, sMaterial);

        if (bResetValidation) {
          HeaderModel.clearValidation(oHeaderModel);
        } else {
          this._clearCopiedItems();
        }

        this._syncHeaderToRoute();
      },

      _filterMaterialSuggestions: function (sValue) {
        var sSearch = String(sValue || "").toUpperCase();
        var sSearchTrimmed = sSearch.trim();
        var sBackendSearch;
        var aItems;

        if (!sSearchTrimmed || sSearchTrimmed.length < 1) {
          return [];
        }

        sBackendSearch = this._toBackendMaterial(sSearchTrimmed).toUpperCase();

        aItems = this._aMaterialVHCache.filter(
          function (oItem) {
            var sProduct = String(oItem.Product || "").toUpperCase();
            var sDisplayProduct = this._toDisplayMaterial(
              sProduct
            ).toUpperCase();

            var sDescription = this._getMaterialDescription(
              oItem
            ).toUpperCase();

            return (
              sProduct.indexOf(sSearchTrimmed) !== -1 ||
              sProduct.indexOf(sBackendSearch) !== -1 ||
              sDisplayProduct.indexOf(sSearchTrimmed) !== -1 ||
              sDescription.indexOf(sSearchTrimmed) !== -1
            );
          }.bind(this)
        );

        return aItems.slice(0, 20);
      },

      _getMaterialDescription: function (oItem) {
        return String(
          oItem.ProductDescription ||
            oItem.ProductName ||
            oItem.MaterialDescription ||
            oItem.Description ||
            ""
        );
      },

      onPlantLiveChange: function (oEvent) {
        this._handleLivePlantInput(oEvent, "/Plant", true);
      },

      onCopyPlantLiveChange: function (oEvent) {
        this._handleLivePlantInput(oEvent, "/CopyPlant", false);
      },

      _handleLivePlantInput: function (
        oEvent,
        sTargetProperty,
        bResetValidation
      ) {
        var oInput = oEvent.getSource();
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var sValue;

        if (!oHeaderModel) {
          return;
        }

        sValue = this._toUpperTrim(oInput.getValue());

        oInput.setValue(sValue);

        oHeaderModel.setProperty(sTargetProperty, sValue);
        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

        this.getView()
          .getModel("plantSuggestModel")
          .setProperty("/items", this._filterPlantSuggestions(sValue));

        if (bResetValidation) {
          HeaderModel.clearValidation(oHeaderModel);
        } else {
          this._clearCopiedItems();
        }
      },

      onPlantSuggestionSelected: function (oEvent) {
        this._handlePlantSuggestionSelected(oEvent, "/Plant", true);
      },

      onCopyPlantSuggestionSelected: function (oEvent) {
        this._handlePlantSuggestionSelected(oEvent, "/CopyPlant", false);
      },

      _handlePlantSuggestionSelected: function (
        oEvent,
        sTargetProperty,
        bResetValidation
      ) {
        var oSelectedRow = oEvent.getParameter("selectedRow");
        var oSelectedItem = oEvent.getParameter("selectedItem");
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var oContext;
        var oData;
        var sPlant;

        if (!oHeaderModel) {
          return;
        }

        if (oSelectedRow) {
          oContext = oSelectedRow.getBindingContext("plantSuggestModel");

          if (oContext) {
            oData = oContext.getObject();
            sPlant = oData.Plant;
          }
        }

        if (!sPlant && oSelectedItem) {
          sPlant = oSelectedItem.getKey() || oSelectedItem.getText();
        }

        if (!sPlant) {
          return;
        }

        sPlant = this._toUpperTrim(sPlant);

        oHeaderModel.setProperty(sTargetProperty, sPlant);
        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

        if (bResetValidation) {
          HeaderModel.clearValidation(oHeaderModel);
        } else {
          this._clearCopiedItems();
        }

        this._syncHeaderToRoute();
      },

      _filterPlantSuggestions: function (sValue) {
        var sSearch = this._toUpperTrim(sValue);
        var aItems;

        if (!sSearch || sSearch.length < 1) {
          return [];
        }

        aItems = this._aPlantVHCache.filter(
          function (oItem) {
            var sAllText = this._getSearchableTextFromObject(oItem);

            return sAllText.indexOf(sSearch) !== -1;
          }.bind(this)
        );

        return aItems.slice(0, 20);
      },

      _getSearchableTextFromObject: function (oObject) {
        var aValues = [];

        Object.keys(oObject || {}).forEach(function (sKey) {
          var vValue = oObject[sKey];

          if (
            vValue !== null &&
            vValue !== undefined &&
            typeof vValue !== "object" &&
            typeof vValue !== "function"
          ) {
            aValues.push(String(vValue));
          }
        });

        return aValues.join(" ").toUpperCase();
      },

      /* =========================================================== */
      /* Conversion Helpers                                          */
      /* =========================================================== */

      _toUpperTrim: function (sValue) {
        return String(sValue || "").trim().toUpperCase();
      },

      _looksLikeMaterialCode: function (sValue) {
        sValue = String(sValue || "").trim();

        /*
         * Material code normally has no spaces.
         * Product description can have spaces.
         */
        return !!sValue && sValue.indexOf(" ") === -1;
      },

      _toDisplayMaterial: function (sMaterial) {
        sMaterial = FormatterHelper.normalizeMaterialInput(sMaterial);

        /*
         * Not used for live description typing.
         * Used for product/manual product code formatting.
         */
        sMaterial = String(sMaterial || "").trim().toUpperCase();

        if (/^0+\d+$/.test(sMaterial)) {
          return String(Number(sMaterial));
        }

        return sMaterial;
      },

      _setBackendMaterialProperty: function (sDisplayProperty, sMaterial) {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var sBackendMaterial = this._toBackendMaterial(sMaterial);

        if (!oHeaderModel) {
          return sBackendMaterial;
        }

        if (sDisplayProperty === "/Material") {
          oHeaderModel.setProperty("/BackendMaterial", sBackendMaterial);
        }

        if (sDisplayProperty === "/CopyMaterial") {
          oHeaderModel.setProperty("/BackendCopyMaterial", sBackendMaterial);
        }

        return sBackendMaterial;
      },

      _getBackendMaterialFromHeader: function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var sMaterial;

        if (!oHeaderModel) {
          return "";
        }

        sMaterial =
          oHeaderModel.getProperty("/BackendMaterial") ||
          oHeaderModel.getProperty("/Material") ||
          "";

        return this._toBackendMaterial(sMaterial);
      },

      _getBackendCopyMaterialFromHeader: function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var sMaterial;

        if (!oHeaderModel) {
          return "";
        }

        sMaterial =
          oHeaderModel.getProperty("/BackendCopyMaterial") ||
          oHeaderModel.getProperty("/CopyMaterial") ||
          "";

        return this._toBackendMaterial(sMaterial);
      },

      _toBackendMaterial: function (sMaterial) {
        sMaterial = FormatterHelper.normalizeMaterialInput(sMaterial);
        sMaterial = String(sMaterial || "").trim().toUpperCase();

        if (/^\d+$/.test(sMaterial) && sMaterial.length < 18) {
          return new Array(18 - sMaterial.length + 1).join("0") + sMaterial;
        }

        return sMaterial;
      },

      /* =========================================================== */
      /* Route Encoding / Error                                      */
      /* =========================================================== */

      _encodeRouteValue: function (vValue) {
        return encodeURIComponent(
          String(vValue === undefined || vValue === null ? "" : vValue)
        );
      },

      _decodeRouteValue: function (vValue) {
        try {
          return decodeURIComponent(
            String(vValue === undefined || vValue === null ? "" : vValue)
          );
        } catch (e) {
          return String(vValue === undefined || vValue === null ? "" : vValue);
        }
      },

      _decodeRouteQuery: function (oQuery) {
        var oDecodedQuery = {};
        var sKey;

        oQuery = oQuery || {};

        for (sKey in oQuery) {
          if (Object.prototype.hasOwnProperty.call(oQuery, sKey)) {
            oDecodedQuery[sKey] = this._decodeRouteValue(oQuery[sKey]);
          }
        }

        return oDecodedQuery;
      },

      _getErrorText: function (oError) {
        return ErrorHelper.getErrorText(oError);
      }
    });
  }
);