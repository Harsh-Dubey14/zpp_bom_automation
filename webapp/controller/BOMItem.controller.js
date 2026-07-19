/* global Promise */
/* eslint-disable max-params */

sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator",
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
    "zppbomautomation/model/ResultModel",
    "zppbomautomation/service/BomActionService",
    "zppbomautomation/service/ItemScreenService",
    "zppbomautomation/util/ItemValueHelpHelper",
    "zppbomautomation/util/ErrorHelper"
  ],
  function (
    Controller,
    MessageToast,
    MessageBox,
    BusyIndicator,
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
  this._oCurrentUomContext = null;
  this._oUomVHDialog = null;
  this._bSaveInProgress = false;

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

  /*
   * Do not call backend again for copied BOM items.
   * GetAlternateBOMItems should already return:
   * component, description, normalized UOM, sort string.
   */
  ItemModel.setItems(oItemModel, aItems);
},

   onNavBack: function () {
  var that = this;

  MessageBox.warning(
    "Are you sure you want to go back? All item data will be lost.",
    {
      actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
      emphasizedAction: MessageBox.Action.OK,

      onClose: function (sAction) {
        if (sAction === MessageBox.Action.OK) {
          that._goToFreshHeaderScreen();
        }
      }
    }
  );
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
  var oHeaderPanel = this.byId("headerForm");
  if (oHeaderPanel) {
    oHeaderPanel.setExpanded(true);
  }

  if (this._bSaveInProgress) {
    MessageToast.show("Posting is already in progress. Please wait.");
    return;
  }

  this._bSaveInProgress = true;

  if (oResultModel) {
    oResultModel.setProperty("/CanSave", false);
    oResultModel.setProperty("/Editable", false);
    oResultModel.setProperty("/Status", "PROCESSING");
    oResultModel.setProperty("/StatusState", "Warning");
    oResultModel.setProperty("/Message", "Posting BOM...");
    oResultModel.setProperty("/MessageType", "Information");
    oResultModel.setProperty("/ShowMessage", true);
  }

  BusyIndicator.show(0);

  try {
    var oValidation = await this._validateBeforeSaveAsync();

    if (!oValidation.valid) {
      throw {
        message: oValidation.message
      };
    }

    var oPayload = this._buildBomCreatePayload();

    var oResponse = await BomActionService.createBom(
      this.getOwnerComponent().getModel(),
      oPayload
    );

    this._handleCreateResponse(oResponse);
  } catch (oError) {
    var sErrorText = this._getErrorText(oError);

    ResultModel.setError(oResultModel, sErrorText);

    if (oResultModel) {
      oResultModel.setProperty("/CanSave", true);
      oResultModel.setProperty("/Editable", true);
    }

    MessageBox.error(sErrorText);
  } finally {
    BusyIndicator.hide();
    this._bSaveInProgress = false;
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

  /*
   * No row-by-row backend validation here.
   * Component plant validation should happen when user selects component
   * from value help or when backend create API validates/posting happens.
   *
   * For copied BOM items, GetAlternateBOMItems already gives:
   * component + description + normalized UOM + sort string.
   */
  aItems.forEach(
    function (oItem) {
      oItem.component = this._toBackendMaterial(oItem.component);
      oItem.uom = String(oItem.uom || "").trim().toUpperCase();
      oItem.sortString = this._getCopiedBomSortString(oItem);
    }.bind(this)
  );

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
      oItem.uom = String(oItem.uom || "").trim().toUpperCase();
      oItem.sortString = this._getCopiedBomSortString(oItem);
    }.bind(this)
  );

  ItemModel.setItems(oItemModel, aItems);

  return ItemScreenService.buildBomCreatePayload(oHeader, aItems);
},

     _handleCreateResponse: function (oResponse) {
  var oResultModel = this.getView().getModel("resultModel");
  var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

  var sBillOfMaterial = ItemScreenService.extractBillOfMaterial(
    oResponse.ApiResponse
  );

  var sAltBom = "";

  if (oHeaderModel) {
    sAltBom = String(oHeaderModel.getProperty("/AltBom") || "").trim();
  }

  /*
   * Fallbacks in case backend response contains alternate BOM.
   */
  if (!sAltBom) {
    sAltBom = String(
      oResponse.AltBom ||
      oResponse.NextAltBom ||
      oResponse.BillOfMaterialVariant ||
      ""
    ).trim();
  }

  ResultModel.applyCreateResponse(
    oResultModel,
    oResponse,
    sBillOfMaterial
  );

  if (oResponse.Status === "SUCCESS") {
    var sSuccessMessage = "BOM created successfully.";

    if (sBillOfMaterial) {
      sSuccessMessage += "\nBOM Number: " + sBillOfMaterial;
    }

    if (sAltBom) {
      sSuccessMessage += "\nAlternate BOM: " + sAltBom;
    }

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
          that._goToFreshHeaderScreen();
        }
      }
    }
  );
},

      onNewBOM: function () {
  this._goToFreshHeaderScreen();
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
  var oItemModel = this.getOwnerComponent().getModel("itemModel");
  var aItems = oItemModel ? oItemModel.getProperty("/items") || [] : [];

  if (!aItems.length) {
    return;
  }

  aItems.forEach(
    function (oItem) {
      oItem.component = this._toBackendMaterial(oItem.component);
      oItem.description =
        oItem.description ||
        oItem.ComponentDescription ||
        oItem.componentDescription ||
        oItem.ProductDescription ||
        oItem.Description ||
        "";

      oItem.uom = String(oItem.uom || "").trim().toUpperCase();
      oItem.sortString = this._getCopiedBomSortString(oItem);
    }.bind(this)
  );

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

      onComponentSuggest: function (oEvent) {
        var that = this;
        var sQuery = String(oEvent.getParameter("suggestValue") || "")
          .trim()
          .toUpperCase();
        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var sPlant = oHeaderModel ? oHeaderModel.getProperty("/Plant") : "";

        if (!sPlant) {
          this.getView().setModel(new JSONModel({ items: [] }), "componentSuggestModel");
          return;
        }

        ItemScreenService.loadComponentVHData(this, sPlant).then(function (oModel) {
          var aItems = (oModel.getProperty("/items") || []).filter(function (oItem) {
            var sComponent = String(oItem.component || "").toUpperCase();
            var sDescription = ItemScreenService.getComponentDescription(oItem).toUpperCase();
            return !sQuery || sComponent.indexOf(sQuery) !== -1 || sDescription.indexOf(sQuery) !== -1;
          }).slice(0, 50);

          that.getView().setModel(new JSONModel({ items: aItems }), "componentSuggestModel");
        }).catch(function () {
          that.getView().setModel(new JSONModel({ items: [] }), "componentSuggestModel");
        });
      },

      onComponentSuggestionSelected: function (oEvent) {
        var oRow = oEvent.getParameter("selectedRow");
        var oData = oRow && oRow.getBindingContext("componentSuggestModel")
          ? oRow.getBindingContext("componentSuggestModel").getObject()
          : null;

        if (!oData) {
          return;
        }

        this._oCurrentComponentContext = oEvent.getSource().getBindingContext("itemModel");
        this._applyComponentSelection(oData);
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


      onUomManualInputBlock: function (oEvent) {
        var oInput = oEvent.getSource();
        var oContext = oInput.getBindingContext("itemModel");
        var sCurrentUom = "";

        if (oContext) {
          sCurrentUom = oContext.getProperty("uom") || "";
        }

        oInput.setValue(sCurrentUom);
        MessageToast.show("Please select UoM from value help.");
      },

      onUomValueHelp: function (oEvent) {
        var oInput = oEvent.getSource();

        this._oCurrentUomContext = oInput.getBindingContext("itemModel");

        if (!this._oCurrentUomContext) {
          MessageBox.error("Could not determine selected item row.");
          return;
        }

        this._openUomValueHelp();
      },

      _openUomValueHelp: function () {
        var oContext = this._oCurrentUomContext;
        var oItem;
        var sComponent;

        if (!oContext) {
          MessageBox.error("Could not determine selected item row.");
          return;
        }

        oItem = oContext.getObject();
        sComponent = this._toBackendMaterial(oItem.component || "");

        if (!sComponent) {
          MessageBox.warning("Please select Component first.");
          return;
        }

        BusyIndicator.show(0);

        this._loadUomValueHelpData(sComponent)
          .then(
            function (oLocalModel) {
              var aItems = oLocalModel.getProperty("/items") || [];

              if (!aItems.length) {
                MessageBox.warning("No UoM found for component " + sComponent + ".");
                return;
              }

              this._openUomValueHelpDialog(oLocalModel);
            }.bind(this)
          )
          .catch(
            function (oError) {
              MessageBox.error(this._getErrorText(oError));
            }.bind(this)
          )
          .finally(function () {
            BusyIndicator.hide();
          });
      },

      _loadUomValueHelpData: function (sComponent) {
        var oODataModel = this.getOwnerComponent().getModel();

        return new Promise(function (resolve, reject) {
          var oListBinding = oODataModel.bindList(
            "/produtuom",
            undefined,
            undefined,
            [
              new Filter("Product", FilterOperator.EQ, sComponent)
            ],
            {
              $select: "Product,AlternativeUnit,BaseUnit"
            }
          );

          oListBinding
            .requestContexts(0, 5000)
            .then(function (aContexts) {
              var aResults = aContexts.map(function (oContext) {
                var oData = oContext.getObject();

                return {
                  Product: oData.Product || "",
                  AlternativeUnit: oData.AlternativeUnit || "",
                  BaseUnit: oData.BaseUnit || ""
                };
              });

              resolve(
                new JSONModel({
                  items: aResults
                })
              );
            })
            .catch(function (oError) {
              reject(oError);
            });
        });
      },

     _openUomValueHelpDialog: function (oLocalModel) {
  if (!this._oUomVHDialog) {
    this._oUomVHDialog = new TableSelectDialog({
      title: "Select UoM",
      noDataText: "No UoM found",
      growing: true,
      growingThreshold: 20,
      multiSelect: false,

      /*
       * This controls only the popup size,
       * not the UoM input field size.
       */
      contentWidth: "38rem",
      contentHeight: "28rem",
      stretch: false,

      columns: [
        new Column({
          width: "12rem",
          header: new Text({
            text: "Product"
          })
        }),

        new Column({
          width: "12rem",
          header: new Text({
            text: "Alternative Unit"
          })
        }),

        new Column({
          width: "10rem",
          header: new Text({
            text: "Base Unit"
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
                new Filter("Product", FilterOperator.Contains, sValue),
                new Filter("AlternativeUnit", FilterOperator.Contains, sValue),
                new Filter("BaseUnit", FilterOperator.Contains, sValue)
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
        var sUom;

        if (!oSelectedItem || !this._oCurrentUomContext) {
          return;
        }

        oContext = oSelectedItem.getBindingContext("uomVHModel");

        if (!oContext) {
          return;
        }

        oData = oContext.getObject();

        /*
         * Pick AlternativeUnit only.
         */
        sUom = String(oData.AlternativeUnit || "").trim().toUpperCase();

        if (!sUom) {
          MessageBox.warning("Selected row does not contain Alternative Unit.");
          return;
        }

        this._oCurrentUomContext
          .getModel()
          .setProperty(this._oCurrentUomContext.getPath() + "/uom", sUom);
      }.bind(this)
    });

    this._oUomVHDialog.bindAggregation("items", {
      path: "uomVHModel>/items",
      template: new ColumnListItem({
        type: "Active",
        cells: [
          new Text({
            text: "{uomVHModel>Product}"
          }),

          new Text({
            text: "{uomVHModel>AlternativeUnit}"
          }),

          new Text({
            text: "{uomVHModel>BaseUnit}"
          })
        ]
      })
    });

    this.getView().addDependent(this._oUomVHDialog);
  }

  this._oUomVHDialog.setModel(oLocalModel, "uomVHModel");
  this._oUomVHDialog.open();
},_goToFreshHeaderScreen: function () {
  this._clearBomDraftData();

  this.getOwnerComponent().getRouter().navTo(
    Constants.ROUTES.HEADER,
    {},
    true
  );
},
      _openSortStringValueHelp: function () {
        var that = this;
        var oContext = this._oCurrentSortStringContext;

        if (!oContext) {
          MessageBox.error("Could not determine selected item row.");
          return;
        }

        var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
        var sHeaderMaterial = oHeaderModel
          ? oHeaderModel.getProperty("/Material")
          : "";

        sHeaderMaterial = this._toBackendMaterial(sHeaderMaterial);

        if (!sHeaderMaterial) {
          MessageBox.warning("Please enter/select header material first.");
          return;
        }

        BusyIndicator.show(0);

        ItemScreenService.loadSortStringVHData(this, sHeaderMaterial)
          .then(function (oLocalModel) {
            var aItems = oLocalModel.getProperty("/items") || [];

            if (!aItems.length) {
              MessageBox.warning(
                "No sort string found for header material " + sHeaderMaterial + "."
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
  return String(this._normalizeMaterialInput(sMaterial) || "")
    .trim()
    .toUpperCase();
},

      _clearBomDraftData: function () {
  ItemValueHelpHelper.clearSortStringCache(this);

  var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
  var oItemModel = this.getOwnerComponent().getModel("itemModel");
  var oResultModel = this.getView().getModel("resultModel");

  if (oHeaderModel) {
    HeaderModel.reset(oHeaderModel);
  }

  if (oItemModel) {
    ItemModel.reset(oItemModel);
  }

  if (oResultModel) {
    ResultModel.reset(oResultModel);
  }

  this._sSortStringVHMaterial = "";
  this._oSortStringVHModel = null;
  this._oCurrentComponentContext = null;
  this._oCurrentSortStringContext = null;
  this._oCurrentUomContext = null;
},

      _getErrorText: function (oError) {
        return ErrorHelper.getErrorText(oError);
      }
    });
  }
);
