/* global Promise */

sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator",
    "zppbomautomation/config/Constants",
    "zppbomautomation/model/HeaderModel",
    "zppbomautomation/model/ItemModel",
    "zppbomautomation/model/ResultModel",
    "zppbomautomation/service/BomActionService",
    "zppbomautomation/service/ItemScreenService",
    "zppbomautomation/util/ItemValueHelpHelper",
    "zppbomautomation/util/ErrorHelper"
  ],
  function (
    Controller,
    History,
    MessageToast,
    MessageBox,
    BusyIndicator,
    Constants,
    HeaderModel,
    ItemModel,
    ResultModel,
    BomActionService,
    ItemScreenService,
    ItemValueHelpHelper,
    ErrorHelper
  ) {
    "use strict";

    return Controller.extend("zppbomautomation.controller.BOMItem", {
      onInit: function () {
        ItemModel.init(this.getOwnerComponent(), this.getView());
        ResultModel.init(this.getView());

        this._sSortStringVHMaterial = "";
        this._oSortStringVHModel = null;
        this._oCurrentComponentContext = null;
        this._oCurrentSortStringContext = null;

        this.getOwnerComponent()
          .getRouter()
          .getRoute(Constants.ROUTES.ITEM)
          .attachPatternMatched(this._onRouteMatched, this);
      },

      _onRouteMatched: async function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

        if (!oHeaderModel) {
          this.getOwnerComponent()
            .getRouter()
            .navTo(Constants.ROUTES.HEADER, {}, true);
          return;
        }

        this.getView().setModel(oHeaderModel, "headerModel");

        var oItemModel = ItemModel.init(
          this.getOwnerComponent(),
          this.getView()
        );

        ResultModel.reset(this.getView().getModel("resultModel"));

        var aItems = oItemModel.getProperty("/items") || [];

        if (aItems.length === 0) {
          this.onAddRow();
          return;
        }

        await this._fillCopiedAlternateBomDetails();
      },

      onNavBack: function () {
        var oResultModel = this.getView().getModel("resultModel");
        var sStatus = oResultModel ? oResultModel.getProperty("/Status") : "";

        if (sStatus === "SUCCESS") {
          this._clearBomDraftData();

          this.getOwnerComponent().getRouter().navTo(
            Constants.ROUTES.HEADER,
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
          this.getOwnerComponent()
            .getRouter()
            .navTo(Constants.ROUTES.HEADER, {}, true);
        }
      },

      onAddRow: function () {
        var oItemModel = ItemModel.init(
          this.getOwnerComponent(),
          this.getView()
        );

        ItemModel.addRow(oItemModel);
      },

      onDelete: function () {
        var oTable = this.byId("bomItemsTable");
        var oItemModel = this.getOwnerComponent().getModel("itemModel");
        var aSelectedItems = oTable.getSelectedItems();

        if (aSelectedItems.length === 0) {
          MessageToast.show("Please select items to delete");
          return;
        }

        var aIndexesToDelete = aSelectedItems.map(function (oItem) {
          return oTable.indexOfItem(oItem);
        });

        ItemModel.deleteIndexes(oItemModel, aIndexesToDelete);

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

        oInput.setValue(
          ItemScreenService.sanitizeQuantity(oInput.getValue() || "")
        );
      },

      onQuantityChange: function (oEvent) {
        var oInput = oEvent.getSource();
        var sValue = oInput.getValue() || "";

        if (!sValue) {
          return;
        }

        if (!ItemScreenService.isValidQuantityDecimal(sValue)) {
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

          ResultModel.setCreating(oResultModel);

          BusyIndicator.show(0);

          var oResponse = await BomActionService.createBom(
            this.getOwnerComponent().getModel(),
            oPayload
          );

          this._handleCreateResponse(oResponse);
        } catch (oError) {
          var sErrorText = this._getErrorText(oError);

          ResultModel.setError(oResultModel, sErrorText);

          MessageBox.error(sErrorText);
        } finally {
          BusyIndicator.hide();
        }
      },

      _validateBeforeSaveAsync: async function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var oHeader = oHeaderModel ? oHeaderModel.getData() : null;

        var oItemModel = this.getOwnerComponent().getModel("itemModel");
        var aItems = oItemModel ? oItemModel.getProperty("/items") || [] : [];

        var oValidation = ItemScreenService.validateBeforeSave(oHeader, aItems);

        if (!oValidation.valid) {
          return oValidation;
        }

        var sPlant = oHeader.Plant;
        var oODataModel = this.getOwnerComponent().getModel();

        for (var i = 0; i < aItems.length; i++) {
          var oItem = aItems[i];

          var sExistingSortString = this._getCopiedBomSortString(oItem);

          var sComponent = await this._resolveBackendComponent(
            oItem.component,
            sPlant
          );

          var oCheckResult =
            await ItemScreenService.checkComponentPlantExtension(
              oODataModel,
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

          oItem.component = this._toBackendMaterial(
            oCheckResult.component || sComponent
          );

          oItem.description = oCheckResult.description || "";
          oItem.uom = oCheckResult.uom || "";
          oItem.sortString = sExistingSortString;
        }

        ItemModel.setItems(oItemModel, aItems);

        return {
          valid: true,
          message: ""
        };
      },

      _buildBomCreatePayload: function () {
        var oHeader = this.getOwnerComponent()
          .getModel("headerModel")
          .getData();

        var oItemModel = this.getOwnerComponent().getModel("itemModel");
        var aItems = oItemModel ? oItemModel.getProperty("/items") || [] : [];

        aItems.forEach(
          function (oItem) {
            oItem.component = this._toBackendMaterial(oItem.component);
            oItem.sortString = this._getCopiedBomSortString(oItem);
          }.bind(this)
        );

        ItemModel.setItems(oItemModel, aItems);

        return ItemScreenService.buildBomCreatePayload(oHeader, aItems);
      },

      _handleCreateResponse: function (oResponse) {
        var oResultModel = this.getView().getModel("resultModel");

        var sBillOfMaterial = ItemScreenService.extractBillOfMaterial(
          oResponse.ApiResponse
        );

        ResultModel.applyCreateResponse(
          oResultModel,
          oResponse,
          sBillOfMaterial
        );

        if (oResponse.Status === "SUCCESS") {
          var sSuccessMessage = sBillOfMaterial
            ? "BOM created successfully. BOM Number: " + sBillOfMaterial
            : oResponse.Message || "BOM created successfully.";

          MessageBox.success(sSuccessMessage);
          return;
        }

        if (oResponse.Status === "ERROR") {
          MessageBox.error(oResponse.Message || "BOM creation failed.");
          return;
        }

        MessageBox.warning(
          oResponse.Message ||
            "BOM request saved, but final status is not SUCCESS."
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
                  Constants.ROUTES.HEADER,
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
          Constants.ROUTES.HEADER,
          {
            "?query": {}
          },
          true
        );
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
        var sComponentInput = String(oInput.getValue() || "").trim();

        var oItemModel = oContext.getModel();
        var sPath = oContext.getPath();

        if (!sComponentInput) {
          oItemModel.setProperty(sPath + "/component", "");
          oItemModel.setProperty(sPath + "/description", "");
          oItemModel.setProperty(sPath + "/uom", "");
          oItemModel.setProperty(sPath + "/sortString", "");
          return;
        }

        if (!sPlant) {
          MessageBox.warning("Please select Plant first.");
          return;
        }

        var sComponent = await this._resolveBackendComponent(
          sComponentInput,
          sPlant
        );

        oInput.setValue(sComponent);

        oItemModel.setProperty(sPath + "/component", sComponent);
        oItemModel.setProperty(sPath + "/description", "");
        oItemModel.setProperty(sPath + "/uom", "");
        oItemModel.setProperty(sPath + "/sortString", "");

        var bValid = await ItemScreenService.fillComponentDetails(
          this.getOwnerComponent().getModel(),
          oContext,
          sComponent,
          sPlant
        );

        if (!bValid) {
          MessageBox.warning(
            "Component " +
              sComponent +
              " is not available in Plant " +
              sPlant +
              "."
          );
        }
      },

      _fillCopiedAlternateBomDetails: async function () {
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var sPlant = oHeaderModel ? oHeaderModel.getProperty("/Plant") : "";

        var oItemModel = this.getOwnerComponent().getModel("itemModel");
        var aItems = oItemModel ? oItemModel.getProperty("/items") || [] : [];

        if (!sPlant || !aItems.length) {
          return;
        }

        var oODataModel = this.getOwnerComponent().getModel();

        for (var i = 0; i < aItems.length; i++) {
          var oItem = aItems[i];

          if (!oItem.component) {
            continue;
          }

          var sExistingSortString = this._getCopiedBomSortString(oItem);

          var sComponent = await this._resolveBackendComponent(
            oItem.component,
            sPlant
          );

          oItem.component = sComponent;

          if (!oItem.description || !oItem.uom) {
            oItem.description = "";
            oItem.uom = "";

            var oResult = await ItemScreenService.checkComponentPlantExtension(
              oODataModel,
              sComponent,
              sPlant
            );

            if (oResult.valid) {
              oItem.component = this._toBackendMaterial(
                oResult.component || sComponent
              );
              oItem.description = oResult.description || "";
              oItem.uom = oResult.uom || "";
            }
          }

          oItem.sortString = sExistingSortString;
        }

        ItemModel.setItems(oItemModel, aItems);
      },

      _getCopiedBomSortString: function (oItem) {
        if (!oItem) {
          return "";
        }

        return String(
          oItem.sortString ||
            oItem.SortString ||
            oItem.BOMItemSorter ||
            oItem.BomItemSorter ||
            oItem.bomItemSorter ||
            oItem.Zcomb ||
            oItem.ZCOMB ||
            oItem.zcomb ||
            ""
        )
          .trim()
          .toUpperCase();
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

      _openComponentValueHelp: function () {
        var that = this;
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var sPlant = oHeaderModel ? oHeaderModel.getProperty("/Plant") : "";

        if (!sPlant) {
          MessageBox.warning("Please select Plant first.");
          return;
        }

        ItemScreenService.loadComponentVHData(this, sPlant)
          .then(function (oLocalModel) {
            ItemValueHelpHelper.openComponentValueHelp(
              that,
              oLocalModel,
              function (oData) {
                that._applyComponentSelection(oData);
              }
            );
          })
          .catch(function (oError) {
            MessageBox.error(that._getErrorText(oError));
          });
      },

      _applyComponentSelection: function (oData) {
        var oContext = this._oCurrentComponentContext;

        if (!oContext) {
          MessageBox.error("Could not determine selected item row.");
          return;
        }

        var oItemModel = oContext.getModel();
        var sPath = oContext.getPath();

        var sComponent = this._toBackendMaterial(
          this._getComponentValue(oData)
        );

        oItemModel.setProperty(sPath + "/component", sComponent);
        oItemModel.setProperty(
          sPath + "/description",
          ItemScreenService.getComponentDescription(oData)
        );
        oItemModel.setProperty(
          sPath + "/uom",
          ItemScreenService.getComponentUom(oData)
        );
        oItemModel.setProperty(sPath + "/sortString", "");
      },

      onSortStringValueHelp: function (oEvent) {
        var oInput = oEvent.getSource();

        this._oCurrentSortStringContext = oInput.getBindingContext("itemModel");

        if (!this._oCurrentSortStringContext) {
          MessageBox.error("Could not determine selected item row.");
          return;
        }

        this._openSortStringValueHelp();
      },

      onSortStringChange: function (oEvent) {
        var oInput = oEvent.getSource();
        var oContext = oInput.getBindingContext("itemModel");
        var sValue = String(oInput.getValue() || "").trim().toUpperCase();

        oInput.setValue(sValue);

        if (oContext) {
          oContext
            .getModel()
            .setProperty(oContext.getPath() + "/sortString", sValue);
        }
      },

      _openSortStringValueHelp: function () {
        var that = this;
        var oContext = this._oCurrentSortStringContext;

        if (!oContext) {
          MessageBox.error("Could not determine selected item row.");
          return;
        }

        var oItem = oContext.getObject ? oContext.getObject() : null;
        var sComponent = oItem ? oItem.component : "";

        sComponent = this._toBackendMaterial(sComponent);

        if (!sComponent) {
          MessageBox.warning("Please enter/select component first.");
          return;
        }

        BusyIndicator.show(0);

        ItemScreenService.loadSortStringVHData(this, sComponent)
          .then(function (oLocalModel) {
            var aItems = oLocalModel.getProperty("/items") || [];

            if (!aItems.length) {
              MessageBox.warning(
                "No sort string found for component " + sComponent + "."
              );
              return;
            }

            ItemValueHelpHelper.openSortStringValueHelp(
              that,
              oLocalModel,
              function (aSelectedZcomb) {
                that._applySortStringSelectionsToRow(aSelectedZcomb);
              }
            );
          })
          .catch(function (oError) {
            MessageBox.error(that._getErrorText(oError));
          })
          .finally(function () {
            BusyIndicator.hide();
          });
      },

      _applySortStringSelectionsToRow: function (aSelectedZcomb) {
        var oContext = this._oCurrentSortStringContext;

        if (!oContext) {
          MessageBox.error("Could not determine selected item row.");
          return;
        }

        var bApplied = ItemModel.applySortStringSelections(
          oContext.getModel(),
          oContext.getPath(),
          aSelectedZcomb
        );

        if (!bApplied) {
          MessageBox.error("Could not determine selected item row.");
        }
      },

      _resolveBackendComponent: function (sComponent, sPlant) {
        var sInputComponent = this._normalizeMaterialInput(sComponent);

        if (!sInputComponent) {
          return Promise.resolve("");
        }

        if (!sPlant) {
          return Promise.resolve(this._toBackendMaterial(sInputComponent));
        }

        return ItemScreenService.loadComponentVHData(this, sPlant)
          .then(
            function (oLocalModel) {
              var oMatchedComponent = this._findComponentInValueHelp(
                sInputComponent,
                oLocalModel
              );

              if (oMatchedComponent) {
                return this._toBackendMaterial(
                  this._getComponentValue(oMatchedComponent)
                );
              }

              return this._toBackendMaterial(sInputComponent);
            }.bind(this)
          )
          .catch(
            function () {
              return this._toBackendMaterial(sInputComponent);
            }.bind(this)
          );
      },

      _findComponentInValueHelp: function (sComponent, oLocalModel) {
        var sSearch = this._normalizeMaterialInput(sComponent).toUpperCase();
        var aItems = oLocalModel ? oLocalModel.getProperty("/items") || [] : [];

        if (!sSearch || !aItems.length) {
          return null;
        }

        return (
          aItems.find(
            function (oItem) {
              var sValue = this._normalizeMaterialInput(
                this._getComponentValue(oItem)
              ).toUpperCase();

              if (sValue === sSearch) {
                return true;
              }

              if (/^\d+$/.test(sSearch) && /^\d+$/.test(sValue)) {
                return (
                  sValue.replace(/^0+/, "") ===
                  sSearch.replace(/^0+/, "")
                );
              }

              return false;
            }.bind(this)
          ) || null
        );
      },

      _getComponentValue: function (oData) {
        if (!oData) {
          return "";
        }

        return (
          oData.component ||
          oData.Component ||
          oData.Product ||
          oData.Material ||
          oData.BillOfMaterialComponent ||
          ""
        );
      },

      _normalizeMaterialInput: function (sMaterial) {
        return String(sMaterial || "").trim();
      },

      _toBackendMaterial: function (sMaterial) {
        sMaterial = this._normalizeMaterialInput(sMaterial);

        if (/^\d+$/.test(sMaterial) && sMaterial.length < 18) {
          return new Array(18 - sMaterial.length + 1).join("0") + sMaterial;
        }

        return sMaterial;
      },

      _clearBomDraftData: function () {
        ItemValueHelpHelper.clearSortStringCache(this);

        HeaderModel.reset(this.getOwnerComponent().getModel("headerModel"));
        ItemModel.reset(this.getOwnerComponent().getModel("itemModel"));
        ResultModel.reset(this.getView().getModel("resultModel"));
      },

      _getErrorText: function (oError) {
        return ErrorHelper.getErrorText(oError);
      }
    });
  }
);