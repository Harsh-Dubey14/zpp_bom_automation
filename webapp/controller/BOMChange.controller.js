/* global Promise */

sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "zppbomautomation/config/Constants",
    "zppbomautomation/model/ItemModel",
    "zppbomautomation/service/ValueHelpService",
    "zppbomautomation/util/ValueHelpHelper",
    "zppbomautomation/util/FormatterHelper",
    "zppbomautomation/util/ErrorHelper"
  ],
  function (
    Controller,
    JSONModel,
    MessageToast,
    MessageBox,
    Constants,
    ItemModel,
    ValueHelpService,
    ValueHelpHelper,
    FormatterHelper,
    ErrorHelper
  ) {
    "use strict";

    return Controller.extend("zppbomautomation.controller.BOMChange", {
      onInit: function () {
        this._initChangeModel();
        this._initSuggestionModels();
        this._warmUpValueHelpCache();

        this.getOwnerComponent()
          .getRouter()
          .getRoute("RouteBOMChange")
          .attachPatternMatched(this._onRouteMatched, this);
      },

      _onRouteMatched: function () {
        this._initChangeModel();
        this._initSuggestionModels();
        this._warmUpValueHelpCache();

        ItemModel.init(this.getOwnerComponent(), this.getView());
      },

      _initChangeModel: function () {
        var oChangeModel = new JSONModel(this._getDefaultChangeData());

        this.getView().setModel(oChangeModel, "changeModel");
        this.getOwnerComponent().setModel(oChangeModel, "changeModel");
      },

      _getDefaultChangeData: function () {
        return {
          Material: "",
          BackendMaterial: "",
          Plant: "",
          BomUsage: Constants.BOM_USAGE || "1",
          AltBom: "",

          BillOfMaterial: "",
          BomNumberAltBom: "",

          SearchMode: "",
          CanContinue: false,

          FetchedItems: [],
          HeaderData: null,

          Message: "",
          MessageType: "Information",
          ShowMessage: false
        };
      },

      onNavBack: function () {
        this.onCancel();
      },

      onMaterialSearchFieldChange: function () {
        var oChangeModel = this.getView().getModel("changeModel");

        if (!oChangeModel) {
          return;
        }

        oChangeModel.setProperty("/CanContinue", false);
        oChangeModel.setProperty("/FetchedItems", []);
        oChangeModel.setProperty("/HeaderData", null);
        oChangeModel.setProperty("/SearchMode", "");

        this._clearMessage();
      },

      onBomNumberSearchFieldChange: function () {
        var oChangeModel = this.getView().getModel("changeModel");

        if (!oChangeModel) {
          return;
        }

        oChangeModel.setProperty("/CanContinue", false);
        oChangeModel.setProperty("/FetchedItems", []);
        oChangeModel.setProperty("/HeaderData", null);
        oChangeModel.setProperty("/SearchMode", "");

        this._clearMessage();
      },

      onGetBOMByMaterial: async function () {
        var oChangeModel = this.getView().getModel("changeModel");
        var oData;
        var sResolvedProduct;
        var sBackendMaterial;
        var sPlant;

        if (!oChangeModel) {
          MessageBox.error("Change model is missing.");
          return;
        }

        oData = oChangeModel.getData();

        if (!oData.Material || !oData.Plant || !oData.AltBom) {
          MessageBox.error("Please enter Material, Plant and Alternative BOM.");
          return;
        }

        try {
          this.getView().setBusy(true);

          /*
           * User may type Product OR Product Description.
           * Before backend fetch, always resolve it to actual Product.
           */
          sResolvedProduct =
            await this._resolveTypedMaterialOrDescriptionToProduct(
              oData.Material,
              "/Material"
            );

          oData = oChangeModel.getData();

          if (!sResolvedProduct || !this._looksLikeMaterialCode(oData.Material)) {
            MessageBox.error("Please select or enter a valid Product.");
            return;
          }

          sBackendMaterial = this._getBackendMaterialFromChangeModel();
          sPlant = this._toUpperTrim(oData.Plant);

          oChangeModel.setProperty(
            "/Material",
            this._toDisplayMaterial(oData.Material)
          );
          oChangeModel.setProperty("/Plant", sPlant);
          oChangeModel.setProperty("/BomUsage", Constants.BOM_USAGE || "1");

          await this._fetchBomChangeItems(
            {
              searchMode: "MATERIAL",
              Material: sBackendMaterial,
              Plant: sPlant,
              BillOfMaterialVariantUsage: Constants.BOM_USAGE || "1",
              BillOfMaterialVariant: String(oData.AltBom || "").trim()
            },
            true
          );
        } catch (oError) {
          this._setMessage(this._getErrorText(oError), "Error");
          MessageBox.error(this._getErrorText(oError));
        } finally {
          this.getView().setBusy(false);
        }
      },

      onGetBOMByNumber: async function () {
  var oChangeModel = this.getView().getModel("changeModel");
  var oData;

  if (!oChangeModel) {
    MessageBox.error("Change model is missing.");
    return;
  }

  oData = oChangeModel.getData();

  if (!oData.BillOfMaterial || !oData.BomNumberAltBom) {
    MessageBox.error("Please enter BOM Number and Alternative BOM.");
    return;
  }

  try {
    this.getView().setBusy(true);

    oChangeModel.setProperty("/BomUsage", Constants.BOM_USAGE || "1");

    await this._fetchBomChangeItems(
      {
        searchMode: "BOM",
        BillOfMaterial: String(oData.BillOfMaterial || "").trim(),
        BillOfMaterialVariantUsage: Constants.BOM_USAGE || "1",
        BillOfMaterialVariant: String(oData.BomNumberAltBom || "").trim()
      },
      true
    );
  } catch (oError) {
    this._setMessage(this._getErrorText(oError), "Error");
    MessageBox.error(this._getErrorText(oError));
  } finally {
    this.getView().setBusy(false);
  }
},

      _fetchBomChangeItems: async function (oRequest, bAutoNavigate) {
        var oModel = this.getOwnerComponent().getModel();
        var oChangeModel = this.getView().getModel("changeModel");
        var aItems;
        var aRows;
        var oHeaderData;

        this._setMessage("Fetching BOM components...", "Information");

        aItems = await this._readBomChangeItems(oModel, oRequest);

        aItems = aItems.filter(function (oItem) {
          return (
            oItem &&
            (oItem.BillOfMaterialComponent ||
              oItem.BillOfMaterialItemNumber ||
              oItem.BillOfMaterialItemNodeNumber)
          );
        });

        if (!aItems.length) {
          oChangeModel.setProperty("/CanContinue", false);
          oChangeModel.setProperty("/FetchedItems", []);
          oChangeModel.setProperty("/HeaderData", null);

          throw {
            message: "No BOM components found for the entered details."
          };
        }

        aRows = this._convertBomChangeItemsToRows(aItems);
        oHeaderData = this._buildChangeHeaderData(aItems[0], oRequest);

        oChangeModel.setProperty("/FetchedItems", aRows);
        oChangeModel.setProperty("/HeaderData", oHeaderData);
        oChangeModel.setProperty("/SearchMode", oRequest.searchMode);
        oChangeModel.setProperty("/CanContinue", true);

        this._setMessage(
          aRows.length + " BOM component(s) fetched successfully.",
          "Success"
        );

        MessageToast.show(aRows.length + " BOM component(s) fetched.");

        /*
         * New requirement:
         * If user clicks Get BOM by Material and BOM is found,
         * no need to press Continue. Auto navigate.
         */
        if (bAutoNavigate) {
          this.onContinue();
        }
      },

      _readBomChangeItems: function (oModel, oRequest) {
        var aFilters = [];

        if (oRequest.searchMode === "MATERIAL") {
          aFilters.push(
            "Material eq '" + this._escapeODataValue(oRequest.Material) + "'"
          );
          aFilters.push(
            "Plant eq '" + this._escapeODataValue(oRequest.Plant) + "'"
          );
          aFilters.push(
            "BillOfMaterialVariantUsage eq '" +
              this._escapeODataValue(oRequest.BillOfMaterialVariantUsage) +
              "'"
          );
          aFilters.push(
            "BillOfMaterialVariant eq '" +
              this._escapeODataValue(oRequest.BillOfMaterialVariant) +
              "'"
          );
        } else {
          aFilters.push(
            "BillOfMaterial eq '" +
              this._escapeODataValue(oRequest.BillOfMaterial) +
              "'"
          );
          aFilters.push(
            "BillOfMaterialVariantUsage eq '" +
              this._escapeODataValue(oRequest.BillOfMaterialVariantUsage) +
              "'"
          );
          aFilters.push(
            "BillOfMaterialVariant eq '" +
              this._escapeODataValue(oRequest.BillOfMaterialVariant) +
              "'"
          );
        }

        return oModel
          .bindList("/BomChangeRead", null, null, null, {
            $filter: aFilters.join(" and ")
          })
          .requestContexts(0, 5000)
          .then(function (aContexts) {
            return aContexts.map(function (oContext) {
              return oContext.getObject();
            });
          });
      },

      _convertBomChangeItemsToRows: function (aBackendItems) {
        aBackendItems = aBackendItems || [];

        aBackendItems.sort(function (a, b) {
          return (
            Number(a.BillOfMaterialItemNumber || 0) -
            Number(b.BillOfMaterialItemNumber || 0)
          );
        });

        return aBackendItems.map(function (oItem, iIndex) {
          return {
            item:
              oItem.BillOfMaterialItemNumber ||
              FormatterHelper.formatItemNumber(iIndex + 1),

            component: FormatterHelper.formatComponentForDisplay(
              oItem.BillOfMaterialComponent || ""
            ),

            description: oItem.BOMItemDescription || "",
            quantity: FormatterHelper.formatQuantityForDisplay(
              oItem.BillOfMaterialItemQuantity
            ),
            uom: oItem.BillOfMaterialItemUnit || "",
            sortString: oItem.BOMItemSorter || "",
            category: oItem.BillOfMaterialItemCategory || "L",

            rowStatus: "EXISTING",
            changeMode: "",
            isNew: false,
            isChanged: false,
            isDeleted: false,

            billOfMaterial: oItem.BillOfMaterial || "",
            billOfMaterialCategory: oItem.BillOfMaterialCategory || "M",
            billOfMaterialVariant: oItem.BillOfMaterialVariant || "",
            billOfMaterialVariantUsage:
              oItem.BillOfMaterialVariantUsage ||
              Constants.BOM_USAGE ||
              "1",
            billOfMaterialVersion: oItem.BillOfMaterialVersion || "",
            headerChangeDocument: oItem.HeaderChangeDocument || "",
            material: oItem.Material || "",
            plant: oItem.Plant || "",
            billOfMaterialItemNodeNumber:
              oItem.BillOfMaterialItemNodeNumber || "",
            originalItemNumber: oItem.BillOfMaterialItemNumber || ""
          };
        });
      },

      _buildChangeHeaderData: function (oFirstItem, oRequest) {
        oFirstItem = oFirstItem || {};

        return {
          AppMode: Constants.APP_MODE.CHANGE,
          IsChangeMode: true,

          Material: oFirstItem.Material || oRequest.Material || "",
          Plant: oFirstItem.Plant || oRequest.Plant || "",

          BomUsage:
            oFirstItem.BillOfMaterialVariantUsage ||
            oRequest.BillOfMaterialVariantUsage ||
            Constants.BOM_USAGE,

          AltBom:
            oFirstItem.BillOfMaterialVariant ||
            oRequest.BillOfMaterialVariant ||
            "",

          BillOfMaterial:
            oFirstItem.BillOfMaterial || oRequest.BillOfMaterial || "",

          BillOfMaterialCategory:
            oFirstItem.BillOfMaterialCategory ||
            Constants.DEFAULTS.BILL_OF_MATERIAL_CATEGORY,

          BillOfMaterialVariant:
            oFirstItem.BillOfMaterialVariant ||
            oRequest.BillOfMaterialVariant ||
            "",

          BillOfMaterialVariantUsage:
            oFirstItem.BillOfMaterialVariantUsage ||
            oRequest.BillOfMaterialVariantUsage ||
            Constants.BOM_USAGE,

          BillOfMaterialVersion: oFirstItem.BillOfMaterialVersion || "",
          HeaderChangeDocument: oFirstItem.HeaderChangeDocument || "",

          BaseQty: 1,
          BaseUom: "",
          ValidFrom: "",
          BomStatus: Constants.BOM_STATUS,

          IsValidated: true,
          Message: "BOM loaded for change.",
          MessageType: "Success",
          ShowMessage: true
        };
      },

      onContinue: function () {
        var oChangeModel = this.getView().getModel("changeModel");
        var oData;
        var oHeaderModel;
        var oItemModel;

        if (!oChangeModel) {
          MessageBox.error("Change model is missing.");
          return;
        }

        oData = oChangeModel.getData();

        if (!oData.CanContinue || !oData.FetchedItems || !oData.FetchedItems.length) {
          MessageBox.error("Please fetch valid BOM components before continuing.");
          return;
        }

        oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          oHeaderModel = new JSONModel({});
          this.getOwnerComponent().setModel(oHeaderModel, "headerModel");
        }

        oHeaderModel.setData(oData.HeaderData);

        oItemModel = this.getOwnerComponent().getModel("itemModel");

        if (!oItemModel) {
          oItemModel = ItemModel.init(this.getOwnerComponent(), this.getView());
        }

        ItemModel.setItems(oItemModel, oData.FetchedItems);

        this.getOwnerComponent().setModel(oChangeModel, "changeModel");

        this.getOwnerComponent().getRouter().navTo(Constants.ROUTES.ITEM);
      },

      onCancel: function () {
        this._initChangeModel();

        ItemModel.reset(this.getOwnerComponent().getModel("itemModel"));

        this.getOwnerComponent()
          .getRouter()
          .navTo(Constants.ROUTES.HEADER || "RouteView1", {}, true);
      },

      onMaterialValueHelp: function () {
        var that = this;

        ValueHelpHelper.openMaterialValueHelp(this, function (oData) {
          var oChangeModel = that.getView().getModel("changeModel");
          var sProduct = that._toDisplayMaterial(oData.Product || "");

          oChangeModel.setProperty("/Material", sProduct);
          oChangeModel.setProperty(
            "/BackendMaterial",
            that._toBackendMaterial(oData.Product || "")
          );

          that._resetFetchedChangeData();
          that._clearMessage();
        });
      },

      onPlantValueHelp: function () {
        var that = this;

        ValueHelpHelper.openPlantValueHelp(this, function (oData) {
          var oChangeModel = that.getView().getModel("changeModel");

          oChangeModel.setProperty("/Plant", that._toUpperTrim(oData.Plant));

          that._resetFetchedChangeData();
          that._clearMessage();
        });
      },

      _resetFetchedChangeData: function () {
        var oChangeModel = this.getView().getModel("changeModel");

        if (!oChangeModel) {
          return;
        }

        oChangeModel.setProperty("/CanContinue", false);
        oChangeModel.setProperty("/FetchedItems", []);
        oChangeModel.setProperty("/HeaderData", null);
        oChangeModel.setProperty("/SearchMode", "");
      },

      /* =========================================================== */
      /* Live Suggestions                                             */
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
              this._aMaterialVHCache = this._getValueHelpRows(oMaterialVHModel);
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
        this._handleLiveMaterialInput(oEvent);
      },

      _handleLiveMaterialInput: function (oEvent) {
        var oInput = oEvent.getSource();
        var oChangeModel = this.getView().getModel("changeModel");
        var sRawValue;
        var sDisplayValue;

        if (!oChangeModel) {
          return;
        }

        /*
         * Do not trim during live typing.
         * Product description can contain spaces.
         */
        sRawValue = String(oInput.getValue() || "");
        sDisplayValue = sRawValue.toUpperCase();

        oInput.setValue(sDisplayValue);

        oChangeModel.setProperty("/Material", sDisplayValue);
        oChangeModel.setProperty("/BomUsage", Constants.BOM_USAGE || "1");

        if (this._looksLikeMaterialCode(sDisplayValue)) {
          oChangeModel.setProperty(
            "/BackendMaterial",
            this._toBackendMaterial(sDisplayValue)
          );
        } else {
          oChangeModel.setProperty("/BackendMaterial", "");
        }

        this.getView()
          .getModel("materialSuggestModel")
          .setProperty("/items", this._filterMaterialSuggestions(sDisplayValue));

        this._resetFetchedChangeData();
        this._clearMessage();
      },

      onMaterialSuggestionSelected: function (oEvent) {
        var oSelectedRow = oEvent.getParameter("selectedRow");
        var oSelectedItem = oEvent.getParameter("selectedItem");
        var oChangeModel = this.getView().getModel("changeModel");
        var oContext;
        var oData;
        var sMaterial;

        if (!oChangeModel) {
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
         * If user selects by description, input must become Product.
         */
        sMaterial = this._toDisplayMaterial(sMaterial);

        oChangeModel.setProperty("/Material", sMaterial);
        oChangeModel.setProperty("/BackendMaterial", this._toBackendMaterial(sMaterial));
        oChangeModel.setProperty("/BomUsage", Constants.BOM_USAGE || "1");

        this._resetFetchedChangeData();
        this._clearMessage();
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
            var sDisplayProduct = this._toDisplayMaterial(sProduct).toUpperCase();
            var sDescription = this._getMaterialDescription(oItem).toUpperCase();

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

      _resolveTypedMaterialOrDescriptionToProduct: function (
        sValue,
        sTargetProperty
      ) {
        var oChangeModel = this.getView().getModel("changeModel");
        var sSearch = String(sValue || "").trim().toUpperCase();

        if (!oChangeModel || !sSearch) {
          return Promise.resolve("");
        }

        return this._ensureMaterialCacheLoaded().then(
          function () {
            var sBackendSearch = this._toBackendMaterial(sSearch).toUpperCase();
            var aMatches;
            var oMatched;
            var sProduct;

            /*
             * First exact match.
             */
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
                  sProductNo === sSearch ||
                  sProductNo === sBackendSearch ||
                  sDisplayProduct === sSearch ||
                  sDescription === sSearch
                );
              }.bind(this)
            );

            /*
             * Then contains match.
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
              return "";
            }

            oMatched = aMatches[0];
            sProduct = this._toDisplayMaterial(oMatched.Product || "");

            if (!sProduct) {
              return "";
            }

            oChangeModel.setProperty(sTargetProperty, sProduct);
            oChangeModel.setProperty("/BackendMaterial", this._toBackendMaterial(sProduct));
            oChangeModel.setProperty("/BomUsage", Constants.BOM_USAGE || "1");

            return sProduct;
          }.bind(this)
        );
      },

      _ensureMaterialCacheLoaded: function () {
        if (this._aMaterialVHCache && this._aMaterialVHCache.length) {
          return Promise.resolve();
        }

        return ValueHelpService.loadMaterialVHData(this).then(
          function (oMaterialVHModel) {
            this._aMaterialVHCache = this._getValueHelpRows(oMaterialVHModel);
          }.bind(this)
        );
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
        var oInput = oEvent.getSource();
        var oChangeModel = this.getView().getModel("changeModel");
        var sValue;

        if (!oChangeModel) {
          return;
        }

        sValue = this._toUpperTrim(oInput.getValue());

        oInput.setValue(sValue);

        oChangeModel.setProperty("/Plant", sValue);
        oChangeModel.setProperty("/BomUsage", Constants.BOM_USAGE || "1");

        this.getView()
          .getModel("plantSuggestModel")
          .setProperty("/items", this._filterPlantSuggestions(sValue));

        this._resetFetchedChangeData();
        this._clearMessage();
      },

      onPlantSuggestionSelected: function (oEvent) {
        var oSelectedRow = oEvent.getParameter("selectedRow");
        var oSelectedItem = oEvent.getParameter("selectedItem");
        var oChangeModel = this.getView().getModel("changeModel");
        var oContext;
        var oData;
        var sPlant;

        if (!oChangeModel) {
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

        oChangeModel.setProperty("/Plant", sPlant);
        oChangeModel.setProperty("/BomUsage", Constants.BOM_USAGE || "1");

        this._resetFetchedChangeData();
        this._clearMessage();
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
         * Product code normally has no spaces.
         * Product description can have spaces.
         */
        return !!sValue && sValue.indexOf(" ") === -1;
      },

      _toDisplayMaterial: function (sMaterial) {
        sMaterial = FormatterHelper.normalizeMaterialInput(sMaterial);
        sMaterial = String(sMaterial || "").trim().toUpperCase();

        /*
         * Do not show leading zero on screen.
         */
        if (/^0+\d+$/.test(sMaterial)) {
          return String(Number(sMaterial));
        }

        return sMaterial;
      },

      _toBackendMaterial: function (sMaterial) {
        sMaterial = FormatterHelper.normalizeMaterialInput(sMaterial);
        sMaterial = String(sMaterial || "").trim().toUpperCase();

        /*
         * Only numeric material gets leading zero.
         */
        if (/^\d+$/.test(sMaterial) && sMaterial.length < 18) {
          return new Array(18 - sMaterial.length + 1).join("0") + sMaterial;
        }

        return sMaterial;
      },

      _getBackendMaterialFromChangeModel: function () {
        var oChangeModel = this.getView().getModel("changeModel");
        var sMaterial;

        if (!oChangeModel) {
          return "";
        }

        sMaterial =
          oChangeModel.getProperty("/BackendMaterial") ||
          oChangeModel.getProperty("/Material") ||
          "";

        return this._toBackendMaterial(sMaterial);
      },

      _escapeODataValue: function (sValue) {
        return String(sValue || "").replace(/'/g, "''");
      },

      _setMessage: function (sMessage, sType) {
        var oChangeModel = this.getView().getModel("changeModel");

        if (!oChangeModel) {
          return;
        }

        oChangeModel.setProperty("/Message", sMessage || "");
        oChangeModel.setProperty("/MessageType", sType || "Information");
        oChangeModel.setProperty("/ShowMessage", !!sMessage);
      },

      _clearMessage: function () {
        this._setMessage("", "Information");
      },

      _getErrorText: function (oError) {
        return ErrorHelper.getErrorText(oError);
      }
    });
  }
);