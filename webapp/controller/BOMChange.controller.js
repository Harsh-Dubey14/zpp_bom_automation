/* global Promise */

sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "zppbomautomation/config/Constants",
    "sap/ui/core/BusyIndicator",
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
    BusyIndicator,
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
    .getRoute(Constants.ROUTES.CHANGE)
    .attachPatternMatched(this._onRouteMatched, this);
},

      _onRouteMatched: function () {
  this._initChangeModel();
  this._initSuggestionModels();
  this._warmUpValueHelpCache();
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
PlantName: "",
PlantDisplay: "",
          BomUsage: Constants.BOM_USAGE || "1",
          AltBom: "",

          BillOfMaterial: "",
          BomNumberAltBom: "",

          SearchMode: "",
          CanContinue: false,

          FetchedItems: [],
          HeaderData: null,

          Message: "",
          MessageType: Constants.DEFAULTS.MESSAGE_TYPE || "Information",
          ShowMessage: false
        };
      },

      onNavBack: function () {
        this.onCancel();
      },

      onMaterialSearchFieldChange: function () {
        this._clearFetchedData();
      },

      onBomNumberSearchFieldChange: function () {
        this._clearFetchedData();
      },

      _clearFetchedData: function () {
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

  if (!oChangeModel) {
    MessageBox.error("Change model is missing.");
    return;
  }

  var oData = oChangeModel.getData();

  if (!oData.Material || !oData.Plant || !oData.AltBom) {
    MessageBox.error("Please enter Material, Plant and Alternative BOM.");
    return;
  }

  try {
    BusyIndicator.show(0);

    var sResolvedProduct = FormatterHelper.normalizeMaterialInput(
      oData.Material
    ).toUpperCase();

    oChangeModel.setProperty("/Material", sResolvedProduct);
    oChangeModel.setProperty(
      "/BackendMaterial",
      this._toBackendMaterial(sResolvedProduct)
    );

    oData = oChangeModel.getData();

    if (!sResolvedProduct || !this._looksLikeMaterialCode(oData.Material)) {
      MessageBox.error("Please select or enter a valid Product.");
      return;
    }

    var sBackendMaterial = this._getBackendMaterialFromChangeModel();
    var sPlant = this._toUpperTrim(oData.Plant);

    oChangeModel.setProperty("/Material", this._toDisplayMaterial(oData.Material));
    oChangeModel.setProperty("/Plant", sPlant);
    oChangeModel.setProperty(
      "/PlantDisplay",
      this._formatPlantDisplay(
        sPlant,
        oChangeModel.getProperty("/PlantName") || ""
      )
    );
    oChangeModel.setProperty("/BomUsage", Constants.BOM_USAGE || "1");

    await this._fetchBomChangeItems(
      {
        searchMode: Constants.SEARCH_MODE.MATERIAL,
        Material: sBackendMaterial,
        Plant: sPlant,
        PlantName: oChangeModel.getProperty("/PlantName") || "",
        PlantDisplay: oChangeModel.getProperty("/PlantDisplay") || sPlant,
        BillOfMaterialVariantUsage: Constants.BOM_USAGE || "1",
        BillOfMaterialVariant: String(oData.AltBom || "").trim()
      },
      true
    );
  } catch (oError) {
    this._setMessage(this._getErrorText(oError), "Error");
    MessageBox.error(this._getErrorText(oError));
  } finally {
    BusyIndicator.hide();
  }
},

      onGetBOMByNumber: async function () {
        var oChangeModel = this.getView().getModel("changeModel");

        if (!oChangeModel) {
          MessageBox.error("Change model is missing.");
          return;
        }

        var oData = oChangeModel.getData();

        if (!oData.BillOfMaterial || !oData.BomNumberAltBom) {
          MessageBox.error("Please enter BOM Number and Alternative BOM.");
          return;
        }

        try {
          BusyIndicator.show(0);

          oChangeModel.setProperty("/BomUsage", Constants.BOM_USAGE || "1");

          await this._fetchBomChangeItems(
            {
              searchMode: Constants.SEARCH_MODE.BOM,
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
          BusyIndicator.hide();
        }
      },

      _fetchBomChangeItems: async function (oRequest, bAutoNavigate) {
        var oModel = this.getOwnerComponent().getModel();
        var oChangeModel = this.getView().getModel("changeModel");

        this._setMessage("Fetching BOM components...", "Information");

        var aItems = await this._readBomChangeItems(oModel, oRequest);

        if (oRequest.searchMode === Constants.SEARCH_MODE.MATERIAL) {
          var sRequestedMaterial = this._toBackendMaterial(
            oRequest.Material || ""
          ).toUpperCase();

          aItems = aItems.filter(
            function (oItem) {
              var sReturnedMaterial = this._toBackendMaterial(
                oItem.Material || ""
              ).toUpperCase();

              return sReturnedMaterial === sRequestedMaterial;
            }.bind(this)
          );
        }

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

        var aRows = this._convertBomChangeItemsToRows(aItems);
        var oHeaderRequest = await this._enrichRequestWithPlantDisplay(
          oRequest,
          aItems[0]
        );
        var oHeaderData = this._buildChangeHeaderData(aItems[0], oHeaderRequest);

        oChangeModel.setProperty("/FetchedItems", aRows);
        oChangeModel.setProperty("/HeaderData", oHeaderData);
        oChangeModel.setProperty("/SearchMode", oRequest.searchMode);
        oChangeModel.setProperty("/CanContinue", true);

        this.getOwnerComponent().setModel(oChangeModel, "changeModel");

        this._setMessage(
          aRows.length + " BOM component(s) fetched successfully.",
          "Success"
        );

        MessageToast.show(aRows.length + " BOM component(s) fetched.");

        if (bAutoNavigate) {
          this.onContinue();
        }
      },

      _readBomChangeItems: function (oModel, oRequest) {
        var aFilters = [];

        if (oRequest.searchMode === Constants.SEARCH_MODE.MATERIAL) {
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
          .bindList(
            Constants.ENTITY_SETS.BOM_CHANGE_READ,
            null,
            null,
            null,
            {
              $filter: aFilters.join(" and ")
            }
          )
          .requestContexts(0, 5000)
          .then(function (aContexts) {
            return aContexts.map(function (oContext) {
              return oContext.getObject();
            });
          });
      },

      _convertBomChangeItemsToRows: function (aBackendItems) {
        var that = this;

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
              oItem.BillOfMaterialComponent || oItem.Component || ""
            ),

            description: String(
              oItem.ProductDescription ||
              oItem.ComponentDescription ||
              ""
            ).substring(0, 40),

            remarks: String(
              oItem.BOMItemDescription ||
              oItem.ItemText ||
              ""
            ).substring(0, 40),

            quantity:
              oItem.BillOfMaterialItemQuantity !== undefined &&
              oItem.BillOfMaterialItemQuantity !== null
                ? FormatterHelper.formatQuantityForDisplay(
                    oItem.BillOfMaterialItemQuantity
                  )
                : "",

            uom: oItem.BillOfMaterialItemUnit || oItem.Uom || "",

            sortString:
              that._getRealBackendSortString(oItem) ||
              "",

            sortStringValue:
              that._getRealBackendSortString(oItem) ||
              "",

            category:
              oItem.BillOfMaterialItemCategory ||
              Constants.ITEM_CATEGORY,

            rowStatus: Constants.ROW_STATUS.EXISTING,
            changeMode: "",
            isNew: false,
            isChanged: false,
            isDeleted: false,

            billOfMaterial: oItem.BillOfMaterial || "",
            billOfMaterialCategory:
              oItem.BillOfMaterialCategory ||
              Constants.DEFAULTS.BILL_OF_MATERIAL_CATEGORY ||
              "M",
            billOfMaterialVariant: oItem.BillOfMaterialVariant || "",
            billOfMaterialVariantUsage:
              oItem.BillOfMaterialVariantUsage ||
              Constants.BOM_USAGE,
            billOfMaterialVersion: oItem.BillOfMaterialVersion || "",
            headerChangeDocument: oItem.HeaderChangeDocument || "",

            material: oItem.Material || "",
            plant: oItem.Plant || "",

            bomHeaderQuantityInBaseUnit:
              oItem.BOMHeaderQuantityInBaseUnit !== undefined &&
              oItem.BOMHeaderQuantityInBaseUnit !== null
                ? oItem.BOMHeaderQuantityInBaseUnit
                : "",

            BOMHeaderQuantityInBaseUnit:
              oItem.BOMHeaderQuantityInBaseUnit !== undefined &&
              oItem.BOMHeaderQuantityInBaseUnit !== null
                ? oItem.BOMHeaderQuantityInBaseUnit
                : "",

            bomHeaderBaseUnit:
              oItem.BOMHeaderBaseUnit ||
              "",

            BOMHeaderBaseUnit:
              oItem.BOMHeaderBaseUnit ||
              "",

            headerValidityStartDate:
              oItem.HeaderValidityStartDate ||
              "",

            HeaderValidityStartDate:
              oItem.HeaderValidityStartDate ||
              "",

            bomVersionStatus:
              oItem.BOMVersionStatus ||
              "",

            BOMVersionStatus:
              oItem.BOMVersionStatus ||
              "",

            billOfMaterialItemNodeNumber:
              oItem.BillOfMaterialItemNodeNumber || "",

            originalItemNumber:
              oItem.BillOfMaterialItemNumber || "",

            isProductionRelevant:
              oItem.IsProductionRelevant === undefined
                ? true
                : !!oItem.IsProductionRelevant
          };
        });
      },

      _buildChangeHeaderData: function (oFirstItem, oRequest) {
        oFirstItem = oFirstItem || {};
        oRequest = oRequest || {};

        return {
          AppMode: Constants.APP_MODE.CHANGE,
          IsChangeMode: true,

          Material:
            oFirstItem.Material ||
            oRequest.Material ||
            "",

          Plant:
            oFirstItem.Plant ||
            oRequest.Plant ||
            "",

          PlantName:
            oRequest.PlantName ||
            "",

          PlantDisplay:
            oRequest.PlantDisplay ||
            this._formatPlantDisplay(
              oFirstItem.Plant ||
                oRequest.Plant ||
                "",
              oRequest.PlantName || ""
            ),

          BomUsage:
            oFirstItem.BillOfMaterialVariantUsage ||
            oRequest.BillOfMaterialVariantUsage ||
            Constants.BOM_USAGE,

          AltBom:
            oFirstItem.BillOfMaterialVariant ||
            oRequest.BillOfMaterialVariant ||
            "",

          BillOfMaterial:
            oFirstItem.BillOfMaterial ||
            oRequest.BillOfMaterial ||
            "",

          BillOfMaterialCategory:
            oFirstItem.BillOfMaterialCategory ||
            Constants.DEFAULTS.BILL_OF_MATERIAL_CATEGORY ||
            "M",

          BillOfMaterialVariant:
            oFirstItem.BillOfMaterialVariant ||
            oRequest.BillOfMaterialVariant ||
            "",

          BillOfMaterialVariantUsage:
            oFirstItem.BillOfMaterialVariantUsage ||
            oRequest.BillOfMaterialVariantUsage ||
            Constants.BOM_USAGE,

          BillOfMaterialVersion:
            oFirstItem.BillOfMaterialVersion ||
            "",

          HeaderChangeDocument:
            oFirstItem.HeaderChangeDocument ||
            "",

          BaseQty:
            oFirstItem.BOMHeaderQuantityInBaseUnit !== undefined &&
            oFirstItem.BOMHeaderQuantityInBaseUnit !== null
              ? String(oFirstItem.BOMHeaderQuantityInBaseUnit)
              : oFirstItem.BaseQty || "",

          BOMHeaderQuantityInBaseUnit:
            oFirstItem.BOMHeaderQuantityInBaseUnit !== undefined &&
            oFirstItem.BOMHeaderQuantityInBaseUnit !== null
              ? String(oFirstItem.BOMHeaderQuantityInBaseUnit)
              : oFirstItem.BaseQty || "",

          BaseUom:
            oFirstItem.BOMHeaderBaseUnit ||
            oFirstItem.BaseUom ||
            "",

          BOMHeaderBaseUnit:
            oFirstItem.BOMHeaderBaseUnit ||
            oFirstItem.BaseUom ||
            "",

          ValidFrom:
            this._formatDateForDisplay(
              oFirstItem.HeaderValidityStartDate ||
                oFirstItem.ValidFrom ||
                ""
            ),

          HeaderValidityStartDate:
            this._formatDateForDisplay(
              oFirstItem.HeaderValidityStartDate ||
                oFirstItem.ValidFrom ||
                ""
            ),

          BomStatus:
            oFirstItem.BOMVersionStatus ||
            oFirstItem.BomStatus ||
            Constants.BOM_STATUS,

          BOMVersionStatus:
            oFirstItem.BOMVersionStatus ||
            oFirstItem.BomStatus ||
            Constants.BOM_STATUS,

          BOMAlternativeText:
            oFirstItem.BOMAlternativeText ||
            oFirstItem.bomAlternativeText ||
            oFirstItem.BOMALTERNATIVETEXT ||
            oFirstItem.HeaderText ||
            "",

          HeaderText:
            oFirstItem.BOMAlternativeText ||
            oFirstItem.bomAlternativeText ||
            oFirstItem.BOMALTERNATIVETEXT ||
            oFirstItem.HeaderText ||
            "",

          IsValidated: true,
          Message: "BOM loaded for change.",
          MessageType: "Success",
          ShowMessage: true
        };
      },

      _enrichRequestWithPlantDisplay: async function (oRequest, oFirstItem) {
        var sPlant = this._toUpperTrim(
          (oFirstItem && oFirstItem.Plant) ||
            (oRequest && oRequest.Plant) ||
            ""
        );
        var sPlantName;

        oRequest = oRequest || {};

        if (!sPlant || oRequest.PlantDisplay) {
          return oRequest;
        }

        sPlantName = oRequest.PlantName || await this._getPlantNameByCode(sPlant);

        return Object.assign({}, oRequest, {
          Plant: sPlant,
          PlantName: sPlantName,
          PlantDisplay: this._formatPlantDisplay(sPlant, sPlantName)
        });
      },

      _getPlantNameByCode: async function (sPlant) {
        var oMatchedPlant;

        sPlant = this._toUpperTrim(sPlant);

        if (!sPlant) {
          return "";
        }

        try {
          await this._ensurePlantCacheLoaded();
        } catch (oError) {
          void oError;

          return "";
        }

        oMatchedPlant = (this._aPlantVHCache || []).find(
          function (oItem) {
            return this._toUpperTrim(oItem.Plant) === sPlant;
          }.bind(this)
        );

        return oMatchedPlant ? this._getPlantName(oMatchedPlant) : "";
      },

      _ensurePlantCacheLoaded: function () {
        if (this._aPlantVHCache && this._aPlantVHCache.length) {
          return Promise.resolve();
        }

        return ValueHelpService.loadPlantVHData(this).then(
          function (oPlantVHModel) {
            this._aPlantVHCache = this._getValueHelpRows(oPlantVHModel);
          }.bind(this)
        );
      },

      _formatDateForDisplay: function (vDate) {
        if (!vDate) {
          return "";
        }

        if (typeof vDate === "string") {
          return vDate;
        }

        if (vDate instanceof Date) {
          var sYear = String(vDate.getFullYear());
          var sMonth = String(vDate.getMonth() + 1).padStart(2, "0");
          var sDay = String(vDate.getDate()).padStart(2, "0");

          return sYear + "-" + sMonth + "-" + sDay;
        }

        return String(vDate);
      },

      onContinue: function () {
        var oChangeModel = this.getView().getModel("changeModel");

        if (!oChangeModel) {
          MessageBox.error("Change model is missing.");
          return;
        }

        var oData = oChangeModel.getData();

        if (
          !oData.CanContinue ||
          !oData.FetchedItems ||
          !oData.FetchedItems.length
        ) {
          MessageBox.error("Please fetch valid BOM components before continuing.");
          return;
        }

        this.getOwnerComponent().setModel(oChangeModel, "changeModel");

        this.getOwnerComponent()
          .getRouter()
          .navTo(Constants.ROUTES.CHANGE_ITEM);
      },

      onCancel: function () {
        this._initChangeModel();

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

    oChangeModel.setProperty("/CanContinue", false);
    oChangeModel.setProperty("/FetchedItems", []);
    oChangeModel.setProperty("/HeaderData", null);
    oChangeModel.setProperty("/SearchMode", "");

    that._clearMessage();
  });
},

     onPlantValueHelp: function () {
  var that = this;

  ValueHelpHelper.openPlantValueHelp(this, function (oData) {
    that._setPlantSelection(oData);

    var oChangeModel = that.getView().getModel("changeModel");
    oChangeModel.setProperty("/CanContinue", false);
    oChangeModel.setProperty("/FetchedItems", []);
    oChangeModel.setProperty("/HeaderData", null);
    oChangeModel.setProperty("/SearchMode", "");

    that._clearMessage();
  });
},

      _resolveMaterialFromValueHelp: function (sMaterial) {
        sMaterial = FormatterHelper.normalizeMaterialInput(sMaterial);

        if (!sMaterial) {
          return Promise.resolve(null);
        }

        return ValueHelpService.findMaterialRemote(this, sMaterial);
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

      _toBackendMaterial: function (sMaterial) {
        sMaterial = FormatterHelper.normalizeMaterialInput(sMaterial);

        if (/^\d+$/.test(sMaterial) && sMaterial.length < 18) {
          return new Array(18 - sMaterial.length + 1).join("0") + sMaterial;
        }

        return sMaterial;
      },

      _getRealBackendSortString: function (oItem) {
        if (!oItem) {
          return "";
        }

        var sPlant = this._cleanSortString(oItem.Plant || oItem.plant || "");

        var aPossibleSortStrings = [
          oItem.BOMItemSorter,
          oItem.BomItemSorter,
          oItem.bomItemSorter,
          oItem.BOMITEMSORTER,
          oItem.SortString,
          oItem.sortString,
          oItem.sortStringValue,
          oItem.Zcomb,
          oItem.ZCOMB,
          oItem.zcomb
        ];

        for (var i = 0; i < aPossibleSortStrings.length; i++) {
          var sSortString = this._cleanSortString(aPossibleSortStrings[i] || "");

          if (!sSortString) {
            continue;
          }

          if (sPlant && sSortString === sPlant) {
            continue;
          }

          return sSortString;
        }

        return "";
      },

      _cleanSortString: function (sSortString) {
        return String(sSortString || "").trim().toUpperCase();
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

  this._requestMaterialSuggestions(sDisplayValue);

  this._clearFetchedData();
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

  sMaterial = this._toDisplayMaterial(sMaterial);

  oChangeModel.setProperty("/Material", sMaterial);
  oChangeModel.setProperty("/BackendMaterial", this._toBackendMaterial(sMaterial));
  oChangeModel.setProperty("/BomUsage", Constants.BOM_USAGE || "1");

  this._clearFetchedData();
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

_requestMaterialSuggestions: function (sValue) {
  var that = this;
  var sSearch = String(sValue || "").trim();
  var oSuggestionModel = this.getView().getModel("materialSuggestModel");
  var iRequestId = (this._iMaterialSuggestRequest || 0) + 1;

  this._iMaterialSuggestRequest = iRequestId;

  clearTimeout(this._iMaterialSuggestTimer);

  if (!sSearch) {
    oSuggestionModel.setProperty("/items", []);
    return;
  }

  this._iMaterialSuggestTimer = setTimeout(function () {
    ValueHelpService.searchMaterialVHData(that, sSearch, "", 0, 20)
      .then(function (oResultModel) {
        if (that._iMaterialSuggestRequest !== iRequestId) {
          return;
        }
        oSuggestionModel.setProperty(
          "/items",
          oResultModel.getProperty("/items") || []
        );
      })
      .catch(function () {
        oSuggestionModel.setProperty("/items", []);
      });
  }, 300);
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

  return ValueHelpService.searchMaterialVHData(this, sSearch, "", 0, 50).then(
    function (oResultModel) {
      var aMatches = oResultModel.getProperty("/items") || [];
      var oMatched = aMatches[0];
      var sProduct = oMatched
        ? this._toDisplayMaterial(oMatched.Product || "")
        : "";

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
  return Promise.resolve();
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

  sValue = this._extractPlantCode(oInput.getValue());

  oInput.setValue(sValue);

  oChangeModel.setProperty("/Plant", sValue);
  oChangeModel.setProperty("/PlantName", "");
  oChangeModel.setProperty("/PlantDisplay", sValue);
  oChangeModel.setProperty("/BomUsage", Constants.BOM_USAGE || "1");

  this.getView()
    .getModel("plantSuggestModel")
    .setProperty("/items", this._filterPlantSuggestions(sValue));

  this._clearFetchedData();
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

  if (!oData) {
    oData = {
      Plant: sPlant,
      PlantName: ""
    };
  }

  this._setPlantSelection(oData);

  this._clearFetchedData();
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

_setPlantSelection: function (oData) {
  var oChangeModel = this.getView().getModel("changeModel");
  var sPlant = this._toUpperTrim(oData && oData.Plant);
  var sPlantName = this._getPlantName(oData || {});

  if (!oChangeModel) {
    return;
  }

  oChangeModel.setProperty("/Plant", sPlant);
  oChangeModel.setProperty("/PlantName", sPlantName);
  oChangeModel.setProperty(
    "/PlantDisplay",
    this._formatPlantDisplay(sPlant, sPlantName)
  );
  oChangeModel.setProperty("/BomUsage", Constants.BOM_USAGE || "1");
},

_looksLikeMaterialCode: function (sValue) {
  sValue = String(sValue || "").trim();

  return !!sValue;
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
