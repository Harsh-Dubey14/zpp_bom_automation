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

        this._resetHeaderAndItemDraftData(oHeaderModel);

        this.getView().setModel(oHeaderModel, "headerModel");
        this.getView().setModel(oItemModel, "itemModel");

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
        return;
      },

      _invalidatePrepareValidation: function (oHeaderModel) {
        if (!oHeaderModel) {
          return;
        }

        oHeaderModel.setProperty("/AltBom", "");
        oHeaderModel.setProperty("/IsValidated", false);
      },

      _getAlternateBomTextFromControl: function () {
        var oAltTextControl = this.byId("selHeaderText") || this.byId("inpHeaderText");

        if (!oAltTextControl) {
          return "";
        }

        if (oAltTextControl.getSelectedKey) {
          return String(oAltTextControl.getSelectedKey() || "").trim();
        }

        if (oAltTextControl.getValue) {
          return String(oAltTextControl.getValue() || "").trim();
        }

        return "";
      },

      onHeaderFieldChange: function (oEvent) {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var oSource;
        var sId;
        var sHeaderText;

        if (!oHeaderModel) {
          return;
        }

        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

        if (!oEvent || !oEvent.getSource) {
          return;
        }

        oSource = oEvent.getSource();
        sId = oSource.getId();

        if (this._isCopyFromField(oEvent)) {
          this._normalizeCopyFromInput(oEvent);
          this._clearCopiedItems();
          this._syncHeaderToRoute();
          return;
        }

        if (
          sId.indexOf("inpHeaderText") !== -1 ||
          sId.indexOf("selHeaderText") !== -1
        ) {
          if (oSource.getSelectedKey) {
            sHeaderText = String(oSource.getSelectedKey() || "").trim();
          } else if (oSource.getValue) {
            sHeaderText = String(oSource.getValue() || "").trim();
          } else {
            sHeaderText = "";
          }

          oHeaderModel.setProperty("/HeaderText", sHeaderText);

          this._invalidatePrepareValidation(oHeaderModel);

          HeaderModel.clearValidation(oHeaderModel);
          this._syncHeaderToRoute();
          return;
        }

        this._normalizeMainHeaderInput(oEvent);

        this._invalidatePrepareValidation(oHeaderModel);
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
          var sPlant = this._extractPlantCode(oSource.getValue());

          oHeaderModel.setProperty("/Plant", sPlant);
          oHeaderModel.setProperty("/PlantName", "");
          oHeaderModel.setProperty("/PlantDisplay", sPlant);
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
          var sCopyPlant = this._extractPlantCode(oSource.getValue());

          oHeaderModel.setProperty("/CopyPlant", sCopyPlant);
          oHeaderModel.setProperty("/CopyPlantName", "");
          oHeaderModel.setProperty("/CopyPlantDisplay", sCopyPlant);
        }
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
        var sHeaderText;

        if (!oHeaderModel) {
          MessageBox.error("Header model is missing.");
          return;
        }

        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);
        oHeader = oHeaderModel.getData();

        sHeaderText =
          String(oHeader.HeaderText || "").trim() ||
          this._getAlternateBomTextFromControl();

        if (sHeaderText) {
          oHeaderModel.setProperty("/HeaderText", sHeaderText);
        }

        if (!oHeader.Material || !oHeader.Plant) {
          MessageBox.error("Please fill Material and Plant.");
          return;
        }

        if (!sHeaderText) {
          MessageBox.error("Alternate BOM Text is mandatory.");
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
            MessageBox.error(
              "Material, Plant and Alternate BOM Text validation failed."
            );
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

        oPreparedData = await this._prepareMaterialPlantForValidation(
          oHeaderModel
        );

        oPrepareResponse = await this._prepareCreateBomWithBackend(
          oPreparedData.Material,
          oPreparedData.Plant,
          oPreparedData.AltText
        );

        this._applyPrepareCreateBomResponse(oHeaderModel, oPrepareResponse);

        if (bShowToast) {
          MessageToast.show(
            oPrepareResponse.Message ||
              "Material, Plant and Alternate BOM Text are valid. Alternate BOM fetched."
          );
        }

        return oPrepareResponse;
      },

      _prepareMaterialPlantForValidation: async function (oHeaderModel) {
        var oHeader = oHeaderModel.getData();
        var sResolvedProduct;
        var sMaterial;
        var sPlant;
        var sAltText;

        if (!oHeader.Material || !oHeader.Plant) {
          throw new Error("Please enter Material and Plant first.");
        }

        sAltText =
          String(oHeader.HeaderText || "").trim() ||
          this._getAlternateBomTextFromControl();

        if (!sAltText) {
          throw new Error("Alternate BOM Text is mandatory.");
        }

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

        sMaterial = this._toBackendMaterial(oHeader.Material);
        sPlant = this._toUpperTrim(oHeader.Plant);

        oHeaderModel.setProperty("/Material", sMaterial);
        oHeaderModel.setProperty("/BackendMaterial", sMaterial);
        oHeaderModel.setProperty("/Plant", sPlant);
        oHeaderModel.setProperty("/HeaderText", sAltText);
        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

        this._syncHeaderToRoute();

        return {
          Material: sMaterial,
          Plant: sPlant,
          AltText: sAltText
        };
      },

      _prepareCreateBomWithBackend: function (sMaterial, sPlant, sAltText) {
        return BomActionService.prepareCreateBOM(
          this.getOwnerComponent().getModel(),
          {
            Material: sMaterial,
            Plant: sPlant,
            BomUsage: Constants.BOM_USAGE,
            AltText: sAltText
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
            oPrepareResponse.Message ||
              "Material, Plant and Alternate BOM Text validation failed.",
            "Error"
          );

          this._syncHeaderToRoute();

          throw new Error(
            oPrepareResponse.Message ||
              "Material, Plant and Alternate BOM Text validation failed."
          );
        }

        oHeaderModel.setProperty("/Material", oPrepareResponse.Material || "");
        oHeaderModel.setProperty(
          "/BackendMaterial",
          oPrepareResponse.Material || ""
        );
        oHeaderModel.setProperty("/Plant", oPrepareResponse.Plant || "");
        oHeaderModel.setProperty(
          "/PlantDisplay",
          this._formatPlantDisplay(
            oPrepareResponse.Plant || "",
            oHeaderModel.getProperty("/PlantName") || ""
          )
        );
        oHeaderModel.setProperty(
          "/HeaderText",
          oPrepareResponse.AltText ||
            oHeaderModel.getProperty("/HeaderText") ||
            this._getAlternateBomTextFromControl() ||
            ""
        );
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
            this._invalidatePrepareValidation(oHeaderModel);
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
              that._invalidatePrepareValidation(oHeaderModel);
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
              that._invalidatePrepareValidation(oHeaderModel);
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

              this._invalidatePrepareValidation(oHeaderModel);

              HeaderModel.clearValidation(oHeaderModel);
              this._syncHeaderToRoute();
            }.bind(this)
          });

          this._oHeaderTextVHDialog.setModel(
            this.getOwnerComponent().getModel()
          );

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
              that._invalidatePrepareValidation(oHeaderModel);
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
            var sTargetProperty = that._sPlantTargetProperty || "/Plant";

            that._setPlantSelection(sTargetProperty, oData);

            that._sPlantTargetProperty = "/Plant";

            if (sTargetProperty === "/Plant") {
              var oHeaderModel = that.getOwnerComponent().getModel("headerModel");

              that._invalidatePrepareValidation(oHeaderModel);
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
          this._invalidatePrepareValidation(oHeaderModel);
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

        sMaterial = this._toDisplayMaterial(sMaterial);

        oHeaderModel.setProperty(sTargetProperty, sMaterial);
        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

        this._setBackendMaterialProperty(sTargetProperty, sMaterial);

        if (bResetValidation) {
          this._invalidatePrepareValidation(oHeaderModel);
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
        var sDisplayProperty;
        var sNameProperty;

        if (!oHeaderModel) {
          return;
        }

        sValue = this._extractPlantCode(oInput.getValue());

        oInput.setValue(sValue);

        oHeaderModel.setProperty(sTargetProperty, sValue);
        sDisplayProperty = this._getPlantDisplayProperty(sTargetProperty);
        sNameProperty = this._getPlantNameProperty(sTargetProperty);

        oHeaderModel.setProperty(sDisplayProperty, sValue);
        oHeaderModel.setProperty(sNameProperty, "");
        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);

        this.getView()
          .getModel("plantSuggestModel")
          .setProperty("/items", this._filterPlantSuggestions(sValue));

        if (bResetValidation) {
          this._invalidatePrepareValidation(oHeaderModel);
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

        if (!oData) {
          oData = {
            Plant: sPlant,
            PlantName: ""
          };
        }

        this._setPlantSelection(sTargetProperty, oData);

        if (bResetValidation) {
          this._invalidatePrepareValidation(oHeaderModel);
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

      _toUpperTrim: function (sValue) {
        return String(sValue || "").trim().toUpperCase();
      },

      _extractPlantCode: function (sValue) {
        return this._toUpperTrim(String(sValue || "").split(" - ")[0]);
      },

      _getPlantName: function (oData) {
        return String(
          oData.PlantName ||
            oData.plantName ||
            oData.Name ||
            oData.PlantDescription ||
            ""
        ).trim();
      },

      _formatPlantDisplay: function (sPlant, sPlantName) {
        sPlant = this._toUpperTrim(sPlant);
        sPlantName = String(sPlantName || "").trim();

        if (!sPlant) {
          return "";
        }

        if (!sPlantName) {
          return sPlant;
        }

        return sPlant + " - " + sPlantName;
      },

      _getPlantDisplayProperty: function (sPlantProperty) {
        return sPlantProperty === "/CopyPlant"
          ? "/CopyPlantDisplay"
          : "/PlantDisplay";
      },

      _getPlantNameProperty: function (sPlantProperty) {
        return sPlantProperty === "/CopyPlant"
          ? "/CopyPlantName"
          : "/PlantName";
      },

      _setPlantSelection: function (sPlantProperty, oData) {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var sPlant = this._toUpperTrim(oData && oData.Plant);
        var sPlantName = this._getPlantName(oData || {});
        var sDisplayProperty = this._getPlantDisplayProperty(sPlantProperty);
        var sNameProperty = this._getPlantNameProperty(sPlantProperty);

        if (!oHeaderModel) {
          return;
        }

        oHeaderModel.setProperty(sPlantProperty, sPlant);
        oHeaderModel.setProperty(sNameProperty, sPlantName);
        oHeaderModel.setProperty(
          sDisplayProperty,
          this._formatPlantDisplay(sPlant, sPlantName)
        );
        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);
      },

      _looksLikeMaterialCode: function (sValue) {
        sValue = String(sValue || "").trim();

        return !!sValue && sValue.indexOf(" ") === -1;
      },

      _toDisplayMaterial: function (sMaterial) {
        sMaterial = FormatterHelper.normalizeMaterialInput(sMaterial);

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
