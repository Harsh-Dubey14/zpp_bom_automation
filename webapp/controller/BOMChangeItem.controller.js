/* global Promise */

sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/m/MessageToast",
        "sap/m/MessageBox",
        "sap/ui/core/BusyIndicator",
        "sap/ui/model/json/JSONModel",
        "zppbomautomation/config/Constants",
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
        JSONModel,
        Constants,
        ItemModel,
        ResultModel,
        BomActionService,
        ItemScreenService,
        ItemValueHelpHelper,
        ErrorHelper
    ) {
        "use strict";

        return Controller.extend("zppbomautomation.controller.BOMChangeItem", {
            onInit: function () {
                ResultModel.init(this.getView());

                this._sSortStringVHMaterial = "";
                this._oSortStringVHModel = null;

                this.getOwnerComponent()
                    .getRouter()
                    .getRoute(Constants.ROUTES.CHANGE_ITEM)
                    .attachPatternMatched(this._onRouteMatched, this);
            },

            _onRouteMatched: async function () {
                var oChangeModel = this.getOwnerComponent().getModel("changeModel");

                if (!oChangeModel) {
                    MessageBox.error(
                        "Change BOM data is missing. Please fetch BOM again."
                    );
                    this.getOwnerComponent()
                        .getRouter()
                        .navTo(Constants.ROUTES.CHANGE, {}, true);
                    return;
                }

                var oHeaderData = oChangeModel.getProperty("/HeaderData");
                var aFetchedItems = oChangeModel.getProperty("/FetchedItems") || [];

                if (!oHeaderData || !aFetchedItems.length) {
                    MessageBox.error("Please fetch BOM details first.");
                    this.getOwnerComponent()
                        .getRouter()
                        .navTo(Constants.ROUTES.CHANGE, {}, true);
                    return;
                }

                var oHeaderModel = new JSONModel(
                    this._normalizeChangeHeaderData(oHeaderData, aFetchedItems[0])
                );

                this.getOwnerComponent().setModel(oHeaderModel, "headerModel");
                this.getView().setModel(oHeaderModel, "headerModel");

                var oItemModel = ItemModel.init(
                    this.getOwnerComponent(),
                    this.getView()
                );

                ItemModel.setItems(oItemModel, aFetchedItems);
                this.getView().setModel(oItemModel, "itemModel");

                ResultModel.reset(this.getView().getModel("resultModel"));
                this._setResultInitial(this.getView().getModel("resultModel"));

                await this._fillChangeModeComponentDetails();
            },

            _normalizeChangeHeaderData: function (oHeaderData, oFirstItem) {
                oHeaderData = oHeaderData || {};
                oFirstItem = oFirstItem || {};

                return {
                    AppMode: Constants.APP_MODE.CHANGE,
                    IsChangeMode: true,

                    Material:
                        oHeaderData.Material ||
                        oFirstItem.material ||
                        oFirstItem.Material ||
                        "",

                    Plant:
                        oHeaderData.Plant || oFirstItem.plant || oFirstItem.Plant || "",

                    BomUsage:
                        oHeaderData.BomUsage ||
                        oHeaderData.BillOfMaterialVariantUsage ||
                        oFirstItem.billOfMaterialVariantUsage ||
                        oFirstItem.BillOfMaterialVariantUsage ||
                        Constants.BOM_USAGE,

                    AltBom:
                        oHeaderData.AltBom ||
                        oHeaderData.BillOfMaterialVariant ||
                        oFirstItem.billOfMaterialVariant ||
                        oFirstItem.BillOfMaterialVariant ||
                        "",

                    BillOfMaterial:
                        oHeaderData.BillOfMaterial ||
                        oFirstItem.billOfMaterial ||
                        oFirstItem.BillOfMaterial ||
                        "",

                    BillOfMaterialCategory:
                        oHeaderData.BillOfMaterialCategory ||
                        oFirstItem.billOfMaterialCategory ||
                        oFirstItem.BillOfMaterialCategory ||
                        Constants.DEFAULTS.BILL_OF_MATERIAL_CATEGORY ||
                        "M",

                    BillOfMaterialVariant:
                        oHeaderData.BillOfMaterialVariant ||
                        oHeaderData.AltBom ||
                        oFirstItem.billOfMaterialVariant ||
                        oFirstItem.BillOfMaterialVariant ||
                        "",

                    BillOfMaterialVariantUsage:
                        oHeaderData.BillOfMaterialVariantUsage ||
                        oHeaderData.BomUsage ||
                        oFirstItem.billOfMaterialVariantUsage ||
                        oFirstItem.BillOfMaterialVariantUsage ||
                        Constants.BOM_USAGE,

                    BillOfMaterialVersion:
                        oHeaderData.BillOfMaterialVersion ||
                        oFirstItem.billOfMaterialVersion ||
                        oFirstItem.BillOfMaterialVersion ||
                        "",

                    HeaderChangeDocument:
                        oHeaderData.HeaderChangeDocument ||
                        oFirstItem.headerChangeDocument ||
                        oFirstItem.HeaderChangeDocument ||
                        "",

                    BaseQty:
                        oHeaderData.BaseQty ||
                        oHeaderData.BOMHeaderQuantityInBaseUnit ||
                        oFirstItem.bomHeaderQuantityInBaseUnit ||
                        oFirstItem.BOMHeaderQuantityInBaseUnit ||
                        "",

                    BaseUom:
                        oHeaderData.BaseUom ||
                        oHeaderData.BOMHeaderBaseUnit ||
                        oFirstItem.bomHeaderBaseUnit ||
                        oFirstItem.BOMHeaderBaseUnit ||
                        "",

                    ValidFrom:
                        oHeaderData.ValidFrom ||
                        oHeaderData.HeaderValidityStartDate ||
                        oFirstItem.headerValidityStartDate ||
                        oFirstItem.HeaderValidityStartDate ||
                        "",

                    BomStatus:
                        oHeaderData.BomStatus ||
                        oHeaderData.BOMVersionStatus ||
                        oFirstItem.bomVersionStatus ||
                        oFirstItem.BOMVersionStatus ||
                        Constants.BOM_STATUS,

                    IsValidated: true,
                    Message: "BOM loaded for change.",
                    MessageType: "Success",
                    ShowMessage: true
                };
            },

            onNavBack: function () {
                this.getOwnerComponent()
                    .getRouter()
                    .navTo(Constants.ROUTES.CHANGE, {}, true);
            },

            onCancel: function () {
                var that = this;

                MessageBox.warning(
                    "Are you sure you want to cancel? Unsaved BOM changes will be lost.",
                    {
                        actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                        emphasizedAction: MessageBox.Action.OK,

                        onClose: function (sAction) {
                            if (sAction === MessageBox.Action.OK) {
                                that._clearChangeBomData();

                                that
                                    .getOwnerComponent()
                                    .getRouter()
                                    .navTo(Constants.ROUTES.CHANGE, {}, true);
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
                this._markLastAddedRowAsNew(oItemModel);
            },

            _markLastAddedRowAsNew: function (oItemModel) {
                var aItems = oItemModel.getProperty("/items") || [];

                if (!aItems.length) {
                    return;
                }

                var oHeader = this.getOwnerComponent()
                    .getModel("headerModel")
                    .getData();

                var iLastIndex = aItems.length - 1;
                var oLastItem = aItems[iLastIndex];

                oLastItem.rowStatus = Constants.ROW_STATUS.NEW;
                oLastItem.changeMode = Constants.CHANGE_MODE.INSERT;
                oLastItem.isNew = true;
                oLastItem.isChanged = false;
                oLastItem.isDeleted = false;

                oLastItem.billOfMaterial = oHeader.BillOfMaterial || "";
                oLastItem.billOfMaterialCategory =
                    oHeader.BillOfMaterialCategory ||
                    Constants.DEFAULTS.BILL_OF_MATERIAL_CATEGORY ||
                    "M";
                oLastItem.billOfMaterialVariant =
                    oHeader.BillOfMaterialVariant || oHeader.AltBom || "";
                oLastItem.billOfMaterialVariantUsage =
                    oHeader.BillOfMaterialVariantUsage ||
                    oHeader.BomUsage ||
                    Constants.BOM_USAGE;
                oLastItem.billOfMaterialVersion = oHeader.BillOfMaterialVersion || "";
                oLastItem.headerChangeDocument = oHeader.HeaderChangeDocument || "";

                oLastItem.material = oHeader.Material || "";
                oLastItem.plant = oHeader.Plant || "";
                oLastItem.billOfMaterialItemNodeNumber = "";
                oLastItem.category = Constants.ITEM_CATEGORY;

                oLastItem.item = this._getNextFrontendItemNumber(aItems);
                oLastItem.component = "";
                oLastItem.description = "";
                oLastItem.quantity = "";
                oLastItem.uom = "";
                oLastItem.sortString = "";
                oLastItem.isProductionRelevant = true;

                oItemModel.setProperty("/items", aItems);
            },

            _getNextFrontendItemNumber: function (aItems) {
                var iMax = 0;

                (aItems || []).forEach(function (oItem) {
                    var iNo = Number(oItem.item || 0);

                    if (!isNaN(iNo) && iNo > iMax) {
                        iMax = iNo;
                    }
                });

                return String(iMax + 1).padStart(4, "0");
            },

            onDelete: function () {
                var oTable = this.byId("tblBOMChangeItems");
                var oItemModel = this.getOwnerComponent().getModel("itemModel");
                var aSelectedItems = oTable.getSelectedItems();

                if (aSelectedItems.length === 0) {
                    MessageToast.show("Please select items to delete");
                    return;
                }

                var aIndexesToDelete = aSelectedItems.map(function (oItem) {
                    return oTable.indexOfItem(oItem);
                });

                this._deleteRowsInChangeMode(oItemModel, aIndexesToDelete);

                oTable.removeSelections(true);

                MessageToast.show("Selected items marked for delete");
            },

            _deleteRowsInChangeMode: function (oItemModel, aIndexesToDelete) {
                var aItems = oItemModel.getProperty("/items") || [];

                aIndexesToDelete
                    .sort(function (a, b) {
                        return b - a;
                    })
                    .forEach(function (iIndex) {
                        var oItem = aItems[iIndex];

                        if (!oItem) {
                            return;
                        }

                        if (oItem.rowStatus === Constants.ROW_STATUS.NEW) {
                            aItems.splice(iIndex, 1);
                            return;
                        }

                        oItem.rowStatus = Constants.ROW_STATUS.DELETED;
                        oItem.changeMode = Constants.CHANGE_MODE.DELETE;
                        oItem.isDeleted = true;
                        oItem.isChanged = false;
                    });

                oItemModel.setProperty("/items", aItems);
            },

            onSelectAll: function () {
                var oTable = this.byId("tblBOMChangeItems");

                oTable.selectAll();
                MessageToast.show("All items selected");
            },

            onQuantityLiveChange: function (oEvent) {
                var oInput = oEvent.getSource();
                var sValue = ItemScreenService.sanitizeQuantity(
                    oInput.getValue() || ""
                );

                oInput.setValue(sValue);
                this._markRowChangedFromEvent(oEvent);
            },

            onQuantityChange: function (oEvent) {
                var oInput = oEvent.getSource();
                var sValue = oInput.getValue() || "";

                if (!sValue) {
                    this._markRowChangedFromEvent(oEvent);
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

                this._markRowChangedFromEvent(oEvent);
            },

            onUomChange: function (oEvent) {
                var oInput = oEvent.getSource();
                var oContext = oInput.getBindingContext("itemModel");
                var sValue = String(oInput.getValue() || "")
                    .trim()
                    .toUpperCase();

                oInput.setValue(sValue);

                if (oContext) {
                    oContext.getModel().setProperty(oContext.getPath() + "/uom", sValue);
                    this._markRowChanged(oContext);
                }
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
                    this._markRowChanged(oContext);
                    return;
                }

                if (!sPlant) {
                    MessageBox.warning("Plant is missing in header.");
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

                var bValid = await ItemScreenService.fillComponentDetails(
                    this.getOwnerComponent().getModel(),
                    oContext,
                    sComponent,
                    sPlant
                );

                this._markRowChanged(oContext);

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
                    MessageBox.warning("Plant is missing in header.");
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

                this._markRowChanged(oContext);
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
                var sValue = String(oInput.getValue() || "")
                    .trim()
                    .toUpperCase();

                oInput.setValue(sValue);

                if (oContext) {
                    oContext
                        .getModel()
                        .setProperty(oContext.getPath() + "/sortString", sValue);

                    this._markRowChanged(oContext);
                }
            },

            _openSortStringValueHelp: function () {
                var that = this;
                var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
                var sMaterial = oHeaderModel
                    ? oHeaderModel.getProperty("/Material")
                    : "";

                sMaterial = this._toBackendMaterial(sMaterial);

                if (!sMaterial) {
                    MessageBox.warning("Header material is missing.");
                    return;
                }

                BusyIndicator.show(0);

                ItemScreenService.loadSortStringVHData(this, sMaterial)
                    .then(function (oLocalModel) {
                        var aItems = oLocalModel.getProperty("/items") || [];

                        if (!aItems.length) {
                            MessageBox.warning(
                                "No sort string found for product " + sMaterial + "."
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
                    return;
                }

                this._markRowChanged(oContext);
            },

            onPostChanges: async function () {
                await this._saveChangeBomItems();
            },

            _saveChangeBomItems: async function () {
                var oResultModel = this.getView().getModel("resultModel");

                try {
                    var oValidation = await this._validateChangeRowsBeforeSave();

                    if (!oValidation.valid) {
                        MessageBox.error(oValidation.message);
                        return;
                    }

                    var aPayloads = this._buildChangeBomPayloads();

                    if (!aPayloads.length) {
                        MessageToast.show("No changes found to post.");
                        return;
                    }

                    this._setResultBusy(oResultModel, "Posting BOM changes...");

                    BusyIndicator.show(0);

                    for (var i = 0; i < aPayloads.length; i++) {
                        await BomActionService.changeBomItem(
                            this.getOwnerComponent().getModel(),
                            aPayloads[i]
                        );
                    }

                    await this._refreshChangeBomItemsAfterSave();

                    this._setResultSuccess(
                        oResultModel,
                        aPayloads.length + " BOM item change(s) posted successfully."
                    );

                    MessageBox.success(
                        aPayloads.length + " BOM item change(s) posted successfully."
                    );
                } catch (oError) {
                    var sErrorText = this._getErrorText(oError);

                    this._setResultError(oResultModel, sErrorText);

                    MessageBox.error(sErrorText);
                } finally {
                    BusyIndicator.hide();
                }
            },

            _validateChangeRowsBeforeSave: async function () {
                var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
                var oHeader = oHeaderModel ? oHeaderModel.getData() : null;

                var oItemModel = this.getOwnerComponent().getModel("itemModel");
                var aItems = oItemModel ? oItemModel.getProperty("/items") || [] : [];

                if (!oHeader) {
                    return {
                        valid: false,
                        message: "Header data is missing."
                    };
                }

                if (!aItems.length) {
                    return {
                        valid: false,
                        message: "No BOM items found."
                    };
                }

                var aChangedRows = aItems.filter(function (oItem) {
                    return (
                        oItem.rowStatus === Constants.ROW_STATUS.CHANGED ||
                        oItem.rowStatus === Constants.ROW_STATUS.NEW ||
                        oItem.rowStatus === Constants.ROW_STATUS.DELETED
                    );
                });

                if (!aChangedRows.length) {
                    return {
                        valid: false,
                        message: "No changed, new, or deleted item found."
                    };
                }

                var sPlant = oHeader.Plant;
                var oODataModel = this.getOwnerComponent().getModel();

                for (var i = 0; i < aItems.length; i++) {
                    var oItem = aItems[i];

                    if (
                        oItem.rowStatus !== Constants.ROW_STATUS.CHANGED &&
                        oItem.rowStatus !== Constants.ROW_STATUS.NEW &&
                        oItem.rowStatus !== Constants.ROW_STATUS.DELETED
                    ) {
                        continue;
                    }

                    if (oItem.rowStatus === Constants.ROW_STATUS.DELETED) {
                        if (!oItem.billOfMaterialItemNodeNumber) {
                            return {
                                valid: false,
                                message:
                                    "Row " +
                                    (i + 1) +
                                    ": BOM item node number is missing for delete."
                            };
                        }

                        continue;
                    }

                    if (!oItem.component) {
                        return {
                            valid: false,
                            message: "Row " + (i + 1) + ": Component is mandatory."
                        };
                    }

                    if (!oItem.quantity || Number(oItem.quantity) <= 0) {
                        return {
                            valid: false,
                            message:
                                "Row " + (i + 1) + ": Quantity must be greater than zero."
                        };
                    }

                    if (!ItemScreenService.isValidQuantityDecimal(oItem.quantity)) {
                        return {
                            valid: false,
                            message:
                                "Row " +
                                (i + 1) +
                                ": Quantity can have maximum 3 digits after decimal."
                        };
                    }

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

                    if (!oItem.description) {
                        oItem.description = oCheckResult.description || "";
                    }

                    if (!oItem.uom) {
                        oItem.uom = oCheckResult.uom || "";
                    }

                    if (!oItem.uom) {
                        return {
                            valid: false,
                            message: "Row " + (i + 1) + ": UOM is mandatory."
                        };
                    }

                    if (
                        oItem.rowStatus === Constants.ROW_STATUS.CHANGED &&
                        !oItem.billOfMaterialItemNodeNumber
                    ) {
                        return {
                            valid: false,
                            message:
                                "Row " +
                                (i + 1) +
                                ": BOM item node number is missing for update."
                        };
                    }
                }

                ItemModel.setItems(oItemModel, aItems);

                return {
                    valid: true,
                    message: ""
                };
            },

            _buildChangeBomPayloads: function () {
                var oItemModel = this.getOwnerComponent().getModel("itemModel");
                var aItems = oItemModel ? oItemModel.getProperty("/items") || [] : [];

                return aItems
                    .filter(function (oItem) {
                        return (
                            oItem.rowStatus === Constants.ROW_STATUS.CHANGED ||
                            oItem.rowStatus === Constants.ROW_STATUS.NEW ||
                            oItem.rowStatus === Constants.ROW_STATUS.DELETED
                        );
                    })
                    .map(
                        function (oItem) {
                            return this._buildSingleChangeBomPayload(oItem);
                        }.bind(this)
                    );
            },

            _buildSingleChangeBomPayload: function (oItem) {
  var oHeader = this.getOwnerComponent()
    .getModel("headerModel")
    .getData();

  var sChangeMode = oItem.changeMode || "";

  if (!sChangeMode) {
    if (oItem.rowStatus === Constants.ROW_STATUS.CHANGED) {
      sChangeMode = Constants.CHANGE_MODE.UPDATE;
    } else if (oItem.rowStatus === Constants.ROW_STATUS.NEW) {
      sChangeMode = Constants.CHANGE_MODE.INSERT;
    } else if (oItem.rowStatus === Constants.ROW_STATUS.DELETED) {
      sChangeMode = Constants.CHANGE_MODE.DELETE;
    }
  }

  return {
    BillOfMaterial:
      oItem.billOfMaterial ||
      oHeader.BillOfMaterial ||
      "",

    BillOfMaterialCategory:
      oItem.billOfMaterialCategory ||
      oHeader.BillOfMaterialCategory ||
      Constants.DEFAULTS.BILL_OF_MATERIAL_CATEGORY ||
      "M",

    BillOfMaterialVariant:
      oItem.billOfMaterialVariant ||
      oHeader.BillOfMaterialVariant ||
      oHeader.AltBom ||
      "",

    BillOfMaterialVariantUsage:
      oItem.billOfMaterialVariantUsage ||
      oHeader.BillOfMaterialVariantUsage ||
      oHeader.BomUsage ||
      Constants.BOM_USAGE,

    Material:
      this._toBackendMaterial(
        oItem.material ||
        oHeader.Material ||
        ""
      ),

    Plant:
      String(oItem.plant || oHeader.Plant || "").trim(),

    BillOfMaterialItemNodeNumber:
      sChangeMode === Constants.CHANGE_MODE.INSERT
        ? ""
        : oItem.billOfMaterialItemNodeNumber || "",

    BillOfMaterialItemNumber:
      oItem.item || "",

    BillOfMaterialComponent:
      this._toBackendMaterial(oItem.component || ""),

    BillOfMaterialItemQuantity:
      Number(oItem.quantity || 0),

    BillOfMaterialItemUnit:
      String(oItem.uom || "").trim().toUpperCase(),

    BOMItemDescription:
      oItem.description || "",

    BOMItemSorter:
      oItem.sortString || "",

    ChangeMode:
      sChangeMode
  };
},

            _refreshChangeBomItemsAfterSave: async function () {
                var oHeader = this.getOwnerComponent()
                    .getModel("headerModel")
                    .getData();

                var aItems = await this._readBomChangeItemsForRefresh(oHeader);
                var aRows = this._convertBomChangeItemsToRows(aItems);

                ItemModel.setItems(
                    this.getOwnerComponent().getModel("itemModel"),
                    aRows
                );

                await this._fillChangeModeComponentDetails();

                var oChangeModel = this.getOwnerComponent().getModel("changeModel");

                if (oChangeModel) {
                    oChangeModel.setProperty("/FetchedItems", aRows);
                }
            },

            _readBomChangeItemsForRefresh: function (oHeader) {
                var aFilters = [];

                if (oHeader.BillOfMaterial) {
                    aFilters.push(
                        "BillOfMaterial eq '" +
                        this._escapeODataValue(oHeader.BillOfMaterial) +
                        "'"
                    );
                    aFilters.push(
                        "BillOfMaterialVariantUsage eq '" +
                        this._escapeODataValue(
                            oHeader.BillOfMaterialVariantUsage ||
                            oHeader.BomUsage ||
                            Constants.BOM_USAGE
                        ) +
                        "'"
                    );
                    aFilters.push(
                        "BillOfMaterialVariant eq '" +
                        this._escapeODataValue(
                            oHeader.BillOfMaterialVariant || oHeader.AltBom || ""
                        ) +
                        "'"
                    );
                } else {
                    aFilters.push(
                        "Material eq '" + this._escapeODataValue(oHeader.Material) + "'"
                    );
                    aFilters.push(
                        "Plant eq '" + this._escapeODataValue(oHeader.Plant) + "'"
                    );
                    aFilters.push(
                        "BillOfMaterialVariantUsage eq '" +
                        this._escapeODataValue(oHeader.BomUsage || Constants.BOM_USAGE) +
                        "'"
                    );
                    aFilters.push(
                        "BillOfMaterialVariant eq '" +
                        this._escapeODataValue(oHeader.AltBom || "") +
                        "'"
                    );
                }

                return this.getOwnerComponent()
                    .getModel()
                    .bindList(Constants.ENTITY_SETS.BOM_CHANGE_READ, null, null, null, {
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
                            String(iIndex + 1).padStart(4, "0"),

                        component: oItem.BillOfMaterialComponent || oItem.Component || "",

                        description:
                            oItem.BOMItemDescription ||
                            oItem.ProductDescription ||
                            oItem.ComponentDescription ||
                            oItem.ItemText ||
                            "",

                        quantity:
                            oItem.BillOfMaterialItemQuantity !== undefined &&
                                oItem.BillOfMaterialItemQuantity !== null
                                ? String(oItem.BillOfMaterialItemQuantity)
                                : "",

                        uom: oItem.BillOfMaterialItemUnit || oItem.Uom || "",

                        sortString: oItem.BOMItemSorter || oItem.SortString || "",

                        category:
                            oItem.BillOfMaterialItemCategory || Constants.ITEM_CATEGORY,

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
                            oItem.BillOfMaterialVariantUsage || Constants.BOM_USAGE,
                        billOfMaterialVersion: oItem.BillOfMaterialVersion || "",
                        headerChangeDocument: oItem.HeaderChangeDocument || "",

                        material: oItem.Material || "",
                        plant: oItem.Plant || "",

                        billOfMaterialItemNodeNumber:
                            oItem.BillOfMaterialItemNodeNumber || "",

                        originalItemNumber: oItem.BillOfMaterialItemNumber || "",

                        isProductionRelevant:
                            oItem.IsProductionRelevant === undefined
                                ? true
                                : !!oItem.IsProductionRelevant
                    };
                });
            },

            _fillChangeModeComponentDetails: async function () {
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

                    if (
                        !oItem.component ||
                        oItem.rowStatus === Constants.ROW_STATUS.DELETED
                    ) {
                        continue;
                    }

                    var sComponent = await this._resolveBackendComponent(
                        oItem.component,
                        sPlant
                    );

                    var oResult = await ItemScreenService.checkComponentPlantExtension(
                        oODataModel,
                        sComponent,
                        sPlant
                    );

                    if (oResult.valid) {
                        oItem.component = this._toBackendMaterial(
                            oResult.component || sComponent
                        );

                        if (!oItem.description) {
                            oItem.description = oResult.description || "";
                        }

                        if (!oItem.uom) {
                            oItem.uom = oResult.uom || "";
                        }
                    }
                }

                ItemModel.setItems(oItemModel, aItems);
            },

            _markRowChangedFromEvent: function (oEvent) {
                if (!oEvent || !oEvent.getSource) {
                    return;
                }

                var oContext = oEvent.getSource().getBindingContext("itemModel");

                this._markRowChanged(oContext);
            },

            _markRowChanged: function (oContext) {
                if (!oContext) {
                    return;
                }

                var oItemModel = oContext.getModel();
                var sPath = oContext.getPath();
                var oItem = oItemModel.getProperty(sPath);

                if (!oItem || oItem.rowStatus === Constants.ROW_STATUS.DELETED) {
                    return;
                }

                if (oItem.rowStatus === Constants.ROW_STATUS.NEW) {
                    oItem.changeMode = Constants.CHANGE_MODE.INSERT;
                    oItem.isNew = true;
                } else {
                    oItem.rowStatus = Constants.ROW_STATUS.CHANGED;
                    oItem.changeMode = Constants.CHANGE_MODE.UPDATE;
                    oItem.isChanged = true;
                }

                oItemModel.setProperty(sPath, oItem);
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
                                return sValue.replace(/^0+/, "") === sSearch.replace(/^0+/, "");
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

            _escapeODataValue: function (sValue) {
                return String(sValue || "").replace(/'/g, "''");
            },

            _setResultInitial: function (oResultModel) {
                if (!oResultModel) {
                    return;
                }

                oResultModel.setProperty("/Status", "READY");
                oResultModel.setProperty("/StatusState", "Information");
                oResultModel.setProperty("/Message", "Ready to post BOM changes.");
                oResultModel.setProperty("/MessageType", "Information");
                oResultModel.setProperty("/ShowMessage", false);
                oResultModel.setProperty("/CanSave", true);
                oResultModel.setProperty("/Editable", true);
            },

            _setResultBusy: function (oResultModel, sMessage) {
                if (!oResultModel) {
                    return;
                }

                oResultModel.setProperty("/Status", "PROCESSING");
                oResultModel.setProperty("/StatusState", "Warning");
                oResultModel.setProperty("/Message", sMessage || "Processing...");
                oResultModel.setProperty("/MessageType", "Information");
                oResultModel.setProperty("/ShowMessage", true);
                oResultModel.setProperty("/CanSave", false);
                oResultModel.setProperty("/Editable", false);
            },

            _setResultSuccess: function (oResultModel, sMessage) {
                if (!oResultModel) {
                    return;
                }

                oResultModel.setProperty("/Status", "SUCCESS");
                oResultModel.setProperty("/StatusState", "Success");
                oResultModel.setProperty("/Message", sMessage || "Success.");
                oResultModel.setProperty("/MessageType", "Success");
                oResultModel.setProperty("/ShowMessage", true);
                oResultModel.setProperty("/CanSave", true);
                oResultModel.setProperty("/Editable", true);
            },

            _setResultError: function (oResultModel, sMessage) {
                if (!oResultModel) {
                    return;
                }

                oResultModel.setProperty("/Status", "ERROR");
                oResultModel.setProperty("/StatusState", "Error");
                oResultModel.setProperty("/Message", sMessage || "Error occurred.");
                oResultModel.setProperty("/MessageType", "Error");
                oResultModel.setProperty("/ShowMessage", true);
                oResultModel.setProperty("/CanSave", true);
                oResultModel.setProperty("/Editable", true);
            },

            _clearChangeBomData: function () {
                ItemValueHelpHelper.clearSortStringCache(this);

                ItemModel.reset(this.getOwnerComponent().getModel("itemModel"));
                ResultModel.reset(this.getView().getModel("resultModel"));

                var oChangeModel = this.getOwnerComponent().getModel("changeModel");

                if (oChangeModel) {
                    oChangeModel.setProperty("/CanContinue", false);
                    oChangeModel.setProperty("/FetchedItems", []);
                    oChangeModel.setProperty("/HeaderData", null);
                    oChangeModel.setProperty("/Message", "");
                    oChangeModel.setProperty("/ShowMessage", false);
                }
            },

            _getErrorText: function (oError) {
                return ErrorHelper.getErrorText(oError);
            }
        });
    }
);
