sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
    "sap/ui/comp/filterbar/FilterBar",
    "sap/ui/comp/filterbar/FilterGroupItem",
    "sap/m/Input",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
], function (
    Controller,
    MessageToast,
    MessageBox,
    ValueHelpDialog,
    FilterBar,
    FilterGroupItem,
    Input,
    Filter,
    FilterOperator,
    JSONModel
) {
    "use strict";

    return Controller.extend("zppbomautomation.controller.View1", {

        onInit: function () {
            this._initHeaderModel();

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteView1").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            this._initHeaderModel();
        },

        _initHeaderModel: function () {
            var sToday = new Date().toISOString().slice(0, 10);

            var oHeaderData = {
                Material: "",
                Plant: "",
                BomUsage: "1",
                AltBom: "",
                BaseQty: 1,
                ValidFrom: sToday,
                BaseUom: "",

                CopyMaterial: "",
                CopyPlant: "",
                CopyAltBom: "",

                IsValidated: false,
                Message: "",
                MessageType: "Information",
                ShowMessage: false
            };

            var oModel = new JSONModel(oHeaderData);

            this.getOwnerComponent().setModel(oModel, "headerModel");
            this.getView().setModel(oModel, "headerModel");
        },

        onHeaderFieldChange: function () {
            var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

            if (!oHeaderModel) {
                return;
            }

            oHeaderModel.setProperty("/IsValidated", false);
            oHeaderModel.setProperty("/BaseUom", "");
            oHeaderModel.setProperty("/ShowMessage", false);
        },

        onContinue: function () {
            var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

            if (!oHeaderModel) {
                MessageBox.error("Header model is missing.");
                return;
            }

            var oHeader = oHeaderModel.getData();

            if (!oHeader.Material || !oHeader.Plant || !oHeader.BomUsage || !oHeader.AltBom) {
                MessageBox.error("Please fill Material, Plant, BOM Usage and Alternative BOM.");
                return;
            }

            if (!oHeader.BaseQty || Number(oHeader.BaseQty) <= 0) {
                MessageBox.error("Base Quantity must be greater than zero.");
                return;
            }

            this.getOwnerComponent().getRouter().navTo("RouteBOMItem");
        },

        onValidateMaterial: async function () {
            var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

            if (!oHeaderModel) {
                MessageBox.error("Header model is missing.");
                return;
            }

            var oHeader = oHeaderModel.getData();

            if (!oHeader.Material || !oHeader.Plant) {
                MessageBox.error("Please enter Material and Plant first.");
                return;
            }

            try {
                var oPayload = {
                    Material: oHeader.Material,
                    Plant: oHeader.Plant
                };

                var oResponse = await this._postAction(
                    "/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.ValidateMaterialPlant",
                    oPayload
                );

                oHeaderModel.setProperty("/Message", oResponse.Message || "");
                oHeaderModel.setProperty("/ShowMessage", true);

                if (oResponse.IsValid) {
                    oHeaderModel.setProperty("/BaseUom", oResponse.BaseUnit || "");
                    oHeaderModel.setProperty("/IsValidated", true);
                    oHeaderModel.setProperty("/MessageType", "Success");

                    MessageToast.show(oResponse.Message || "Material and Plant are valid.");
                } else {
                    oHeaderModel.setProperty("/BaseUom", "");
                    oHeaderModel.setProperty("/IsValidated", false);
                    oHeaderModel.setProperty("/MessageType", "Error");

                    MessageBox.error(oResponse.Message || "Material and Plant validation failed.");
                }
            } catch (oError) {
                MessageBox.error(this._getErrorText(oError));
            }
        },

        onCancel: function () {
            this._initHeaderModel();
            MessageToast.show("Form cleared");
        },

        onBomUsageValueHelp: function () {
            var that = this;

            var aData = [
                { Usage: "1", UsageText: "Production" },
                { Usage: "2", UsageText: "Engineering/Design" },
                { Usage: "3", UsageText: "Universal" },
                { Usage: "4", UsageText: "Plant Maintenance" },
                { Usage: "5", UsageText: "Sales and Distribution" },
                { Usage: "P", UsageText: "Predictive MRP" },
                { Usage: "S", UsageText: "Service Management" }
            ];

            var oModel = new JSONModel(aData);

            if (!this._oUsageVHD) {
                this._oUsageVHD = new ValueHelpDialog({
                    title: "Select BOM Usage",
                    supportMultiselect: false,
                    supportRanges: false,
                    key: "Usage",
                    descriptionKey: "UsageText",

                    ok: function (oEvent) {
                        var aTokens = oEvent.getParameter("tokens");

                        if (aTokens.length > 0) {
                            that.getOwnerComponent().getModel("headerModel")
                                .setProperty("/BomUsage", aTokens[0].getKey());
                        }

                        that._oUsageVHD.close();
                    },

                    cancel: function () {
                        that._oUsageVHD.close();
                    }
                });

                var oTable = new sap.m.Table({
                    columns: [
                        new sap.m.Column({
                            header: new sap.m.Label({ text: "Usage" })
                        }),
                        new sap.m.Column({
                            header: new sap.m.Label({ text: "Usage Text" })
                        })
                    ]
                });

                oTable.bindItems({
                    path: "/",
                    template: new sap.m.ColumnListItem({
                        type: "Active",
                        cells: [
                            new sap.m.Text({ text: "{Usage}" }),
                            new sap.m.Text({ text: "{UsageText}" })
                        ]
                    })
                });

                oTable.attachItemPress(function (oEvent) {
                    var oData = oEvent.getParameter("listItem").getBindingContext().getObject();

                    that.getOwnerComponent().getModel("headerModel")
                        .setProperty("/BomUsage", oData.Usage);

                    that.onHeaderFieldChange();
                    that._oUsageVHD.close();
                });

                this._oUsageVHD.setTable(oTable);
                this._oUsageVHD.setModel(oModel);
            }

            this._oUsageVHD.open();
        },

        onMaterialValueHelp: function () {
            var that = this;

            if (!this._oMatVHD) {
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

                    that._oMatTable.getBinding("items").filter(aFilters);
                };

                oFilterBar = new FilterBar({
                    showFilterConfiguration: false,
                    showGoOnFB: false,
                    filterBarExpanded: true,
                    useToolbar: false,
                    filterGroupItems: [
                        new FilterGroupItem({
                            groupName: "basic",
                            name: "Product",
                            label: "Product",
                            visibleInFilterBar: true,
                            control: new Input({
                                submit: fnDoSearch
                            })
                        }),
                        new FilterGroupItem({
                            groupName: "basic",
                            name: "ProductDescription",
                            label: "Product Description",
                            visibleInFilterBar: true,
                            control: new Input({
                                submit: fnDoSearch
                            })
                        })
                    ]
                });

                this._oMatTable = new sap.m.Table({
                    growing: true,
                    growingThreshold: 1000,
                    mode: "None",
                    columns: [
                        new sap.m.Column({
                            header: new sap.m.Label({ text: "Product" })
                        }),
                        new sap.m.Column({
                            header: new sap.m.Label({ text: "Product Description" })
                        })
                    ]
                });

                this._oMatTable.bindItems({
                    path: "/ZI_MATERIAL_VH",
                    template: new sap.m.ColumnListItem({
                        type: "Active",
                        cells: [
                            new sap.m.Text({ text: "{Product}" }),
                            new sap.m.Text({ text: "{ProductDescription}" })
                        ]
                    })
                });

                this._oMatTable.attachItemPress(function (oEvent) {
                    var oData = oEvent.getParameter("listItem").getBindingContext().getObject();

                    that.getOwnerComponent().getModel("headerModel")
                        .setProperty("/Material", oData.Product);

                    that.onHeaderFieldChange();
                    that._oMatVHD.close();
                });

                this._oMatVHD = new ValueHelpDialog({
                    title: "Select Material",
                    supportMultiselect: false,
                    filterBar: oFilterBar,
                    stretch: false,
                    contentWidth: "60%",
                    contentHeight: "60%",
                    ok: function () {
                        that._oMatVHD.close();
                    },
                    cancel: function () {
                        that._oMatVHD.close();
                    }
                });

                this._oMatTable.setModel(this.getOwnerComponent().getModel());
                this._oMatVHD.setTable(this._oMatTable);
            }

            this._oMatVHD.open();
        },

        onPlantValueHelp: function () {
            var that = this;

            if (!this._oPlantVHD) {
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

                    that._oPlantTable.getBinding("items").filter(aFilters);
                };

                oFilterBar = new FilterBar({
                    showFilterConfiguration: false,
                    showGoOnFB: false,
                    filterBarExpanded: true,
                    useToolbar: false,
                    filterGroupItems: [
                        new FilterGroupItem({
                            groupName: "basic",
                            name: "Plant",
                            label: "Plant",
                            visibleInFilterBar: true,
                            control: new Input({
                                submit: fnDoSearch
                            })
                        }),
                        new FilterGroupItem({
                            groupName: "basic",
                            name: "PlantName",
                            label: "Plant Name",
                            visibleInFilterBar: true,
                            control: new Input({
                                submit: fnDoSearch
                            })
                        })
                    ]
                });

                this._oPlantTable = new sap.m.Table({
                    growing: true,
                    growingThreshold: 500,
                    mode: "None",
                    columns: [
                        new sap.m.Column({
                            header: new sap.m.Label({ text: "Plant" })
                        }),
                        new sap.m.Column({
                            header: new sap.m.Label({ text: "Plant Name" })
                        })
                    ]
                });

                this._oPlantTable.bindItems({
                    path: "/ZI_plant_vh",
                    template: new sap.m.ColumnListItem({
                        type: "Active",
                        cells: [
                            new sap.m.Text({ text: "{Plant}" }),
                            new sap.m.Text({ text: "{PlantName}" })
                        ]
                    })
                });

                this._oPlantTable.attachItemPress(function (oEvent) {
                    var oData = oEvent.getParameter("listItem").getBindingContext().getObject();

                    that.getOwnerComponent().getModel("headerModel")
                        .setProperty("/Plant", oData.Plant);

                    that.onHeaderFieldChange();
                    that._oPlantVHD.close();
                });

                this._oPlantVHD = new ValueHelpDialog({
                    title: "Select Plant",
                    supportMultiselect: false,
                    filterBar: oFilterBar,
                    stretch: false,
                    contentWidth: "60%",
                    contentHeight: "60%",
                    ok: function () {
                        that._oPlantVHD.close();
                    },
                    cancel: function () {
                        that._oPlantVHD.close();
                    }
                });

                this._oPlantTable.setModel(this.getOwnerComponent().getModel());
                this._oPlantVHD.setTable(this._oPlantTable);
            }

            this._oPlantVHD.open();
        },

        _postAction: function (sRelativePath, oPayload) {
            var oModel = this.getOwnerComponent().getModel();
            var sServiceUrl = oModel.getServiceUrl().replace(/\/$/, "");
            var sUrl = sServiceUrl + sRelativePath;

            return new Promise(function (resolve, reject) {
                jQuery.ajax({
                    url: sServiceUrl + "/",
                    method: "GET",
                    headers: {
                        "X-CSRF-Token": "Fetch",
                        "Accept": "application/json"
                    },
                    success: function (data, textStatus, jqXHR) {
                        var sToken = jqXHR.getResponseHeader("X-CSRF-Token");

                        if (!sToken) {
                            reject({
                                responseText: "CSRF token could not be fetched from service root."
                            });
                            return;
                        }

                        jQuery.ajax({
                            url: sUrl,
                            method: "POST",
                            contentType: "application/json",
                            headers: {
                                "Accept": "application/json",
                                "X-CSRF-Token": sToken
                            },
                            data: JSON.stringify(oPayload || {}),
                            success: function (oData) {
                                resolve(oData);
                            },
                            error: function (oXHR) {
                                reject(oXHR);
                            }
                        });
                    },
                    error: function (oXHR) {
                        reject(oXHR);
                    }
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
            } catch (e) {
                return oError.responseText || oError.message || "Unexpected error occurred.";
            }
        }

    });
});