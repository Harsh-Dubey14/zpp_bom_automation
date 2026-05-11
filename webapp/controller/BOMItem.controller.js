/* eslint-disable max-params */
/* global jQuery */

sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/export/Spreadsheet",
    "sap/ui/model/json/JSONModel",
    "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
    "sap/ui/comp/filterbar/FilterBar",
    "sap/ui/comp/filterbar/FilterGroupItem",
    "sap/m/Input",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/BusyIndicator"
], function (
    Controller,
    History,
    MessageToast,
    MessageBox,
    Spreadsheet,
    JSONModel,
    ValueHelpDialog,
    FilterBar,
    FilterGroupItem,
    Input,
    Filter,
    FilterOperator,
    BusyIndicator
) {
    "use strict";

    return Controller.extend("zppbomautomation.controller.BOMItem", {

        onInit: function () {
            var oItemModel = new JSONModel({
                items: []
            });

            var oResultModel = new JSONModel({
                BomId: "",
                Status: "",
                StatusState: "None",
                Message: "",
                MessageType: "Information",
                ShowMessage: false,
                BillOfMaterial: "",
                CreatedBomVariant: "",
                CanSave: true,
                CanRetry: false,
                Editable: true
            });

            this.getView().setModel(oItemModel, "itemModel");
            this.getView().setModel(oResultModel, "resultModel");

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteBOMItem").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

            if (!oHeaderModel) {
                this.getOwnerComponent().getRouter().navTo("RouteView1", {}, true);
                return;
            }

            this.getView().setModel(oHeaderModel, "headerModel");
            this._resetResultModel();

            var oItemModel = this.getView().getModel("itemModel");
            var aItems = oItemModel.getProperty("/items") || [];

            if (aItems.length === 0) {
                this.onAddRow();
            }
        },

        _resetResultModel: function () {
            var oResultModel = this.getView().getModel("resultModel");

            oResultModel.setData({
                BomId: "",
                Status: "",
                StatusState: "None",
                Message: "",
                MessageType: "Information",
                ShowMessage: false,
                BillOfMaterial: "",
                CreatedBomVariant: "",
                CanSave: true,
                CanRetry: false,
                Editable: true
            });
        },

        onNavBack: function () {
            var sPreviousHash = History.getInstance().getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("RouteView1", {}, true);
            }
        },

        onAddRow: function () {
            var oModel = this.getView().getModel("itemModel");
            var aItems = oModel.getProperty("/items") || [];

            var iNextItem = 10;

            if (aItems.length > 0) {
                var iLastItem = parseInt(aItems[aItems.length - 1].item, 10);
                iNextItem = iLastItem + 10;
            }

            aItems.push({
                item: iNextItem,
                component: "",
                description: "",
                quantity: 1,
                uom: "",
                sortString: "",
                category: "L",
                itemText: ""
            });

            oModel.setProperty("/items", aItems);
        },

        onDelete: function () {
            var oTable = this.byId("bomItemsTable");
            var oModel = this.getView().getModel("itemModel");
            var aItems = oModel.getProperty("/items") || [];
            var aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                MessageToast.show("Please select items to delete");
                return;
            }

            var aIndexesToDelete = aSelectedItems.map(function (oItem) {
                return oTable.indexOfItem(oItem);
            });

            aIndexesToDelete.sort(function (a, b) {
                return b - a;
            });

            aIndexesToDelete.forEach(function (iIndex) {
                aItems.splice(iIndex, 1);
            });

            aItems.forEach(function (oItem, iIndex) {
                oItem.item = (iIndex + 1) * 10;
            });

            oModel.setProperty("/items", aItems);
            oTable.removeSelections(true);

            MessageToast.show("Selected items deleted");
        },

        onSelectAll: function () {
            var oTable = this.byId("bomItemsTable");

            oTable.selectAll();
            MessageToast.show("All items selected");
        },

        onSave: async function () {
            var oResultModel = this.getView().getModel("resultModel");

            try {
                var oValidation = this._validateBeforeSave();

                if (!oValidation.valid) {
                    MessageBox.error(oValidation.message);
                    return;
                }

                var oPayload = this._buildBomCreatePayload();

                oResultModel.setProperty("/CanSave", false);
                oResultModel.setProperty("/Message", "Creating BOM...");
                oResultModel.setProperty("/MessageType", "Information");
                oResultModel.setProperty("/ShowMessage", true);

                BusyIndicator.show(0);

                var oResponse = await this._createBom(oPayload);


                this._handleCreateResponse(oResponse);
            } catch (oError) {
                var sErrorText = this._getErrorText(oError);

            

                oResultModel.setProperty("/CanSave", true);
                oResultModel.setProperty("/Message", sErrorText);
                oResultModel.setProperty("/MessageType", "Error");
                oResultModel.setProperty("/ShowMessage", true);

                MessageBox.error(sErrorText);
            } finally {
                BusyIndicator.hide();
            }
        },

        _validateBeforeSave: function () {
            var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

            if (!oHeaderModel) {
                return {
                    valid: false,
                    message: "Header data is missing. Please go back and enter header details."
                };
            }

            var oHeader = oHeaderModel.getData();
            var aItems = this.getView().getModel("itemModel").getProperty("/items") || [];

            if (!oHeader.Material) {
                return {
                    valid: false,
                    message: "Material is required."
                };
            }

            if (!oHeader.Plant) {
                return {
                    valid: false,
                    message: "Plant is required."
                };
            }

            if (!oHeader.BomUsage) {
                return {
                    valid: false,
                    message: "BOM Usage is required."
                };
            }

            if (!oHeader.AltBom) {
                return {
                    valid: false,
                    message: "Alternative BOM is required."
                };
            }

            if (!oHeader.BaseQty || Number(oHeader.BaseQty) <= 0) {
                return {
                    valid: false,
                    message: "Base Quantity must be greater than zero."
                };
            }

            if (!oHeader.ValidFrom) {
                return {
                    valid: false,
                    message: "Valid From date is required."
                };
            }

            if (!aItems.length) {
                return {
                    valid: false,
                    message: "Please add at least one BOM item."
                };
            }

            for (var i = 0; i < aItems.length; i++) {
                var oItem = aItems[i];
                var sPrefix = "Row " + (i + 1) + ": ";

                if (!oItem.component) {
                    return {
                        valid: false,
                        message: sPrefix + "Component is required."
                    };
                }

                if (!oItem.quantity || Number(oItem.quantity) <= 0) {
                    return {
                        valid: false,
                        message: sPrefix + "Quantity must be greater than zero."
                    };
                }

                if (!oItem.uom) {
                    return {
                        valid: false,
                        message: sPrefix + "UOM is required."
                    };
                }
            }

            return {
                valid: true,
                message: ""
            };
        },

        _buildBomCreatePayload: function () {
            var oHeader = this.getOwnerComponent().getModel("headerModel").getData();
            var aItems = this.getView().getModel("itemModel").getProperty("/items") || [];

            return {
                Material: oHeader.Material,
                Plant: oHeader.Plant,
                BomUsage: oHeader.BomUsage || "1",
                AltBom: oHeader.AltBom,
                BaseQty: Number(oHeader.BaseQty || 1),
                ValidFrom: oHeader.ValidFrom,
                _Item: aItems.map(function (oItem, iIndex) {
                    return {
                        ItemNo: this._formatItemNo(oItem.item || ((iIndex + 1) * 10)),
                        ItemCategory: oItem.category || "L",
                        Component: oItem.component,
                        Quantity: Number(oItem.quantity),
                        Uom: oItem.uom,
                        ItemText: oItem.itemText || ""
                    };
                }.bind(this))
            };
        },

        _createBom: async function (oPayload) {
            return await this._postAction("/BomCreate", oPayload);
        },

        _handleCreateResponse: function (oResponse) {
            var oResultModel = this.getView().getModel("resultModel");

            var sStatus = oResponse.Status || "";
            var sMessage = oResponse.Message || "";
            var sBomId = oResponse.BomId || "";
            var sBillOfMaterial = this._extractBillOfMaterial(oResponse.ApiResponse);

            oResultModel.setProperty("/BomId", sBomId);
            oResultModel.setProperty("/Status", sStatus);
            oResultModel.setProperty("/Message", sMessage);
            oResultModel.setProperty("/ShowMessage", true);
            oResultModel.setProperty("/BillOfMaterial", sBillOfMaterial);

            if (sStatus === "SUCCESS") {
                oResultModel.setProperty("/StatusState", "Success");
                oResultModel.setProperty("/MessageType", "Success");
                oResultModel.setProperty("/CanSave", false);
                oResultModel.setProperty("/CanRetry", false);
                oResultModel.setProperty("/Editable", false);

                var sSuccessMessage = sBillOfMaterial
                    ? "BOM created successfully. BOM Number: " + sBillOfMaterial
                    : (sMessage || "BOM created successfully.");

                MessageBox.success(sSuccessMessage);
                return;
            }

            if (sStatus === "ERROR") {
                oResultModel.setProperty("/StatusState", "Error");
                oResultModel.setProperty("/MessageType", "Error");
                oResultModel.setProperty("/CanSave", true);
                oResultModel.setProperty("/CanRetry", !!sBomId);
                oResultModel.setProperty("/Editable", true);

                MessageBox.error(sMessage || "BOM creation failed.");
                return;
            }

            oResultModel.setProperty("/StatusState", "Warning");
            oResultModel.setProperty("/MessageType", "Warning");
            oResultModel.setProperty("/CanSave", true);
            oResultModel.setProperty("/CanRetry", !!sBomId);
            oResultModel.setProperty("/Editable", true);

            MessageBox.warning(sMessage || "BOM request saved, but final status is not SUCCESS.");
        },

        onRetrySubmit: async function () {
            var oResultModel = this.getView().getModel("resultModel");

            try {
                var sBomId = oResultModel.getProperty("/BomId");

                if (!sBomId) {
                    MessageBox.error("Cannot retry because BOM Request ID is missing.");
                    return;
                }

                oResultModel.setProperty("/Message", "Retrying BOM submit...");
                oResultModel.setProperty("/MessageType", "Information");
                oResultModel.setProperty("/ShowMessage", true);

                BusyIndicator.show(0);

                var sActionPath = this._buildSubmitActionPath(sBomId);
                var oResponse = await this._postAction(sActionPath, {});

                this._handleCreateResponse(oResponse);
            } catch (oError) {
                var sErrorText = this._getErrorText(oError);

                oResultModel.setProperty("/Message", sErrorText);
                oResultModel.setProperty("/MessageType", "Error");
                oResultModel.setProperty("/ShowMessage", true);

                MessageBox.error(sErrorText);
            } finally {
                BusyIndicator.hide();
            }
        },

        _buildSubmitActionPath: function (sBomId) {
            return "/BomCreate(" + encodeURIComponent(sBomId) + ")/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.SubmitBOM";
        },

        onCancel: function () {
            var that = this;

            MessageBox.warning("Are you sure you want to cancel? All item data will be lost.", {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,

                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that.getView().getModel("itemModel").setProperty("/items", []);
                        that._resetResultModel();
                        that.getOwnerComponent().getRouter().navTo("RouteView1", {}, true);
                    }
                }
            });
        },

        onNewBOM: function () {
            this.getView().getModel("itemModel").setProperty("/items", []);
            this._resetResultModel();
            this.getOwnerComponent().setModel(null, "headerModel");
            this.getOwnerComponent().getRouter().navTo("RouteView1", {}, true);
        },

        onExportExcel: function () {
            var oTable = this.byId("bomItemsTable");
            var aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                MessageToast.show("Please select items to export");
                return;
            }

            var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

            if (!oHeaderModel) {
                MessageBox.error("Header data is missing.");
                return;
            }

            var oHeader = oHeaderModel.getData();

            var aExportData = aSelectedItems.map(function (oItem) {
                var oData = oItem.getBindingContext("itemModel").getObject();

                return {
                    Material: oHeader.Material,
                    Plant: oHeader.Plant,
                    BomUsage: oHeader.BomUsage,
                    AltBom: oHeader.AltBom,
                    item: oData.item,
                    component: oData.component,
                    description: oData.description,
                    quantity: oData.quantity,
                    uom: oData.uom,
                    sortString: oData.sortString,
                    category: oData.category,
                    itemText: oData.itemText
                };
            });

            var aCols = [
                {
                    label: "Material",
                    property: "Material"
                },
                {
                    label: "Plant",
                    property: "Plant"
                },
                {
                    label: "BOM Usage",
                    property: "BomUsage"
                },
                {
                    label: "Alternative BOM",
                    property: "AltBom"
                },
                {
                    label: "Item",
                    property: "item"
                },
                {
                    label: "Component",
                    property: "component"
                },
                {
                    label: "Description",
                    property: "description"
                },
                {
                    label: "Quantity",
                    property: "quantity"
                },
                {
                    label: "UoM",
                    property: "uom"
                },
                {
                    label: "Sort String",
                    property: "sortString"
                },
                {
                    label: "Category",
                    property: "category"
                },
                {
                    label: "Item Text",
                    property: "itemText"
                }
            ];

            var oSettings = {
                workbook: {
                    columns: aCols
                },
                dataSource: aExportData,
                fileName: "BOM_Items.xlsx"
            };

            var oSpreadsheet = new Spreadsheet(oSettings);

            oSpreadsheet.build().then(function () {
                MessageToast.show("Excel downloaded");
            });
        },

        onUomValueHelp: function (oEvent) {
            var that = this;
            var oInput = oEvent.getSource();

            this._oCurrentContext = oInput.getBindingContext("itemModel");

            if (!this._oCurrentContext) {
                MessageBox.error("Could not determine selected item row.");
                return;
            }

            if (!this._oUomVHD) {
                var oFilterBar;

                var fnDoSearch = function () {
                    var aFilters = [];
                    var aItems = oFilterBar.getFilterGroupItems();

                    aItems.forEach(function (oItem) {
                        var sValue = oItem.getControl().getValue();

                        if (sValue) {
                            aFilters.push(new Filter(
                                oItem.getName(),
                                FilterOperator.Contains,
                                sValue
                            ));
                        }
                    });

                    that._oUomTable.getBinding("items").filter(aFilters);
                };

                oFilterBar = new FilterBar({
                    showFilterConfiguration: false,
                    showGoOnFB: false,
                    filterBarExpanded: true,
                    useToolbar: false,
                    filterGroupItems: [
                        new FilterGroupItem({
                            groupName: "basic",
                            name: "UnitOfMeasure",
                            label: "UoM",
                            visibleInFilterBar: true,
                            control: new Input({
                                submit: fnDoSearch
                            })
                        }),
                        new FilterGroupItem({
                            groupName: "basic",
                            name: "UnitOfMeasure_Text",
                            label: "Description",
                            visibleInFilterBar: true,
                            control: new Input({
                                submit: fnDoSearch
                            })
                        })
                    ]
                });

                this._oUomTable = new sap.m.Table({
                    growing: true,
                    growingThreshold: 500,
                    mode: "None",
                    columns: [
                        new sap.m.Column({
                            header: new sap.m.Label({
                                text: "UoM"
                            })
                        }),
                        new sap.m.Column({
                            header: new sap.m.Label({
                                text: "Description"
                            })
                        })
                    ]
                });

                this._oUomTable.bindItems({
                    path: "/I_UnitOfMeasure",
                    template: new sap.m.ColumnListItem({
                        type: "Active",
                        cells: [
                            new sap.m.Text({
                                text: "{UnitOfMeasure}"
                            }),
                            new sap.m.Text({
                                text: "{UnitOfMeasure_Text}"
                            })
                        ]
                    })
                });

                this._oUomTable.attachItemPress(function (oSelectEvent) {
                    var oData = oSelectEvent.getParameter("listItem").getBindingContext().getObject();

                    that._oCurrentContext.getModel().setProperty(
                        that._oCurrentContext.getPath() + "/uom",
                        oData.UnitOfMeasure
                    );

                    that._oUomVHD.close();
                });

                this._oUomVHD = new ValueHelpDialog({
                    title: "Select UoM",
                    supportMultiselect: false,
                    filterBar: oFilterBar,
                    stretch: false,
                    contentWidth: "60%",
                    contentHeight: "60%",

                    ok: function () {
                        that._oUomVHD.close();
                    },

                    cancel: function () {
                        that._oUomVHD.close();
                    }
                });

                this._oUomTable.setModel(this.getOwnerComponent().getModel());
                this._oUomVHD.setTable(this._oUomTable);
            }

            this._oUomVHD.open();
        },

        _formatItemNo: function (vItem) {
            var iItem = parseInt(vItem, 10);

            if (isNaN(iItem)) {
                iItem = 10;
            }

            return String(iItem).padStart(4, "0");
        },

        _extractBillOfMaterial: function (sApiResponse) {
            if (!sApiResponse) {
                return "";
            }

            try {
                var oApiResponse = typeof sApiResponse === "string"
                    ? JSON.parse(sApiResponse)
                    : sApiResponse;

                if (oApiResponse.BillOfMaterial) {
                    return oApiResponse.BillOfMaterial;
                }

                if (oApiResponse.d && oApiResponse.d.BillOfMaterial) {
                    return oApiResponse.d.BillOfMaterial;
                }

                return "";
            } catch (oParseError) {
                void oParseError;

                var aMatch = String(sApiResponse).match(/"BillOfMaterial"\s*:\s*"([^"]+)"/);
                return aMatch ? aMatch[1] : "";
            }
        },

        _postAction: function (sRelativePath, oPayload) {
            var oModel = this.getOwnerComponent().getModel();
            var sServiceUrl = oModel.getServiceUrl().replace(/\/$/, "");
            var sUrl = sServiceUrl + sRelativePath;

            return jQuery.ajax({
                url: sServiceUrl + "/",
                method: "GET",
                headers: {
                    "X-CSRF-Token": "Fetch",
                    "Accept": "application/json"
                }
            }).then(function (data, textStatus, jqXHR) {
                var sToken = jqXHR.getResponseHeader("X-CSRF-Token");

                if (!sToken) {
                    return jQuery.Deferred().reject({
                        responseText: "CSRF token could not be fetched from service root."
                    }).promise();
                }

                return jQuery.ajax({
                    url: sUrl,
                    method: "POST",
                    contentType: "application/json",
                    headers: {
                        "Accept": "application/json",
                        "X-CSRF-Token": sToken
                    },
                    data: JSON.stringify(oPayload || {})
                });
            });
        },

        _getErrorText: function (oError) {
            try {
                if (oError.responseJSON && oError.responseJSON.error) {
                    var vMessage = oError.responseJSON.error.message;

                    if (typeof vMessage === "string") {
                        return vMessage;
                    }

                    if (vMessage && vMessage.value) {
                        return vMessage.value;
                    }

                    return JSON.stringify(oError.responseJSON.error);
                }

                if (oError.responseText) {
                    var oParsed = JSON.parse(oError.responseText);

                    if (oParsed.error) {
                        if (typeof oParsed.error.message === "string") {
                            return oParsed.error.message;
                        }

                        if (oParsed.error.message && oParsed.error.message.value) {
                            return oParsed.error.message.value;
                        }
                    }

                    return oError.responseText;
                }

                return oError.message || "Unexpected error occurred.";
            } catch (oParseError) {
                void oParseError;

                return oError.responseText || oError.message || "Unexpected error occurred.";
            }
        }

    });
});