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

        this.getOwnerComponent()
          .getRouter()
          .getRoute(Constants.ROUTES.CHANGE)
          .attachPatternMatched(this._onRouteMatched, this);
      },

      _onRouteMatched: function () {
        this._initChangeModel();
      },

      _initChangeModel: function () {
        var oChangeModel = new JSONModel(this._getDefaultChangeData());

        this.getView().setModel(oChangeModel, "changeModel");
        this.getOwnerComponent().setModel(oChangeModel, "changeModel");
      },

      _getDefaultChangeData: function () {
        return {
          Material: "",
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
          MessageType: Constants.DEFAULTS.MESSAGE_TYPE || "Information",
          ShowMessage: false
        };
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
        var oData = oChangeModel.getData();

        if (!oData.Material || !oData.Plant || !oData.AltBom) {
          MessageBox.error("Please enter Material, Plant and Alternative BOM.");
          return;
        }

        try {
          BusyIndicator.show(0);

          var sBackendMaterial = await this._resolveBackendMaterial(
            oData.Material
          );

          oChangeModel.setProperty("/Material", sBackendMaterial);
          oChangeModel.setProperty("/BomUsage", Constants.BOM_USAGE || "1");

          await this._fetchBomChangeItems({
            searchMode: Constants.SEARCH_MODE.MATERIAL,
            Material: sBackendMaterial,
            Plant: String(oData.Plant || "").trim(),
            BillOfMaterialVariantUsage: Constants.BOM_USAGE || "1",
            BillOfMaterialVariant: String(oData.AltBom || "").trim()
          });
        } catch (oError) {
          this._setMessage(this._getErrorText(oError), "Error");
          MessageBox.error(this._getErrorText(oError));
        } finally {
          BusyIndicator.hide();
        }
      },

      onGetBOMByNumber: async function () {
        var oChangeModel = this.getView().getModel("changeModel");
        var oData = oChangeModel.getData();

        if (!oData.BillOfMaterial || !oData.BomNumberAltBom) {
          MessageBox.error("Please enter BOM Number and Alternative BOM.");
          return;
        }

        try {
          BusyIndicator.show(0);

          oChangeModel.setProperty("/BomUsage", Constants.BOM_USAGE || "1");

          await this._fetchBomChangeItems({
            searchMode: Constants.SEARCH_MODE.BOM,
            BillOfMaterial: String(oData.BillOfMaterial || "").trim(),
            BillOfMaterialVariantUsage: Constants.BOM_USAGE || "1",
            BillOfMaterialVariant: String(oData.BomNumberAltBom || "").trim()
          });
        } catch (oError) {
          this._setMessage(this._getErrorText(oError), "Error");
          MessageBox.error(this._getErrorText(oError));
        } finally {
          BusyIndicator.hide();
        }
      },

      _fetchBomChangeItems: async function (oRequest) {
        var oModel = this.getOwnerComponent().getModel();
        var oChangeModel = this.getView().getModel("changeModel");

        this._setMessage("Fetching BOM components...", "Information");

        var aItems = await this._readBomChangeItems(oModel, oRequest);

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
        var oHeaderData = this._buildChangeHeaderData(aItems[0], oRequest);

        oChangeModel.setProperty("/FetchedItems", aRows);
        oChangeModel.setProperty("/HeaderData", oHeaderData);
        oChangeModel.setProperty("/SearchMode", oRequest.searchMode);
        oChangeModel.setProperty("/CanContinue", true);

        this.getOwnerComponent().setModel(oChangeModel, "changeModel");

        this._setMessage(
          aRows.length +
            " BOM component(s) fetched successfully. Click Continue.",
          "Success"
        );

        MessageToast.show(aRows.length + " BOM component(s) fetched.");
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

            description:
              oItem.BOMItemDescription ||
              oItem.ProductDescription ||
              oItem.ComponentDescription ||
              oItem.ItemText ||
              "",

            quantity:
              oItem.BillOfMaterialItemQuantity !== undefined &&
              oItem.BillOfMaterialItemQuantity !== null
                ? FormatterHelper.formatQuantityForDisplay(
                    oItem.BillOfMaterialItemQuantity
                  )
                : "",

            uom: oItem.BillOfMaterialItemUnit || oItem.Uom || "",

            sortString:
              oItem.BOMItemSorter ||
              oItem.SortString ||
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

            bomHeaderBaseUnit:
              oItem.BOMHeaderBaseUnit ||
              "",

            headerValidityStartDate:
              oItem.HeaderValidityStartDate ||
              "",

            bomVersionStatus:
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

          BaseUom:
            oFirstItem.BOMHeaderBaseUnit ||
            oFirstItem.BaseUom ||
            "",

          ValidFrom:
            this._formatDateForDisplay(
              oFirstItem.HeaderValidityStartDate ||
                oFirstItem.ValidFrom ||
                ""
            ),

          BomStatus:
            oFirstItem.BOMVersionStatus ||
            oFirstItem.BomStatus ||
            Constants.BOM_STATUS,

          IsValidated: true,
          Message: "BOM loaded for change.",
          MessageType: "Success",
          ShowMessage: true
        };
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
          .navTo(Constants.ROUTES.HEADER || "RouteView1");
      },

      onMaterialValueHelp: function () {
        var that = this;

        ValueHelpHelper.openMaterialValueHelp(this, function (oData) {
          var oChangeModel = that.getView().getModel("changeModel");

          oChangeModel.setProperty("/Material", oData.Product || "");
          oChangeModel.setProperty("/CanContinue", false);
          oChangeModel.setProperty("/FetchedItems", []);
          oChangeModel.setProperty("/HeaderData", null);

          that._clearMessage();
        });
      },

      onPlantValueHelp: function () {
        var that = this;

        ValueHelpHelper.openPlantValueHelp(this, function (oData) {
          var oChangeModel = that.getView().getModel("changeModel");

          oChangeModel.setProperty("/Plant", oData.Plant || "");
          oChangeModel.setProperty("/CanContinue", false);
          oChangeModel.setProperty("/FetchedItems", []);
          oChangeModel.setProperty("/HeaderData", null);

          that._clearMessage();
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