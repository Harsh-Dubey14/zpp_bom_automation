sap.ui.define(
    [
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
    ],
    function (
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
                oRouter
                    .getRoute("RouteView1")
                    .attachPatternMatched(this._onRouteMatched, this);
            },

            _onRouteMatched: function (oEvent) {
                var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

                if (!oHeaderModel) {
                    this._initHeaderModel();
                    oHeaderModel = this.getOwnerComponent().getModel("headerModel");
                }

                var oArguments = oEvent.getParameter("arguments") || {};
                var oQuery = oArguments["?query"];

                if (oQuery) {
                    var sToday = new Date().toISOString().slice(0, 10);

                    var oHeaderData = {
                        Material: oQuery.Material || "",
                        Plant: oQuery.Plant || "",
                        BomUsage: oQuery.BomUsage || "1",
                        AltBom: oQuery.AltBom || "",
                        BaseQty: oQuery.BaseQty ? Number(oQuery.BaseQty) : 1,
                        ValidFrom: oQuery.ValidFrom || sToday,
                        BaseUom: oQuery.BaseUom || "",

                        CopyMaterial: oQuery.CopyMaterial || "",
                        CopyPlant: oQuery.CopyPlant || "",
                        CopyAltBom: oQuery.CopyAltBom || "",

                        IsValidated: oQuery.IsValidated === "true",
                        Message: oQuery.Message || "",
                        MessageType: oQuery.MessageType || "Information",
                        ShowMessage: oQuery.ShowMessage === "true"
                    };

                    oHeaderModel.setData(oHeaderData);
                }

                this.getView().setModel(oHeaderModel, "headerModel");
            },

            _initHeaderModel: function () {
                var oExistingModel = this.getOwnerComponent().getModel("headerModel");

                if (oExistingModel) {
                    this.getView().setModel(oExistingModel, "headerModel");
                    return;
                }

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

            _syncHeaderToRoute: function () {
                var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

                if (!oHeaderModel) {
                    return;
                }

                var oHeader = oHeaderModel.getData();

                this.getOwnerComponent()
                    .getRouter()
                    .navTo(
                        "RouteView1",
                        {
                            "?query": {
                                Material: oHeader.Material || "",
                                Plant: oHeader.Plant || "",
                                BomUsage: oHeader.BomUsage || "1",
                                AltBom: oHeader.AltBom || "",
                                BaseQty: String(oHeader.BaseQty || 1),
                                ValidFrom: oHeader.ValidFrom || "",
                                BaseUom: oHeader.BaseUom || "",

                                CopyMaterial: oHeader.CopyMaterial || "",
                                CopyPlant: oHeader.CopyPlant || "",
                                CopyAltBom: oHeader.CopyAltBom || "",

                                IsValidated: String(!!oHeader.IsValidated),
                                Message: oHeader.Message || "",
                                MessageType: oHeader.MessageType || "Information",
                                ShowMessage: String(!!oHeader.ShowMessage)
                            }
                        },
                        true
                    );
            },

            onHeaderFieldChange: function () {
                var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

                if (!oHeaderModel) {
                    return;
                }

                /*
                 * Whenever Material / Plant / BOM Usage changes,
                 * old validation, Base UOM and Alternate BOM must be cleared.
                 */
                oHeaderModel.setProperty("/IsValidated", false);
                oHeaderModel.setProperty("/BaseUom", "");
                oHeaderModel.setProperty("/AltBom", "");
                oHeaderModel.setProperty("/Message", "");
                oHeaderModel.setProperty("/MessageType", "Information");
                oHeaderModel.setProperty("/ShowMessage", false);

                this._syncHeaderToRoute();
            },

            onContinue: function () {
                var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

                if (!oHeaderModel) {
                    MessageBox.error("Header model is missing.");
                    return;
                }

                var oHeader = oHeaderModel.getData();

                /*
                 * Alternate BOM is not entered by user anymore.
                 * It comes from GetNextAltBOM API.
                 */
                if (!oHeader.Material || !oHeader.Plant || !oHeader.BomUsage) {
                    MessageBox.error("Please fill Material, Plant and BOM Usage.");
                    return;
                }

                if (!oHeader.BaseQty || Number(oHeader.BaseQty) <= 0) {
                    MessageBox.error("Base Quantity must be greater than zero.");
                    return;
                }

                if (!oHeader.IsValidated) {
                    MessageBox.error(
                        "Please validate Material, Plant and BOM Usage before continuing."
                    );
                    return;
                }

                if (!oHeader.AltBom) {
                    MessageBox.error("Alternate BOM is missing. Please validate again.");
                    return;
                }

                this._syncHeaderToRoute();

                this.getOwnerComponent().getRouter().navTo("RouteBOMItem");
            },

            onValidateMaterial: async function () {
                var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

                if (!oHeaderModel) {
                    MessageBox.error("Header model is missing.");
                    return;
                }

                var oHeader = oHeaderModel.getData();

                /*
                 * New required fields for validation:
                 * Material + Plant + BOM Usage
                 */
                if (!oHeader.Material || !oHeader.Plant || !oHeader.BomUsage) {
                    MessageBox.error("Please enter Material, Plant and BOM Usage first.");
                    return;
                }

                try {
                    /*
                     * Step 1: Validate Material + Plant
                     */
                    var oValidatePayload = {
                        Material: oHeader.Material,
                        Plant: oHeader.Plant
                    };

                    var oValidateResponse = await this._postAction(
                        "/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.ValidateMaterialPlant",
                        oValidatePayload
                    );

                    if (!oValidateResponse.IsValid) {
                        oHeaderModel.setProperty("/BaseUom", "");
                        oHeaderModel.setProperty("/AltBom", "");
                        oHeaderModel.setProperty("/IsValidated", false);
                        oHeaderModel.setProperty("/Message", oValidateResponse.Message || "");
                        oHeaderModel.setProperty("/MessageType", "Error");
                        oHeaderModel.setProperty("/ShowMessage", true);

                        MessageBox.error(
                            oValidateResponse.Message ||
                                "Material and Plant validation failed."
                        );

                        this._syncHeaderToRoute();
                        return;
                    }

                    oHeaderModel.setProperty("/BaseUom", oValidateResponse.BaseUnit || "");

                    /*
                     * Step 2: Get Next Alternate BOM
                     */
                    var oAltBomPayload = {
                        Material: oHeader.Material,
                        Plant: oHeader.Plant,
                        BomUsage: oHeader.BomUsage
                    };

                    var oAltBomResponse = await this._postAction(
                        "/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.GetNextAltBOM",
                        oAltBomPayload
                    );

                    oHeaderModel.setProperty("/Message", oAltBomResponse.Message || "");
                    oHeaderModel.setProperty("/ShowMessage", true);

                    if (oAltBomResponse.Success) {
                        oHeaderModel.setProperty(
                            "/AltBom",
                            oAltBomResponse.NextAltBom || ""
                        );
                        oHeaderModel.setProperty("/IsValidated", true);
                        oHeaderModel.setProperty("/MessageType", "Success");

                        MessageToast.show(
                            oAltBomResponse.Message ||
                                "Material, Plant and BOM Usage are valid."
                        );
                    } else {
                        oHeaderModel.setProperty("/AltBom", "");
                        oHeaderModel.setProperty("/IsValidated", false);
                        oHeaderModel.setProperty("/MessageType", "Error");

                        MessageBox.error(
                            oAltBomResponse.Message ||
                                "Alternate BOM could not be determined."
                        );
                    }

                    this._syncHeaderToRoute();
                } catch (oError) {
                    oHeaderModel.setProperty("/BaseUom", "");
                    oHeaderModel.setProperty("/AltBom", "");
                    oHeaderModel.setProperty("/IsValidated", false);
                    oHeaderModel.setProperty("/Message", this._getErrorText(oError));
                    oHeaderModel.setProperty("/MessageType", "Error");
                    oHeaderModel.setProperty("/ShowMessage", true);

                    this._syncHeaderToRoute();

                    MessageBox.error(this._getErrorText(oError));
                }
            },

            onCancel: function () {
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

                var oHeaderModel = this.getOwnerComponent().getModel("headerModel");

                if (oHeaderModel) {
                    oHeaderModel.setData(oHeaderData);
                } else {
                    oHeaderModel = new JSONModel(oHeaderData);
                    this.getOwnerComponent().setModel(oHeaderModel, "headerModel");
                    this.getView().setModel(oHeaderModel, "headerModel");
                }

                this.getOwnerComponent().getRouter().navTo(
                    "RouteView1",
                    {
                        "?query": {}
                    },
                    true
                );

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
                                that
                                    .getOwnerComponent()
                                    .getModel("headerModel")
                                    .setProperty("/BomUsage", aTokens[0].getKey());

                                that.onHeaderFieldChange();
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
                        var oData = oEvent
                            .getParameter("listItem")
                            .getBindingContext()
                            .getObject();

                        that
                            .getOwnerComponent()
                            .getModel("headerModel")
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
                this._sMaterialTargetProperty = "/Material";
                this._openMaterialValueHelp();
            },

            onCopyMaterialValueHelp: function () {
                this._sMaterialTargetProperty = "/CopyMaterial";
                this._openMaterialValueHelp();
            },

            _openMaterialValueHelp: function () {
                var that = this;

                if (!this._oMatVHD) {
                    var oFilterBar;

                    var fnDoSearch = function () {
                        var aFilters = [];
                        var aItems = oFilterBar.getFilterGroupItems();

                        aItems.forEach(function (oItem) {
                            var sValue = oItem.getControl().getValue();

                            if (sValue) {
                                aFilters.push(
                                    new Filter(
                                        oItem.getName(),
                                        FilterOperator.Contains,
                                        sValue
                                    )
                                );
                            }
                        });

                        var oBinding = that._oMatTable.getBinding("items");

                        if (oBinding) {
                            oBinding.filter(aFilters);
                        }
                    };

                    oFilterBar = new FilterBar({
                        showFilterConfiguration: false,
                        showGoOnFB: true,
                        filterBarExpanded: true,
                        useToolbar: true,
                        search: fnDoSearch,
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
                        mode: "SingleSelectLeft",
                        includeItemInSelection: true,
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
                        path: "/product_plant_vh",
                        template: new sap.m.ColumnListItem({
                            type: "Active",
                            cells: [
                                new sap.m.Text({ text: "{Product}" }),
                                new sap.m.Text({ text: "{ProductDescription}" })
                            ]
                        })
                    });

                    this._oMatTable.attachItemPress(function (oEvent) {
                        var oItem = oEvent.getParameter("listItem");

                        if (oItem) {
                            that._oMatTable.setSelectedItem(oItem, true);
                        }
                    });

                    this._oMatVHD = new ValueHelpDialog({
                        title: "Select Product",
                        supportMultiselect: false,
                        supportRanges: false,
                        filterBar: oFilterBar,
                        stretch: false,
                        contentWidth: "70%",
                        contentHeight: "60%",

                        ok: function () {
                            var oSelectedItem = that._oMatTable.getSelectedItem();

                            if (!oSelectedItem) {
                                MessageBox.error("Please select one product.");
                                return;
                            }

                            var oData = oSelectedItem.getBindingContext().getObject();
                            var oHeaderModel =
                                that.getOwnerComponent().getModel("headerModel");
                            var sTargetProperty =
                                that._sMaterialTargetProperty || "/Material";

                            if (sTargetProperty === "/CopyMaterial") {
                                oHeaderModel.setProperty("/CopyMaterial", oData.Product);
                                oHeaderModel.setProperty("/CopyPlant", oData.Plant);
                            } else {
                                oHeaderModel.setProperty("/Material", oData.Product);

                                /*
                                 * Product value help service has Plant also.
                                 * If you do not want product VH to fill Plant,
                                 * remove the below line.
                                 */
                                oHeaderModel.setProperty("/Plant", oData.Plant);
                            }

                            that._sMaterialTargetProperty = "/Material";

                            that.onHeaderFieldChange();

                            that._oMatTable.removeSelections(true);
                            that._oMatVHD.close();
                        },

                        cancel: function () {
                            that._oMatTable.removeSelections(true);
                            that._sMaterialTargetProperty = "/Material";
                            that._oMatVHD.close();
                        }
                    });

                    this._oMatTable.setModel(this.getOwnerComponent().getModel());
                    this._oMatVHD.setTable(this._oMatTable);
                }

                this._oMatTable.removeSelections(true);
                this._oMatVHD.open();
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

                if (!this._oPlantVHD) {
                    var oFilterBar;

                    var fnDoSearch = function () {
                        var aFilters = [];
                        var aItems = oFilterBar.getFilterGroupItems();

                        aItems.forEach(function (oItem) {
                            var sValue = oItem.getControl().getValue();

                            if (sValue) {
                                aFilters.push(
                                    new Filter(
                                        oItem.getName(),
                                        FilterOperator.Contains,
                                        sValue
                                    )
                                );
                            }
                        });

                        var oBinding = that._oPlantTable.getBinding("items");

                        if (oBinding) {
                            oBinding.filter(aFilters);
                        }
                    };

                    oFilterBar = new FilterBar({
                        showFilterConfiguration: false,
                        showGoOnFB: true,
                        filterBarExpanded: true,
                        useToolbar: true,
                        search: fnDoSearch,
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
                        mode: "SingleSelectLeft",
                        includeItemInSelection: true,
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
                        path: "/plant_vh",
                        template: new sap.m.ColumnListItem({
                            type: "Active",
                            cells: [
                                new sap.m.Text({ text: "{Plant}" }),
                                new sap.m.Text({ text: "{PlantName}" })
                            ]
                        })
                    });

                    this._oPlantTable.attachItemPress(function (oEvent) {
                        var oItem = oEvent.getParameter("listItem");

                        if (oItem) {
                            that._oPlantTable.setSelectedItem(oItem, true);
                        }
                    });

                    this._oPlantVHD = new ValueHelpDialog({
                        title: "Select Plant",
                        supportMultiselect: false,
                        supportRanges: false,
                        filterBar: oFilterBar,
                        stretch: false,
                        contentWidth: "60%",
                        contentHeight: "60%",

                        ok: function () {
                            var oSelectedItem = that._oPlantTable.getSelectedItem();

                            if (!oSelectedItem) {
                                MessageBox.error("Please select one plant.");
                                return;
                            }

                            var oData = oSelectedItem.getBindingContext().getObject();
                            var sTargetProperty =
                                that._sPlantTargetProperty || "/Plant";

                            that
                                .getOwnerComponent()
                                .getModel("headerModel")
                                .setProperty(sTargetProperty, oData.Plant);

                            that._sPlantTargetProperty = "/Plant";

                            that.onHeaderFieldChange();

                            that._oPlantTable.removeSelections(true);
                            that._oPlantVHD.close();
                        },

                        cancel: function () {
                            that._oPlantTable.removeSelections(true);
                            that._sPlantTargetProperty = "/Plant";
                            that._oPlantVHD.close();
                        }
                    });

                    this._oPlantTable.setModel(this.getOwnerComponent().getModel());
                    this._oPlantVHD.setTable(this._oPlantTable);
                }

                this._oPlantTable.removeSelections(true);
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
                            Accept: "application/json"
                        },
                        success: function (data, textStatus, jqXHR) {
                            var sToken = jqXHR.getResponseHeader("X-CSRF-Token");

                            if (!sToken) {
                                reject({
                                    responseText:
                                        "CSRF token could not be fetched from service root."
                                });
                                return;
                            }

                            jQuery.ajax({
                                url: sUrl,
                                method: "POST",
                                contentType: "application/json",
                                headers: {
                                    Accept: "application/json",
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

                            if (
                                oParsed.error.message &&
                                oParsed.error.message.value
                            ) {
                                return oParsed.error.message.value;
                            }
                        }

                        return oError.responseText;
                    }

                    return oError.message || "Unexpected error occurred.";
                } catch (e) {
                    return (
                        oError.responseText ||
                        oError.message ||
                        "Unexpected error occurred."
                    );
                }
            }
        });
    }
);