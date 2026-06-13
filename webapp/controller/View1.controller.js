/* global Promise */
/* eslint-disable max-params */
sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/TableSelectDialog",
    "sap/m/ColumnListItem",
    "sap/m/Column",
    "sap/m/Text",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
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
    TableSelectDialog,
    ColumnListItem,
    Column,
    Text,
    Filter,
    FilterOperator,
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
        this._loadStyleGroupDropdown();

        this.getOwnerComponent()
          .getRouter()
          .getRoute(Constants.ROUTES.HEADER)
          .attachPatternMatched(this._onRouteMatched, this);
      },

      _replaceHeaderRouteWithoutQuery: function () {
        this.getOwnerComponent().getRouter().navTo(
          Constants.ROUTES.HEADER,
          {},
          true
        );
      },
      _onRouteMatched: function () {
        var oHeaderModel = HeaderModel.init(
          this.getOwnerComponent(),
          this.getView()
        );

        var oItemModel = ItemModel.init(
          this.getOwnerComponent(),
          this.getView()
        );

        /*
         * Production rule:
         * Header screen is a fresh create screen.
         * Do not restore previous BOM from browser back/hash/query.
         */
        this._resetHeaderAndItemDraftData(oHeaderModel);

        this.getView().setModel(oHeaderModel, "headerModel");
        this.getView().setModel(oItemModel, "itemModel");

        /*
         * Remove old query/hash data if browser restored it.
         */
        this._replaceHeaderRouteWithoutQuery();
      },

      _loadStyleGroupDropdown: function () {
        var oView = this.getView();
        var oMainModel = this.getOwnerComponent().getModel();

        var oStyleGroupModel = new JSONModel({
          items: [
            {
              SrNo: "",
              StyleGroup: "",
              Text: "-- Clear --"
            }
          ]
        });

        oView.setModel(oStyleGroupModel, "styleGroupModel");

        if (!oMainModel || !oMainModel.bindList) {
          return;
        }

        var oBinding = oMainModel.bindList("/style_group_vh");

        oBinding
          .requestContexts(0, 1000)
          .then(function (aContexts) {
            var aItems = [
              {
                SrNo: "",
                StyleGroup: "",
                Text: "-- Clear --"
              }
            ];

            aContexts.forEach(function (oContext) {
              var oData = oContext.getObject();

              if (oData && oData.StyleGroup) {
                aItems.push({
                  SrNo: oData.SrNo || "",
                  StyleGroup: oData.StyleGroup || "",
                  Text: oData.StyleGroup || ""
                });
              }
            });

            oStyleGroupModel.setProperty("/items", aItems);
          })
          .catch(function () {
            oStyleGroupModel.setProperty("/items", [
              {
                SrNo: "",
                StyleGroup: "",
                Text: "-- Clear --"
              }
            ]);
          });
      },

      _resetHeaderAndItemDraftData: function (oHeaderModel) {
        HeaderModel.reset(oHeaderModel);
        ItemModel.reset(this.getOwnerComponent().getModel("itemModel"));
      },

      _syncHeaderToRoute: function () {
        /*
         * Do not store form data in URL query.
         * In production, draft data should not come back from old browser history.
         */
        return;
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

        if (
          oEvent &&
          oEvent.getSource &&
          oEvent.getSource().getId().indexOf("inpHeaderText") !== -1
        ) {
          oHeaderModel.setProperty(
            "/HeaderText",
            String(oEvent.getSource().getValue() || "")
          );

          HeaderModel.clearValidation(oHeaderModel);
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
  var oPreparedData;
  var oPrepareResponse;

  if (!oHeaderModel) {
    throw new Error("Header model is missing.");
  }

  oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

  oPreparedData = await this._prepareMaterialPlantForValidation(oHeaderModel);

  oPrepareResponse = await this._prepareCreateBomWithBackend(
    oPreparedData.Material,
    oPreparedData.Plant
  );

  this._applyPrepareCreateBomResponse(
    oHeaderModel,
    oPrepareResponse
  );

  if (bShowToast) {
    MessageToast.show(
      oPrepareResponse.Message ||
      "Material and Plant are valid. Alternate BOM fetched."
    );
  }

  return oPrepareResponse;
},
    _prepareMaterialPlantForValidation: async function (oHeaderModel) {
  var oHeader = oHeaderModel.getData();
  var sResolvedProduct;
  var sMaterial;
  var sPlant;

  if (!oHeader.Material || !oHeader.Plant) {
    throw new Error("Please enter Material and Plant first.");
  }

  /*
   * If user typed Product Description,
   * resolve it to actual Product before backend call.
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

  /*
   * Frontend sends material as-is.
   * Backend will handle leading zero.
   */
  sMaterial = this._toBackendMaterial(oHeader.Material);
  sPlant = this._toUpperTrim(oHeader.Plant);

  oHeaderModel.setProperty("/Material", sMaterial);
  oHeaderModel.setProperty("/BackendMaterial", sMaterial);
  oHeaderModel.setProperty("/Plant", sPlant);
  oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

  this._syncHeaderToRoute();

  return {
    Material: sMaterial,
    Plant: sPlant
  };
},
  _prepareCreateBomWithBackend: function (sMaterial, sPlant) {
  return BomActionService.prepareCreateBOM(
    this.getOwnerComponent().getModel(),
    {
      Material: sMaterial,
      Plant: sPlant,
      BomUsage: Constants.BOM_USAGE
    }
  );
},

_applyPrepareCreateBomResponse: function (
  oHeaderModel,
  oPrepareResponse
) {
  oHeaderModel.setProperty("/Message", oPrepareResponse.Message || "");
  oHeaderModel.setProperty("/ShowMessage", true);
  oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

  if (!oPrepareResponse.IsValid) {
    HeaderModel.setInvalidState(
      oHeaderModel,
      oPrepareResponse.Message || "Material and Plant validation failed.",
      "Error"
    );

    this._syncHeaderToRoute();

    throw new Error(
      oPrepareResponse.Message || "Material and Plant validation failed."
    );
  }

  oHeaderModel.setProperty("/Material", oPrepareResponse.Material || "");
  oHeaderModel.setProperty("/BackendMaterial", oPrepareResponse.Material || "");
  oHeaderModel.setProperty("/Plant", oPrepareResponse.Plant || "");
  oHeaderModel.setProperty("/BaseUom", oPrepareResponse.BaseUnit || "");
  oHeaderModel.setProperty("/AltBom", oPrepareResponse.NextAltBom || "");
  oHeaderModel.setProperty("/IsValidated", true);
  oHeaderModel.setProperty("/MessageType", "Success");

  this._syncHeaderToRoute();
},

      _applyAltBomResponse: function (oHeaderModel, oAltBomResponse) {
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
      },

      onCancel: function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        this._resetHeaderAndItemDraftData(oHeaderModel);

        this.getOwnerComponent().getRouter().navTo(
          Constants.ROUTES.HEADER,
          {},
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
         description:
  oItem.ComponentDescription ||
  oItem.componentDescription ||
  oItem.ProductDescription ||
  oItem.Description ||
  "",
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

      onHeaderTextValueHelp: function () {
        var oView = this.getView();

        if (!this._oHeaderTextVHDialog) {
          this._oHeaderTextVHDialog = new TableSelectDialog({
            title: "Select Alternative BOM Text",
            noDataText: "No Style Group found",
            growing: true,
            growingThreshold: 20,

            columns: [
              new Column({
                header: new Text({
                  text: "Sr No"
                })
              }),
              new Column({
                header: new Text({
                  text: "Style Group"
                })
              })
            ],

            search: function (oEvent) {
              var sValue = String(oEvent.getParameter("value") || "");
              var oBinding = oEvent.getSource().getBinding("items");
              var aFilters = [];

              if (sValue) {
                aFilters.push(
                  new Filter({
                    filters: [
                      new Filter("StyleGroup", FilterOperator.Contains, sValue),
                      new Filter("SrNo", FilterOperator.Contains, sValue)
                    ],
                    and: false
                  })
                );
              }

              if (oBinding) {
                oBinding.filter(aFilters);
              }
            },

            confirm: function (oEvent) {
              var oSelectedItem = oEvent.getParameter("selectedItem");
              var oContext;
              var oData;
              var sStyleGroup;
              var oHeaderModel;

              if (!oSelectedItem) {
                return;
              }

              oContext = oSelectedItem.getBindingContext();

              if (!oContext) {
                return;
              }

              oData = oContext.getObject();
              sStyleGroup = String(oData.StyleGroup || "").trim();

              oHeaderModel = this.getOwnerComponent().getModel("headerModel");

              if (!oHeaderModel) {
                return;
              }

              oHeaderModel.setProperty("/HeaderText", sStyleGroup);

              HeaderModel.clearValidation(oHeaderModel);
              this._syncHeaderToRoute();
            }.bind(this)
          });

          this._oHeaderTextVHDialog.setModel(this.getOwnerComponent().getModel());

          this._oHeaderTextVHDialog.bindAggregation("items", {
            path: "/style_group_vh",
            template: new ColumnListItem({
              type: "Active",
              cells: [
                new Text({
                  text: "{SrNo}"
                }),
                new Text({
                  text: "{StyleGroup}"
                })
              ]
            })
          });

          oView.addDependent(this._oHeaderTextVHDialog);
        }

        this._oHeaderTextVHDialog.open();
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
  return String(sMaterial || "").trim().toUpperCase();
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
        } catch (oError) {
          void oError;

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