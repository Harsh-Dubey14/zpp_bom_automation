sap.ui.define(
  [
    "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
    "sap/ui/comp/filterbar/FilterBar",
    "sap/ui/comp/filterbar/FilterGroupItem",
    "sap/m/Input",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/Label",
    "sap/m/ColumnListItem",
    "sap/m/Text"
  ],
  function (
    ValueHelpDialog,
    FilterBar,
    FilterGroupItem,
    Input,
    MessageBox,
    Filter,
    FilterOperator,
    Table,
    Column,
    Label,
    ColumnListItem,
    Text
  ) {
    "use strict";

    return {
      openComponentValueHelp: function (oController, oLocalModel, fnOnSelect) {
        if (!oController._oComponentVHD) {
          this._createComponentDialog(oController, fnOnSelect);
        }

        oController._oComponentTable.setModel(oLocalModel, "componentVH");
        this.clearComponentSearch(oController);
        oController._oComponentVHD.open();
      },

      _createComponentDialog: function (oController, fnOnSelect) {
        var that = this;
        var oComponentInput;
        var oDescriptionInput;

        var fnDoSearch = function () {
          var aFilters = [];
          var sComponent = String(oComponentInput.getValue() || "").toUpperCase();
          var sDescription = oDescriptionInput.getValue();

          if (sComponent) {
            aFilters.push(
              new Filter("component", FilterOperator.Contains, sComponent)
            );
          }

          if (sDescription) {
            aFilters.push(
              new Filter(
                "ProductDescription",
                FilterOperator.Contains,
                sDescription
              )
            );
          }

          var oBinding = oController._oComponentTable.getBinding("items");

          if (oBinding) {
            oBinding.filter(aFilters);
          }
        };

        oComponentInput = new Input({
          liveChange: function (oEvent) {
            var sValue = oEvent.getSource().getValue();
            oEvent.getSource().setValue(sValue.toUpperCase());
          },
          submit: fnDoSearch
        });

        oDescriptionInput = new Input({
          submit: fnDoSearch
        });

        oController._oComponentInput = oComponentInput;
        oController._oComponentDescriptionInput = oDescriptionInput;

        var oFilterBar = new FilterBar({
          showFilterConfiguration: false,
          showGoOnFB: true,
          filterBarExpanded: true,
          useToolbar: true,
          search: fnDoSearch,
          filterGroupItems: [
            new FilterGroupItem({
              groupName: "basic",
              name: "component",
              label: "Component",
              visibleInFilterBar: true,
              control: oComponentInput
            }),
            new FilterGroupItem({
              groupName: "basic",
              name: "ProductDescription",
              label: "Description",
              visibleInFilterBar: true,
              control: oDescriptionInput
            })
          ]
        });

        oController._oComponentTable = new Table({
          growing: true,
          growingThreshold: 100,
          mode: "SingleSelectLeft",
          includeItemInSelection: true,
          columns: [
            new Column({
              header: new Label({ text: "Component" })
            }),
            new Column({
              header: new Label({ text: "Description" })
            }),
            new Column({
              header: new Label({ text: "UOM" })
            })
          ]
        });

        oController._oComponentTable.bindItems({
          path: "componentVH>/items",
          template: new ColumnListItem({
            type: "Active",
            cells: [
              new Text({ text: "{componentVH>component}" }),
              new Text({ text: "{componentVH>ProductDescription}" }),
              new Text({ text: "{componentVH>uom}" })
            ]
          })
        });

        oController._oComponentTable.attachItemPress(function (oEvent) {
          var oItem = oEvent.getParameter("listItem");

          if (oItem) {
            oController._oComponentTable.setSelectedItem(oItem, true);
          }
        });

        oController._oComponentVHD = new ValueHelpDialog({
          title: "Select Component",
          supportMultiselect: false,
          supportRanges: false,
          filterBar: oFilterBar,
          stretch: false,
          contentWidth: "70%",
          contentHeight: "60%",

          ok: function () {
            var oSelectedItem = oController._oComponentTable.getSelectedItem();

            if (!oSelectedItem) {
              MessageBox.error("Please select one component.");
              return;
            }

            var oData = oSelectedItem
              .getBindingContext("componentVH")
              .getObject();

            fnOnSelect(oData);

            that.clearComponentSearch(oController);
            oController._oComponentVHD.close();
          },

          cancel: function () {
            that.clearComponentSearch(oController);
            oController._oComponentVHD.close();
          }
        });

        oController._oComponentVHD.setTable(oController._oComponentTable);
      },

      clearComponentSearch: function (oController) {
        if (oController._oComponentInput) {
          oController._oComponentInput.setValue("");
        }

        if (oController._oComponentDescriptionInput) {
          oController._oComponentDescriptionInput.setValue("");
        }

        if (oController._oComponentTable) {
          oController._oComponentTable.removeSelections(true);

          var oBinding = oController._oComponentTable.getBinding("items");

          if (oBinding) {
            oBinding.filter([]);
          }
        }
      },

      openSortStringValueHelp: function (oController, oLocalModel, fnOnSelect) {
        if (!oController._oSortStringVHD) {
          this._createSortStringDialog(oController, fnOnSelect);
        }

        oController._oSortStringTable.setModel(oLocalModel, "sortStringVH");
        this.clearSortStringSearch(oController);
        oController._oSortStringVHD.open();
      },

      _createSortStringDialog: function (oController, fnOnSelect) {
        var that = this;

        var oProductInput;
        var oStyleInput;
        var oZcombInput;
        var oColorNameInput;
        var oSizesInput;

        var fnUpper = function (oEvent) {
          var sValue = oEvent.getSource().getValue();
          oEvent.getSource().setValue(sValue.toUpperCase());
        };

        var fnDoSearch = function () {
          var aFilters = [];

          var sProduct = String(oProductInput.getValue() || "")
            .trim()
            .toUpperCase();

          var sStyle = String(oStyleInput.getValue() || "")
            .trim()
            .toUpperCase();

          var sZcomb = String(oZcombInput.getValue() || "")
            .trim()
            .toUpperCase();

          var sColorName = String(oColorNameInput.getValue() || "")
            .trim()
            .toUpperCase();

          var sSizes = String(oSizesInput.getValue() || "")
            .trim()
            .toUpperCase();

          if (sProduct) {
            aFilters.push(
              new Filter("Product", FilterOperator.Contains, sProduct)
            );
          }

          if (sStyle) {
            aFilters.push(
              new Filter("Style", FilterOperator.Contains, sStyle)
            );
          }

          if (sZcomb) {
            aFilters.push(
              new Filter({
                filters: [
                  new Filter("Zcomb", FilterOperator.Contains, sZcomb),
                  new Filter("zcomb", FilterOperator.Contains, sZcomb),
                  new Filter("sortString", FilterOperator.Contains, sZcomb),
                  new Filter("SortString", FilterOperator.Contains, sZcomb),
                  new Filter("BOMItemSorter", FilterOperator.Contains, sZcomb),
                  new Filter("BomItemSorter", FilterOperator.Contains, sZcomb)
                ],
                and: false
              })
            );
          }

          if (sColorName) {
            aFilters.push(
              new Filter("ColorName", FilterOperator.Contains, sColorName)
            );
          }

          if (sSizes) {
            aFilters.push(
              new Filter("sizes", FilterOperator.EQ, sSizes)
            );
          }

          var oBinding = oController._oSortStringTable.getBinding("items");

          if (oBinding) {
            oBinding.filter(aFilters);
          }
        };

        oProductInput = new Input({
          liveChange: fnUpper,
          submit: fnDoSearch
        });

        oStyleInput = new Input({
          liveChange: fnUpper,
          submit: fnDoSearch
        });

        oZcombInput = new Input({
          liveChange: fnUpper,
          submit: fnDoSearch
        });

        oColorNameInput = new Input({
          liveChange: fnUpper,
          submit: fnDoSearch
        });

        oSizesInput = new Input({
          liveChange: fnUpper,
          submit: fnDoSearch
        });

        oController._oSortStringProductInput = oProductInput;
        oController._oSortStringStyleInput = oStyleInput;
        oController._oSortStringInput = oZcombInput;
        oController._oSortStringColorNameInput = oColorNameInput;
        oController._oSortStringSizesInput = oSizesInput;

        var oFilterBar = new FilterBar({
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
              control: oProductInput
            }),
            new FilterGroupItem({
              groupName: "basic",
              name: "Style",
              label: "Style",
              visibleInFilterBar: true,
              control: oStyleInput
            }),
            new FilterGroupItem({
              groupName: "basic",
              name: "Zcomb",
              label: "Sort String",
              visibleInFilterBar: true,
              control: oZcombInput
            }),
            new FilterGroupItem({
              groupName: "basic",
              name: "ColorName",
              label: "Color Name",
              visibleInFilterBar: true,
              control: oColorNameInput
            }),
            new FilterGroupItem({
              groupName: "basic",
              name: "sizes",
              label: "Sizes",
              visibleInFilterBar: true,
              control: oSizesInput
            })
          ]
        });

        oController._oSortStringTable = new Table({
          growing: true,
          growingThreshold: 100,
          mode: "MultiSelect",
          includeItemInSelection: true,
          columns: [
            new Column({ header: new Label({ text: "Product" }) }),
            new Column({ header: new Label({ text: "Style" }) }),
            new Column({ header: new Label({ text: "Sort String" }) }),
            new Column({ header: new Label({ text: "Color Name" }) }),
            new Column({ header: new Label({ text: "Sizes" }) })
          ]
        });

        oController._oSortStringTable.bindItems({
          path: "sortStringVH>/items",
          template: new ColumnListItem({
            type: "Active",
            cells: [
              new Text({ text: "{sortStringVH>Product}" }),
              new Text({ text: "{sortStringVH>Style}" }),
              new Text({
                text: {
                  parts: [
                    { path: "sortStringVH>Zcomb" },
                    { path: "sortStringVH>zcomb" },
                    { path: "sortStringVH>sortString" },
                    { path: "sortStringVH>SortString" },
                    { path: "sortStringVH>BOMItemSorter" },
                    { path: "sortStringVH>BomItemSorter" }
                  ],
                  formatter: function (
                    sZcomb,
                    szcomb,
                    sSortString,
                    sSortString2,
                    sBOMItemSorter,
                    sBomItemSorter
                  ) {
                    return (
                      sZcomb ||
                      szcomb ||
                      sSortString ||
                      sSortString2 ||
                      sBOMItemSorter ||
                      sBomItemSorter ||
                      ""
                    );
                  }
                }
              }),
              new Text({ text: "{sortStringVH>ColorName}" }),
              new Text({ text: "{sortStringVH>sizes}" })
            ]
          })
        });

        oController._oSortStringTable.attachItemPress(function (oEvent) {
          var oItem = oEvent.getParameter("listItem");

          if (oItem) {
            oController._oSortStringTable.setSelectedItem(oItem, true);
          }
        });

        oController._oSortStringVHD = new ValueHelpDialog({
          title: "Select Sort String",
          supportMultiselect: true,
          supportRanges: false,
          filterBar: oFilterBar,
          stretch: false,
          contentWidth: "75%",
          contentHeight: "60%",

          ok: function () {
            var aSelectedItems = oController._oSortStringTable.getSelectedItems();

            if (!aSelectedItems.length) {
              MessageBox.error("Please select at least one sort string.");
              return;
            }

            var aSelectedZcomb = aSelectedItems
              .map(function (oSelectedItem) {
                var oData = oSelectedItem
                  .getBindingContext("sortStringVH")
                  .getObject();

                return that._getSortStringValue(oData);
              })
              .filter(function (sSortString, iIndex, aArray) {
                return sSortString && aArray.indexOf(sSortString) === iIndex;
              });

            if (!aSelectedZcomb.length) {
              MessageBox.error("Selected sort string is blank.");
              return;
            }

            fnOnSelect(aSelectedZcomb);

            that.clearSortStringSearch(oController);
            oController._oSortStringVHD.close();
          },

          cancel: function () {
            that.clearSortStringSearch(oController);
            oController._oSortStringVHD.close();
          }
        });

        oController._oSortStringVHD.setTable(oController._oSortStringTable);
      },

      _getSortStringValue: function (oData) {
        if (!oData) {
          return "";
        }

        return String(
          oData.Zcomb ||
            oData.zcomb ||
            oData.sortString ||
            oData.SortString ||
            oData.BOMItemSorter ||
            oData.BomItemSorter ||
            oData.bomItemSorter ||
            ""
        )
          .trim()
          .toUpperCase();
      },

      clearSortStringSearch: function (oController) {
        if (oController._oSortStringProductInput) {
          oController._oSortStringProductInput.setValue("");
        }

        if (oController._oSortStringStyleInput) {
          oController._oSortStringStyleInput.setValue("");
        }

        if (oController._oSortStringInput) {
          oController._oSortStringInput.setValue("");
        }

        if (oController._oSortStringColorNameInput) {
          oController._oSortStringColorNameInput.setValue("");
        }

        if (oController._oSortStringSizesInput) {
          oController._oSortStringSizesInput.setValue("");
        }

        if (oController._oSortStringTable) {
          oController._oSortStringTable.removeSelections(true);

          var oBinding = oController._oSortStringTable.getBinding("items");

          if (oBinding) {
            oBinding.filter([]);
          }
        }
      },

      clearSortStringCache: function (oController) {
        oController._sSortStringVHMaterial = "";
        oController._oSortStringVHModel = null;

        if (oController._oSortStringTable) {
          oController._oSortStringTable.setModel(null, "sortStringVH");
        }
      }
    };
  }
);