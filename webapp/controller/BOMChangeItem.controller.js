/* global Promise */
/* eslint-disable max-params */

sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/m/MessageToast",
        "sap/m/MessageBox",
        "sap/ui/core/BusyIndicator",
        "sap/ui/model/json/JSONModel",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator",
        "sap/m/TableSelectDialog",
        "sap/m/ColumnListItem",
        "sap/m/Column",
        "sap/m/Text",
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
        Filter,
        FilterOperator,
        TableSelectDialog,
        ColumnListItem,
        Column,
        Text,
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
                this._oCurrentComponentContext = null;
                this._oCurrentSortStringContext = null;
                this._oCurrentUomContext = null;
                this._oUomVHDialog = null;
                this._bPostInProgress = false;

                this.getOwnerComponent()
                    .getRouter()
                    .getRoute(Constants.ROUTES.CHANGE_ITEM)
                    .attachPatternMatched(this._onRouteMatched, this);
            },
            _onRouteMatched: async function () {
                var oChangeModel = this.getOwnerComponent().getModel("changeModel");

                if (!oChangeModel) {
                    MessageBox.error("Change BOM data is missing. Please fetch BOM again.");
                    this.getOwnerComponent()
                        .getRouter()
                        .navTo(Constants.ROUTES.CHANGE, {}, true);
                    return;
                }

                var oHeaderData = oChangeModel.getProperty("/HeaderData");
                var aFetchedItems = oChangeModel.getProperty("/FetchedItems") || [];

                if (!oHeaderData) {
                    MessageBox.error("Please fetch BOM details first.");
                    this.getOwnerComponent()
                        .getRouter()
                        .navTo(Constants.ROUTES.CHANGE, {}, true);
                    return;
                }

                aFetchedItems = this._normalizeFetchedChangeItems(aFetchedItems);

                aFetchedItems = aFetchedItems.filter(function (oItem) {
                    return (
                        oItem &&
                        (
                            oItem.component ||
                            oItem.billOfMaterialItemNodeNumber ||
                            oItem.originalItemNumber
                        )
                    );
                });

                var oHeaderModel = new JSONModel(
                    this._normalizeChangeHeaderData(oHeaderData, aFetchedItems[0])
                );

                this.getOwnerComponent().setModel(oHeaderModel, "headerModel");
                this.getView().setModel(oHeaderModel, "headerModel");

                var oItemModel = ItemModel.init(this.getOwnerComponent(), this.getView());

                ItemModel.setItems(oItemModel, aFetchedItems);

                if (!aFetchedItems.length) {
                    ItemModel.addRow(oItemModel);
                    this._markLastAddedRowAsNew(oItemModel, "0001");
                }

                oItemModel.setProperty("/pendingDeletes", []);
                this.getView().setModel(oItemModel, "itemModel");

                ResultModel.reset(this.getView().getModel("resultModel"));
                this._setResultInitial(this.getView().getModel("resultModel"));
            },

            _normalizeChangeHeaderData: function (oHeaderData, oFirstItem) {
                oHeaderData = oHeaderData || {};
                oFirstItem = oFirstItem || {};

                return {
                    AppMode: Constants.APP_MODE.CHANGE,
                    IsChangeMode: true,

                    Material:
                        oHeaderData.Material ||
                        oHeaderData.material ||
                        oFirstItem.Material ||
                        oFirstItem.material ||
                        "",

                    Plant:
                        oHeaderData.Plant ||
                        oHeaderData.plant ||
                        oFirstItem.Plant ||
                        oFirstItem.plant ||
                        "",

                    PlantName:
                        oHeaderData.PlantName ||
                        oHeaderData.plantName ||
                        "",

                    PlantDisplay:
                        oHeaderData.PlantDisplay ||
                        oHeaderData.plantDisplay ||
                        this._formatPlantDisplay(
                            oHeaderData.Plant ||
                                oHeaderData.plant ||
                                oFirstItem.Plant ||
                                oFirstItem.plant ||
                                "",
                            oHeaderData.PlantName ||
                                oHeaderData.plantName ||
                                ""
                        ),

                    BomUsage:
                        oHeaderData.BomUsage ||
                        oHeaderData.BillOfMaterialVariantUsage ||
                        oHeaderData.billOfMaterialVariantUsage ||
                        oFirstItem.BillOfMaterialVariantUsage ||
                        oFirstItem.billOfMaterialVariantUsage ||
                        Constants.BOM_USAGE,

                    AltBom:
                        oHeaderData.AltBom ||
                        oHeaderData.BillOfMaterialVariant ||
                        oHeaderData.billOfMaterialVariant ||
                        oFirstItem.BillOfMaterialVariant ||
                        oFirstItem.billOfMaterialVariant ||
                        "",

                    BillOfMaterial:
                        oHeaderData.BillOfMaterial ||
                        oHeaderData.billOfMaterial ||
                        oFirstItem.BillOfMaterial ||
                        oFirstItem.billOfMaterial ||
                        "",

                    BillOfMaterialCategory:
                        oHeaderData.BillOfMaterialCategory ||
                        oHeaderData.billOfMaterialCategory ||
                        oFirstItem.BillOfMaterialCategory ||
                        oFirstItem.billOfMaterialCategory ||
                        Constants.DEFAULTS.BILL_OF_MATERIAL_CATEGORY ||
                        "M",

                    BillOfMaterialVariant:
                        oHeaderData.BillOfMaterialVariant ||
                        oHeaderData.billOfMaterialVariant ||
                        oHeaderData.AltBom ||
                        oFirstItem.BillOfMaterialVariant ||
                        oFirstItem.billOfMaterialVariant ||
                        "",

                    BillOfMaterialVariantUsage:
                        oHeaderData.BillOfMaterialVariantUsage ||
                        oHeaderData.billOfMaterialVariantUsage ||
                        oHeaderData.BomUsage ||
                        oFirstItem.BillOfMaterialVariantUsage ||
                        oFirstItem.billOfMaterialVariantUsage ||
                        Constants.BOM_USAGE,

                    BillOfMaterialVersion:
                        oHeaderData.BillOfMaterialVersion ||
                        oHeaderData.billOfMaterialVersion ||
                        oFirstItem.BillOfMaterialVersion ||
                        oFirstItem.billOfMaterialVersion ||
                        "",

                    HeaderChangeDocument:
                        oHeaderData.HeaderChangeDocument ||
                        oHeaderData.headerChangeDocument ||
                        oFirstItem.HeaderChangeDocument ||
                        oFirstItem.headerChangeDocument ||
                        "",

                    BaseQty:
                        oHeaderData.BaseQty ||
                        oHeaderData.BOMHeaderQuantityInBaseUnit ||
                        oHeaderData.bomHeaderQuantityInBaseUnit ||
                        oFirstItem.BOMHeaderQuantityInBaseUnit ||
                        oFirstItem.bomHeaderQuantityInBaseUnit ||
                        "",

                    BaseUom:
                        oHeaderData.BaseUom ||
                        oHeaderData.BOMHeaderBaseUnit ||
                        oHeaderData.bomHeaderBaseUnit ||
                        oFirstItem.BOMHeaderBaseUnit ||
                        oFirstItem.bomHeaderBaseUnit ||
                        "",

                    ValidFrom:
                        oHeaderData.ValidFrom ||
                        oHeaderData.HeaderValidityStartDate ||
                        oHeaderData.headerValidityStartDate ||
                        oFirstItem.HeaderValidityStartDate ||
                        oFirstItem.headerValidityStartDate ||
                        "",

                    BomStatus:
                        oHeaderData.BomStatus ||
                        oHeaderData.BOMVersionStatus ||
                        oHeaderData.bomVersionStatus ||
                        oFirstItem.BOMVersionStatus ||
                        oFirstItem.bomVersionStatus ||
                        Constants.BOM_STATUS,

                    BOMAlternativeText:
                        oHeaderData.BOMAlternativeText ||
                        oHeaderData.bomAlternativeText ||
                        oHeaderData.BOMALTERNATIVETEXT ||
                        oHeaderData.HeaderText ||
                        oHeaderData.headerText ||
                        oFirstItem.BOMAlternativeText ||
                        oFirstItem.bomAlternativeText ||
                        oFirstItem.BOMALTERNATIVETEXT ||
                        oFirstItem.HeaderText ||
                        oFirstItem.headerText ||
                        "",

                    HeaderText:
                        oHeaderData.HeaderText ||
                        oHeaderData.BOMAlternativeText ||
                        oHeaderData.bomAlternativeText ||
                        oHeaderData.BOMALTERNATIVETEXT ||
                        oFirstItem.HeaderText ||
                        oFirstItem.BOMAlternativeText ||
                        oFirstItem.bomAlternativeText ||
                        oFirstItem.BOMALTERNATIVETEXT ||
                        "",

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

                                that.getOwnerComponent()
                                    .getRouter()
                                    .navTo(Constants.ROUTES.CHANGE, {}, true);
                            }
                        }
                    }
                );
            },

            onAddRow: function () {
                var oItemModel = ItemModel.init(this.getOwnerComponent(), this.getView());
                var aItemsBeforeAdd = oItemModel.getProperty("/items") || [];
                var sNextItemNumber = this._getNextFrontendItemNumber(aItemsBeforeAdd);

                ItemModel.addRow(oItemModel);
                this._markLastAddedRowAsNew(oItemModel, sNextItemNumber);
            },

            _markLastAddedRowAsNew: function (oItemModel, sNextItemNumber) {
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

                oLastItem.item =
                    sNextItemNumber ||
                    this._getNextFrontendItemNumber(aItems.slice(0, iLastIndex));

                oLastItem.component = "";
                oLastItem.description = "";
                oLastItem.quantity = "";
                oLastItem.uom = "";
                oLastItem.sortString = "";
                oLastItem.sortStringValue = "";
                oLastItem.isProductionRelevant = true;

                oItemModel.setProperty("/items", aItems);
                oItemModel.refresh(true);
            },

            _getNextFrontendItemNumber: function (aItems) {
                var iMax = 0;

                (aItems || []).forEach(function (oItem) {
                    if (oItem && oItem.rowStatus === Constants.ROW_STATUS.DELETED) {
                        return;
                    }

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
                    MessageToast.show("Please select items to delete.");
                    return;
                }

                var aIndexesToDelete = aSelectedItems.map(function (oItem) {
                    return oTable.indexOfItem(oItem);
                });

                this._deleteRowsInChangeMode(oItemModel, aIndexesToDelete);

                oTable.removeSelections(true);

                MessageToast.show(
                    "Selected item(s) removed from screen. They will be deleted on Post."
                );
            },

            _deleteRowsInChangeMode: function (oItemModel, aIndexesToDelete) {
                var aItems = oItemModel.getProperty("/items") || [];
                var aPendingDeletes = oItemModel.getProperty("/pendingDeletes") || [];

                aIndexesToDelete
                    .sort(function (a, b) {
                        return b - a;
                    })
                    .forEach(function (iIndex) {
                        var oItem = aItems[iIndex];

                        if (!oItem) {
                            return;
                        }

                        if (oItem.rowStatus === Constants.ROW_STATUS.NEW || oItem.isNew) {
                            aItems.splice(iIndex, 1);
                            return;
                        }

                        oItem.rowStatus = Constants.ROW_STATUS.DELETED;
                        oItem.changeMode = Constants.CHANGE_MODE.DELETE;
                        oItem.isDeleted = true;
                        oItem.isChanged = false;
                        oItem.isNew = false;

                        aPendingDeletes.push(oItem);
                        aItems.splice(iIndex, 1);
                    });

                oItemModel.setProperty("/items", aItems);
                oItemModel.setProperty("/pendingDeletes", aPendingDeletes);
                oItemModel.refresh(true);
            },

            onSelectAll: function () {
                var oTable = this.byId("tblBOMChangeItems");

                oTable.selectAll();
                MessageToast.show("All items selected.");
            },

            onQuantityLiveChange: function (oEvent) {
                var oInput = oEvent.getSource();
                var sValue = ItemScreenService.sanitizeQuantity(oInput.getValue() || "");

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

            onRemarksChange: function (oEvent) {
                this._markRowChangedFromEvent(oEvent);
            },

            onUomChange: function (oEvent) {
                this.onUomManualInputBlock(oEvent);
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

                oItem = oContext.getObject() || {};
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
                                MessageBox.warning(
                                    "No UoM found for component " + sComponent + "."
                                );
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
                var sEntityPath =
                    Constants.VALUE_HELP.UOM_PATH ||
                    "/produtuom";

                return new Promise(function (resolve, reject) {
                    var oListBinding = oODataModel.bindList(
                        sEntityPath,
                        undefined,
                        undefined,
                        [
                            new Filter("Product", FilterOperator.EQ, sComponent)
                        ],
                        {
                            $select: Constants.VALUE_HELP.UOM_SELECT
                                ? Constants.VALUE_HELP.UOM_SELECT.join(",")
                                : "Product,AlternativeUnit,BaseUnit"
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
                            var oSelectedContext;
                            var oData;
                            var sUom;
                            var oItemModel;
                            var sPath;

                            if (!oSelectedItem || !this._oCurrentUomContext) {
                                return;
                            }

                            oSelectedContext = oSelectedItem.getBindingContext("uomVHModel");

                            if (!oSelectedContext) {
                                return;
                            }

                            oData = oSelectedContext.getObject();

                            sUom = String(oData.AlternativeUnit || "")
                                .trim()
                                .toUpperCase();

                            if (!sUom) {
                                MessageBox.warning(
                                    "Selected row does not contain Alternative Unit."
                                );
                                return;
                            }

                            oItemModel = this._oCurrentUomContext.getModel();
                            sPath = this._oCurrentUomContext.getPath();

                            oItemModel.setProperty(sPath + "/uom", sUom);

                            this._markRowChanged(this._oCurrentUomContext);

                            this._oCurrentUomContext = null;
                        }.bind(this),

                        cancel: function () {
                            this._oCurrentUomContext = null;
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
                    oItemModel.setProperty(sPath + "/sortStringValue", "");
                    this._markRowChanged(oContext);
                    return;
                }

                if (!sPlant) {
                    MessageBox.warning("Plant is missing in header.");
                    return;
                }

                try {
                    BusyIndicator.show(0);

                    var sComponent = await this._resolveBackendComponent(
                        sComponentInput,
                        sPlant
                    );

                    oInput.setValue(sComponent);

                    oItemModel.setProperty(sPath + "/component", sComponent);
                    oItemModel.setProperty(sPath + "/description", "");
                    oItemModel.setProperty(sPath + "/uom", "");
                    oItemModel.setProperty(sPath + "/sortString", "");
                    oItemModel.setProperty(sPath + "/sortStringValue", "");

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
                } catch (oError) {
                    MessageBox.error(this._getErrorText(oError));
                } finally {
                    BusyIndicator.hide();
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

            _applyComponentSelection: function (oData) {
                var oContext = this._oCurrentComponentContext;

                if (!oContext) {
                    MessageBox.error("Could not determine selected item row.");
                    return;
                }

                var oItemModel = oContext.getModel();
                var sPath = oContext.getPath();

                var sComponent = this._toBackendMaterial(this._getComponentValue(oData));

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
                oItemModel.setProperty(sPath + "/sortStringValue", "");

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
                var sValue = this._cleanSortString(oInput.getValue() || "");

                oInput.setValue(sValue);

                if (oContext) {
                    oContext.getModel().setProperty(oContext.getPath() + "/sortString", sValue);
                    oContext.getModel().setProperty(oContext.getPath() + "/sortStringValue", sValue);

                    this._markRowChanged(oContext);
                }
            },

            _openSortStringValueHelp: function () {
                var that = this;
                var oContext = this._oCurrentSortStringContext;

                if (!oContext) {
                    MessageBox.error("Could not determine selected item row.");
                    return;
                }

                var sHeaderMaterial = this._getHeaderMaterialForSortString();

                sHeaderMaterial = this._toBackendMaterial(sHeaderMaterial);

                if (!sHeaderMaterial) {
                    MessageBox.warning("Header material is missing.");
                    return;
                }

                BusyIndicator.show(0);

                ItemScreenService.loadSortStringVHData(this, sHeaderMaterial)
                    .then(function (oLocalModel) {
                        var aItems = oLocalModel.getProperty("/items") || [];

                        if (!aItems.length) {
                            MessageBox.warning(
                                "No sort string found for header material " +
                                sHeaderMaterial +
                                "."
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

            _getHeaderMaterialForSortString: function () {
                var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
                var sMaterial = oHeaderModel ? oHeaderModel.getProperty("/Material") : "";

                if (sMaterial) {
                    return sMaterial;
                }

                var oChangeModel = this.getOwnerComponent().getModel("changeModel");
                var oHeaderData = oChangeModel ? oChangeModel.getProperty("/HeaderData") : null;

                if (oHeaderData) {
                    sMaterial =
                        oHeaderData.Material ||
                        oHeaderData.material ||
                        "";

                    if (sMaterial) {
                        return sMaterial;
                    }
                }

                var oItemModel = this.getOwnerComponent().getModel("itemModel");
                var aItems = oItemModel ? oItemModel.getProperty("/items") || [] : [];

                if (aItems.length) {
                    sMaterial =
                        aItems[0].material ||
                        aItems[0].Material ||
                        "";
                }

                return sMaterial || "";
            },

            _applySortStringSelectionsToRow: function (aSelectedZcomb) {
                var oContext = this._oCurrentSortStringContext;

                if (!oContext) {
                    MessageBox.error("Could not determine selected item row.");
                    return;
                }

                var oItemModel = oContext.getModel();
                var sPath = oContext.getPath();
                var iBaseIndex = Number(sPath.split("/").pop());
                var aItems = oItemModel.getProperty("/items") || [];

                if (isNaN(iBaseIndex) || !aItems[iBaseIndex]) {
                    MessageBox.error("Could not determine selected item row.");
                    return;
                }

                aSelectedZcomb = this._normalizeSortStringSelections(aSelectedZcomb);

                if (!aSelectedZcomb.length) {
                    MessageToast.show("No sort string selected.");
                    return;
                }

                var oBaseRow = aItems[iBaseIndex];
                var sFirstSortString = this._cleanSortString(aSelectedZcomb[0]);

                oBaseRow.sortString = sFirstSortString;
                oBaseRow.sortStringValue = sFirstSortString;

                if (oBaseRow.rowStatus === Constants.ROW_STATUS.NEW || oBaseRow.isNew) {
                    oBaseRow.rowStatus = Constants.ROW_STATUS.NEW;
                    oBaseRow.changeMode = Constants.CHANGE_MODE.INSERT;
                    oBaseRow.isNew = true;
                    oBaseRow.isChanged = false;
                    oBaseRow.isDeleted = false;
                } else {
                    oBaseRow.rowStatus = Constants.ROW_STATUS.CHANGED;
                    oBaseRow.changeMode = Constants.CHANGE_MODE.UPDATE;
                    oBaseRow.isNew = false;
                    oBaseRow.isChanged = true;
                    oBaseRow.isDeleted = false;
                }

                for (var i = 1; i < aSelectedZcomb.length; i++) {
                    var oNewRow = JSON.parse(JSON.stringify(oBaseRow));
                    var sSortString = this._cleanSortString(aSelectedZcomb[i]);

                    oNewRow.item = this._getNextFrontendItemNumber(aItems);
                    oNewRow.sortString = sSortString;
                    oNewRow.sortStringValue = sSortString;

                    oNewRow.rowStatus = Constants.ROW_STATUS.NEW;
                    oNewRow.changeMode = Constants.CHANGE_MODE.INSERT;
                    oNewRow.isNew = true;
                    oNewRow.isChanged = false;
                    oNewRow.isDeleted = false;

                    oNewRow.billOfMaterialItemNodeNumber = "";
                    oNewRow.originalItemNumber = "";

                    aItems.push(oNewRow);
                }

                oItemModel.setProperty("/items", aItems);
                oItemModel.refresh(true);

                if (aSelectedZcomb.length === 1) {
                    MessageToast.show("Sort string applied.");
                } else {
                    MessageToast.show(aSelectedZcomb.length + " sort strings applied.");
                }
            },

            _normalizeSortStringSelections: function (aSelectedZcomb) {
                return (aSelectedZcomb || [])
                    .map(
                        function (vSelected) {
                            if (typeof vSelected === "string") {
                                return this._cleanSortString(vSelected);
                            }

                            if (!vSelected) {
                                return "";
                            }

                            return this._cleanSortString(
                                vSelected.Zcomb ||
                                vSelected.ZCOMB ||
                                vSelected.zcomb ||
                                vSelected.SortString ||
                                vSelected.sortStringValue ||
                                vSelected.sortString ||
                                vSelected.BOMItemSorter ||
                                vSelected.BomItemSorter ||
                                vSelected.bomItemSorter ||
                                ""
                            );
                        }.bind(this)
                    )
                    .filter(function (sSortString, iIndex, aArray) {
                        return sSortString && aArray.indexOf(sSortString) === iIndex;
                    });
            },

            onPostChanges: async function () {
                var oResultModel = this.getView().getModel("resultModel");

                if (this._bPostInProgress) {
                    MessageToast.show("Posting is already in progress. Please wait.");
                    return;
                }

                var oHeaderPanel = this.byId("changeHeaderForm");
                if (oHeaderPanel) {
                    oHeaderPanel.setExpanded(true);
                }

                this._bPostInProgress = true;

                this._setResultBusy(oResultModel, "Posting BOM changes...");

                try {
                    await this._saveChangeBomItems();
                } finally {
                    this._bPostInProgress = false;
                }
            },

            _saveChangeBomItems: async function () {
                var oResultModel = this.getView().getModel("resultModel");

                try {
                    var oValidation = await this._validateChangeRowsBeforeSave();

                    if (!oValidation.valid) {
                        this._setResultError(oResultModel, oValidation.message);
                        this._showLimitedErrorPopup(oValidation.message);
                        return;
                    }

                    var aPayloads = this._buildChangeBomPayloads();

                    if (!aPayloads.length) {
                        this._setResultInitial(oResultModel);
                        MessageToast.show("No changes found to post.");
                        return;
                    }

                    BusyIndicator.show(0);

                    var oResponse = await BomActionService.changeBomItems(
                        this.getOwnerComponent().getModel(),
                        aPayloads
                    );

                    if (!this._isBulkBackendActionSuccess(oResponse)) {
                        throw {
                            message: this._getBulkBackendActionMessage(oResponse)
                        };
                    }

                    await this._refreshChangeBomItemsAfterSave();

                    this._setResultSuccess(
                        oResultModel,
                        "BOM item changes posted successfully."
                    );

                    MessageBox.success("BOM item changes posted successfully.");
                } catch (oError) {
                    var sErrorText = this._getErrorText(oError);

                    this._setResultError(oResultModel, sErrorText);
                    this._showLimitedErrorPopup(sErrorText);
                } finally {
                    BusyIndicator.hide();
                }
            },

            _validateChangeRowsBeforeSave: async function () {
                var oHeaderModel = this.getOwnerComponent().getModel("headerModel");
                var oHeader = oHeaderModel ? oHeaderModel.getData() : null;

                var oItemModel = this.getOwnerComponent().getModel("itemModel");
                var aItems = oItemModel ? oItemModel.getProperty("/items") || [] : [];
                var aPendingDeletes = oItemModel
                    ? oItemModel.getProperty("/pendingDeletes") || []
                    : [];

                if (!oHeader) {
                    return {
                        valid: false,
                        message: "Header data is missing."
                    };
                }

                if (!aItems.length && !aPendingDeletes.length) {
                    return {
                        valid: false,
                        message: "No BOM items found."
                    };
                }

                var aChangedRows = aItems
                    .filter(function (oItem) {
                        return (
                            oItem.rowStatus === Constants.ROW_STATUS.CHANGED ||
                            oItem.rowStatus === Constants.ROW_STATUS.NEW
                        );
                    })
                    .concat(aPendingDeletes);

                if (!aChangedRows.length) {
                    return {
                        valid: false,
                        message: "No changed, new, or deleted item found."
                    };
                }

                for (var d = 0; d < aPendingDeletes.length; d++) {
                    if (!aPendingDeletes[d].billOfMaterialItemNodeNumber) {
                        return {
                            valid: false,
                            message:
                                "Deleted row " +
                                (d + 1) +
                                ": BOM item node number is missing for delete."
                        };
                    }
                }

                var sPlant = oHeader.Plant;
                var oODataModel = this.getOwnerComponent().getModel();

                for (var i = 0; i < aItems.length; i++) {
                    var oItem = aItems[i];

                    if (
                        oItem.rowStatus !== Constants.ROW_STATUS.CHANGED &&
                        oItem.rowStatus !== Constants.ROW_STATUS.NEW
                    ) {
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

                    oItem.description = oCheckResult.description || oItem.description || "";

                    /*
                     * Do not overwrite UOM selected from value help.
                     * Only fill backend/default UOM if row UOM is still blank.
                     */
                    if (!oItem.uom && oCheckResult.uom) {
                        oItem.uom = oCheckResult.uom;
                    }

                    oItem.uom = String(oItem.uom || "").trim().toUpperCase();

                    if (!oItem.uom) {
                        return {
                            valid: false,
                            message: "Row " + (i + 1) + ": UOM is mandatory."
                        };
                    }

                    oItem.sortString = this._cleanSortString(
                        oItem.sortStringValue || oItem.sortString || ""
                    );
                    oItem.sortStringValue = oItem.sortString;

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
                var aPendingDeletes = oItemModel
                    ? oItemModel.getProperty("/pendingDeletes") || []
                    : [];

                var aVisiblePayloads = aItems
                    .filter(function (oItem) {
                        return (
                            oItem.rowStatus === Constants.ROW_STATUS.CHANGED ||
                            oItem.rowStatus === Constants.ROW_STATUS.NEW
                        );
                    })
                    .map(
                        function (oItem) {
                            return this._buildSingleChangeBomPayload(oItem);
                        }.bind(this)
                    );

                var aDeletePayloads = aPendingDeletes.map(
                    function (oItem) {
                        return this._buildSingleChangeBomPayload(oItem);
                    }.bind(this)
                );

                return this._sortPayloadsForSafePosting(
                    aDeletePayloads.concat(aVisiblePayloads)
                );
            },

            _sortPayloadsForSafePosting: function (aPayloads) {
                var mPriority = {};

                mPriority[Constants.CHANGE_MODE.DELETE] = 1;
                mPriority[Constants.CHANGE_MODE.UPDATE] = 2;
                mPriority[Constants.CHANGE_MODE.INSERT] = 3;

                return (aPayloads || []).sort(function (a, b) {
                    return (mPriority[a.ChangeMode] || 99) - (mPriority[b.ChangeMode] || 99);
                });
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

                    BillOfMaterialVersion:
                        oItem.billOfMaterialVersion ||
                        oHeader.BillOfMaterialVersion ||
                        "",

                    HeaderChangeDocument:
                        oItem.headerChangeDocument ||
                        oHeader.HeaderChangeDocument ||
                        "",

                    BillOfMaterialItemNodeNumber:
                        sChangeMode === Constants.CHANGE_MODE.INSERT
                            ? ""
                            : oItem.billOfMaterialItemNodeNumber || "",

                    BillOfMaterialItemNumber:
                        oItem.item || "",

                    BillOfMaterialComponent:
                        this._toBackendMaterial(oItem.component || "").substring(0, 40),

                    BillOfMaterialItemQuantity:
                        Number(oItem.quantity || 0),

                    BillOfMaterialItemUnit:
                        String(oItem.uom || "").trim().toUpperCase().substring(0, 3),

                    BOMItemDescription:
                        String(oItem.remarks || "").substring(0, 40),

                    BOMItemSorter:
                        this._cleanSortString(
                            oItem.sortStringValue || oItem.sortString || ""
                        ).substring(0, 10),

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
                var oItemModel = this.getOwnerComponent().getModel("itemModel");

                ItemModel.setItems(oItemModel, aRows);
                oItemModel.setProperty("/pendingDeletes", []);

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

                aBackendItems = aBackendItems.filter(function (oItem) {
                    return (
                        oItem &&
                        (
                            oItem.BillOfMaterialComponent ||
                            oItem.billOfMaterialComponent ||
                            oItem.BillOfMaterialItemNumber ||
                            oItem.billOfMaterialItemNumber ||
                            oItem.BillOfMaterialItemNodeNumber ||
                            oItem.billOfMaterialItemNodeNumber
                        )
                    );
                });

                aBackendItems.sort(function (a, b) {
                    return (
                        Number(a.BillOfMaterialItemNumber || a.billOfMaterialItemNumber || 0) -
                        Number(b.BillOfMaterialItemNumber || b.billOfMaterialItemNumber || 0)
                    );
                });

                return this._normalizeFetchedChangeItems(aBackendItems);
            },

            _normalizeFetchedChangeItems: function (aFetchedItems) {
                return (aFetchedItems || []).map(
                    function (oItem, iIndex) {
                        var oRow = Object.assign({}, oItem);
                        var sBackendSortString = this._getRealBackendSortString(oItem);

                        oRow.sortString = sBackendSortString;
                        oRow.sortStringValue = sBackendSortString;

                        if (
                            this._cleanSortString(oRow.sortStringValue) ===
                            this._cleanSortString(
                                oRow.Plant ||
                                oRow.plant ||
                                oItem.Plant ||
                                oItem.plant ||
                                ""
                            )
                        ) {
                            oRow.sortString = "";
                            oRow.sortStringValue = "";
                        }

                        oRow.item =
                            oRow.item ||
                            oItem.BillOfMaterialItemNumber ||
                            oItem.billOfMaterialItemNumber ||
                            String(iIndex + 1).padStart(4, "0");

                        oRow.component =
                            oRow.component ||
                            oItem.BillOfMaterialComponent ||
                            oItem.billOfMaterialComponent ||
                            oItem.Component ||
                            oItem.component ||
                            "";

                        oRow.description = String(
                            oRow.description ||
                            oItem.ProductDescription ||
                            oItem.productDescription ||
                            oItem.productdescription ||
                            oItem.PRODUCTDESCRIPTION ||
                            oItem.ComponentDescription ||
                            oItem.componentDescription ||
                            oItem.componentdescription ||
                            oItem.COMPONENTDESCRIPTION ||
                            ""
                        ).substring(0, 40);

                        oRow.remarks = String(
                            oRow.remarks ||
                            oItem.BOMItemDescription ||
                            oItem.bomItemDescription ||
                            oItem.bomitemdescription ||
                            oItem.BOMITEMDESCRIPTION ||
                            oItem.ItemText ||
                            oItem.itemText ||
                            oItem.itemtext ||
                            ""
                        ).substring(0, 40);

                        oRow.quantity =
                            oRow.quantity ||
                            (
                                oItem.BillOfMaterialItemQuantity !== undefined &&
                                    oItem.BillOfMaterialItemQuantity !== null
                                    ? String(oItem.BillOfMaterialItemQuantity)
                                    : ""
                            ) ||
                            (
                                oItem.billOfMaterialItemQuantity !== undefined &&
                                    oItem.billOfMaterialItemQuantity !== null
                                    ? String(oItem.billOfMaterialItemQuantity)
                                    : ""
                            );

                        oRow.uom =
                            oRow.uom ||
                            oItem.BillOfMaterialItemUnit ||
                            oItem.billOfMaterialItemUnit ||
                            oItem.Uom ||
                            oItem.uom ||
                            "";

                        oRow.category =
                            oRow.category ||
                            oItem.BillOfMaterialItemCategory ||
                            oItem.billOfMaterialItemCategory ||
                            Constants.ITEM_CATEGORY;

                        oRow.rowStatus = Constants.ROW_STATUS.EXISTING;
                        oRow.changeMode = "";
                        oRow.isNew = false;
                        oRow.isChanged = false;
                        oRow.isDeleted = false;

                        oRow.billOfMaterial =
                            oRow.billOfMaterial ||
                            oItem.BillOfMaterial ||
                            oItem.billOfMaterial ||
                            "";

                        oRow.billOfMaterialCategory =
                            oRow.billOfMaterialCategory ||
                            oItem.BillOfMaterialCategory ||
                            oItem.billOfMaterialCategory ||
                            Constants.DEFAULTS.BILL_OF_MATERIAL_CATEGORY ||
                            "M";

                        oRow.billOfMaterialVariant =
                            oRow.billOfMaterialVariant ||
                            oItem.BillOfMaterialVariant ||
                            oItem.billOfMaterialVariant ||
                            "";

                        oRow.billOfMaterialVariantUsage =
                            oRow.billOfMaterialVariantUsage ||
                            oItem.BillOfMaterialVariantUsage ||
                            oItem.billOfMaterialVariantUsage ||
                            Constants.BOM_USAGE;

                        oRow.billOfMaterialVersion =
                            oRow.billOfMaterialVersion ||
                            oItem.BillOfMaterialVersion ||
                            oItem.billOfMaterialVersion ||
                            "";

                        oRow.headerChangeDocument =
                            oRow.headerChangeDocument ||
                            oItem.HeaderChangeDocument ||
                            oItem.headerChangeDocument ||
                            "";

                        oRow.material =
                            oRow.material ||
                            oItem.Material ||
                            oItem.material ||
                            "";

                        oRow.plant =
                            oRow.plant ||
                            oItem.Plant ||
                            oItem.plant ||
                            "";

                        oRow.billOfMaterialItemNodeNumber =
                            oRow.billOfMaterialItemNodeNumber ||
                            oItem.BillOfMaterialItemNodeNumber ||
                            oItem.billOfMaterialItemNodeNumber ||
                            "";

                        oRow.originalItemNumber =
                            oRow.originalItemNumber ||
                            oItem.BillOfMaterialItemNumber ||
                            oItem.billOfMaterialItemNumber ||
                            oRow.item ||
                            "";

                        oRow.isProductionRelevant =
                            oItem.IsProductionRelevant === undefined &&
                                oItem.isProductionRelevant === undefined
                                ? true
                                : !!(oItem.IsProductionRelevant || oItem.isProductionRelevant);

                        return oRow;
                    }.bind(this)
                );
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

                if (oItem.rowStatus === Constants.ROW_STATUS.NEW || oItem.isNew) {
                    oItem.rowStatus = Constants.ROW_STATUS.NEW;
                    oItem.changeMode = Constants.CHANGE_MODE.INSERT;
                    oItem.isNew = true;
                    oItem.isChanged = false;
                    oItem.isDeleted = false;
                } else {
                    oItem.rowStatus = Constants.ROW_STATUS.CHANGED;
                    oItem.changeMode = Constants.CHANGE_MODE.UPDATE;
                    oItem.isChanged = true;
                    oItem.isDeleted = false;
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
                                return (
                                    sValue.replace(/^0+/, "") === sSearch.replace(/^0+/, "")
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

            _cleanSortString: function (sSortString) {
                return String(sSortString || "").trim().toUpperCase();
            },

            _formatPlantDisplay: function (sPlant, sPlantName) {
                sPlant = String(sPlant || "").trim().toUpperCase();
                sPlantName = String(sPlantName || "").trim();

                if (!sPlant) {
                    return "";
                }

                if (!sPlantName) {
                    return sPlant;
                }

                return sPlant + " - " + sPlantName;
            },

            _isBulkBackendActionSuccess: function (oResponse) {
                var aResults = this._normalizeBulkActionResponse(oResponse);

                if (!aResults.length) {
                    return false;
                }

                return aResults.every(function (oResult) {
                    return (
                        oResult.Success === true ||
                        oResult.success === true ||
                        String(oResult.Status || oResult.status || "").toUpperCase() === "SUCCESS"
                    );
                });
            },

            _getBulkBackendActionMessage: function (oResponse) {
                var aResults = this._normalizeBulkActionResponse(oResponse);
                var aMessages = [];

                if (!aResults.length) {
                    return "No response returned from ChangeBOMItems.";
                }

                aResults.forEach(function (oResult, iIndex) {
                    var sStatus = String(oResult.Status || oResult.status || "").toUpperCase();
                    var bSuccess =
                        oResult.Success === true ||
                        oResult.success === true ||
                        sStatus === "SUCCESS";

                    var sMessage =
                        oResult.Message ||
                        oResult.message ||
                        oResult.ApiResponse ||
                        oResult.apiresponse ||
                        oResult.api_response ||
                        "";

                    if (!bSuccess) {
                        aMessages.push("Item " + (iIndex + 1) + ": " + sMessage);
                    }
                });

                if (aMessages.length) {
                    return aMessages.join("\n");
                }

                return "BOM item changes failed.";
            },

            _normalizeBulkActionResponse: function (oResponse) {
                if (!oResponse) {
                    return [];
                }

                if (Array.isArray(oResponse)) {
                    return oResponse;
                }

                if (Array.isArray(oResponse.value)) {
                    return oResponse.value;
                }

                if (Array.isArray(oResponse.results)) {
                    return oResponse.results;
                }

                if (Array.isArray(oResponse.Result)) {
                    return oResponse.Result;
                }

                if (Array.isArray(oResponse.result)) {
                    return oResponse.result;
                }

                return [oResponse];
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
                oResultModel.setProperty("/FullMessage", "");
                oResultModel.setProperty("/ShowMore", false);
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
                oResultModel.setProperty("/FullMessage", sMessage || "Processing...");
                oResultModel.setProperty("/ShowMore", false);
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
                oResultModel.setProperty("/FullMessage", sMessage || "Success.");
                oResultModel.setProperty("/ShowMore", false);
                oResultModel.setProperty("/MessageType", "Success");
                oResultModel.setProperty("/ShowMessage", true);
                oResultModel.setProperty("/CanSave", false);
                oResultModel.setProperty("/Editable", false);
            },

            _setResultError: function (oResultModel, sMessage) {
                if (!oResultModel) {
                    return;
                }

                var oMessageData = this._getLimitedMessageData(sMessage);

                oResultModel.setProperty("/Status", "ERROR");
                oResultModel.setProperty("/StatusState", "Error");
                oResultModel.setProperty("/Message", oMessageData.shortMessage);
                oResultModel.setProperty("/FullMessage", oMessageData.fullMessage);
                oResultModel.setProperty("/ShowMore", oMessageData.showMore);
                oResultModel.setProperty("/MessageType", "Error");
                oResultModel.setProperty("/ShowMessage", true);
                oResultModel.setProperty("/CanSave", true);
                oResultModel.setProperty("/Editable", true);
            },
         _getLimitedMessageData: function (sMessage) {
    var sFullMessage = String(sMessage || "");
    var iMaxChars = 250;
    var iMaxLines = 2;
    var aLines = sFullMessage.split(/\r?\n/);
    var bTooLong = sFullMessage.length > iMaxChars || aLines.length > iMaxLines;
    var sShortMessage;

    if (!bTooLong) {
        return {
            shortMessage: sFullMessage,
            fullMessage: sFullMessage,
            showMore: false
        };
    }

    sShortMessage = aLines.slice(0, iMaxLines).join("\n");

    if (sShortMessage.length > iMaxChars) {
        sShortMessage = sShortMessage.substring(0, iMaxChars);
    }

    sShortMessage += "\n\nMessage is too long. Click Show More to view full details.";

    return {
        shortMessage: sShortMessage,
        fullMessage: sFullMessage,
        showMore: true
    };
},

            _showLimitedErrorPopup: function (sMessage) {
                var oMessageData = this._getLimitedMessageData(sMessage);

                MessageBox.error(oMessageData.shortMessage);
            },

            onShowMoreMessage: function () {
                var oResultModel = this.getView().getModel("resultModel");
                var sFullMessage = "";

                if (oResultModel) {
                    sFullMessage =
                        oResultModel.getProperty("/FullMessage") ||
                        oResultModel.getProperty("/Message") ||
                        "";
                }

                if (!sFullMessage) {
                    MessageToast.show("No details available.");
                    return;
                }

                MessageBox.error(sFullMessage, {
                    title: "Full Error Details"
                });
            },
            _clearChangeBomData: function () {
                ItemValueHelpHelper.clearSortStringCache(this);

                var oItemModel = this.getOwnerComponent().getModel("itemModel");

                ItemModel.reset(oItemModel);

                if (oItemModel) {
                    oItemModel.setProperty("/pendingDeletes", []);
                }

                ResultModel.reset(this.getView().getModel("resultModel"));

                var oChangeModel = this.getOwnerComponent().getModel("changeModel");

                if (oChangeModel) {
                    oChangeModel.setProperty("/CanContinue", false);
                    oChangeModel.setProperty("/FetchedItems", []);
                    oChangeModel.setProperty("/HeaderData", null);
                    oChangeModel.setProperty("/Message", "");
                    oChangeModel.setProperty("/FullMessage", "");
                    oChangeModel.setProperty("/ShowMore", false);
                    oChangeModel.setProperty("/ShowMessage", false);
                }
            },

            _getErrorText: function (oError) {
                return ErrorHelper.getErrorText(oError);
            }
        });
    }
);
