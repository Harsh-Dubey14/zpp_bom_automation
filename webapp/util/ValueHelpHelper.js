/* global  */

sap.ui.define(
  [
    "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
    "sap/ui/comp/filterbar/FilterBar",
    "sap/ui/comp/filterbar/FilterGroupItem",
    "sap/m/Input",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "zppbomautomation/service/ValueHelpService",
    "zppbomautomation/config/Constants"
  ],
  function (
    ValueHelpDialog,
    FilterBar,
    FilterGroupItem,
    Input,
    MessageBox,
    Filter,
    FilterOperator,
    ValueHelpService,
    Constants
  ) {
    "use strict";

    return {
      openValueHelp: function (oController, oConfig) {
        var that = this;
        var pLoadData = oConfig.odataPath
          ? Promise.resolve(null)
          : oConfig.loadData(oController);

        pLoadData
          .then(function (oLocalModel) {
            if (!oController[oConfig.dialogName]) {
              that._createValueHelpDialog(oController, oConfig, oLocalModel);
            } else if (!oConfig.odataPath) {
              oController[oConfig.tableName].setModel(
                oLocalModel,
                oConfig.modelName
              );
            }

            that.clearValueHelpSearch(oController, oConfig);
            oController[oConfig.dialogName].open();
          })
          .catch(function (oError) {
            MessageBox.error(
              oError.message || oError.responseText || "Value help failed."
            );
          });
      },

      _createValueHelpDialog: function (oController, oConfig, oLocalModel) {
        var that = this;
        var aFilterInputs = [];

        var fnDoSearch = function () {
          var aFilters = [];
          var mSearchValues = {};

          oConfig.filterFields.forEach(function (oField, iIndex) {
            var sValue = aFilterInputs[iIndex].getValue();

            mSearchValues[oField.name] = sValue;

            if (sValue) {
              aFilters.push(
                new Filter(oField.name, FilterOperator.Contains, sValue)
              );
            }
          });

          if (oConfig.odataPath) {
            var oRemoteBinding = oController[oConfig.tableName].getBinding("items");

            if (oRemoteBinding) {
              oRemoteBinding.filter(aFilters);
            }
            return;
          }

          if (oConfig.searchData) {
            oController[oConfig.dialogName].setBusy(true);
            oConfig.searchData(oController, mSearchValues, 0, 50)
              .then(function (oSearchModel) {
                oController[oConfig.tableName].setModel(
                  oSearchModel,
                  oConfig.modelName
                );
              })
              .catch(function (oError) {
                MessageBox.error(
                  oError.message || oError.responseText || "Search failed."
                );
              })
              .then(function () {
                oController[oConfig.dialogName].setBusy(false);
              });
            return;
          }

          var oBinding = oController[oConfig.tableName].getBinding("items");

          if (oBinding) {
            oBinding.filter(aFilters);
          }
        };

        var aFilterGroupItems = oConfig.filterFields.map(function (oField) {
          var oInput = new Input({
            submit: fnDoSearch
          });

          aFilterInputs.push(oInput);

          return new FilterGroupItem({
            groupName: "basic",
            name: oField.name,
            label: oField.label,
            visibleInFilterBar: true,
            control: oInput
          });
        });

        oController[oConfig.inputCacheName] = aFilterInputs;

        var oFilterBar = new FilterBar({
          showFilterConfiguration: false,
          showGoOnFB: true,
          filterBarExpanded: true,
          useToolbar: true,
          search: fnDoSearch,
          filterGroupItems: aFilterGroupItems
        });

        oController[oConfig.tableName] = new sap.m.Table({
          growing: true,
          growingThreshold: 100,
          mode: "SingleSelectLeft",
          includeItemInSelection: true,
          columns: oConfig.columns.map(function (oColumn) {
            return new sap.m.Column({
              header: new sap.m.Label({
                text: oColumn.label
              })
            });
          })
        });

        oController[oConfig.tableName].setModel(
          oConfig.odataPath
            ? oController.getOwnerComponent().getModel()
            : oLocalModel,
          oConfig.odataPath ? undefined : oConfig.modelName
        );

        oController[oConfig.tableName].bindItems({
          path: oConfig.odataPath || oConfig.modelName + ">/items",
          parameters: oConfig.odataPath
            ? { $select: oConfig.selectFields.join(",") }
            : undefined,
          template: new sap.m.ColumnListItem({
            type: "Active",
            cells: oConfig.columns.map(function (oColumn) {
              return new sap.m.Text({
                text: "{" + (oConfig.odataPath ? "" : oConfig.modelName + ">") +
                  oColumn.name + "}"
              });
            })
          })
        });

        oController[oConfig.tableName].attachItemPress(function (oEvent) {
          var oItem = oEvent.getParameter("listItem");

          if (oItem) {
            oController[oConfig.tableName].setSelectedItem(oItem, true);
          }
        });

        oController[oConfig.dialogName] = new ValueHelpDialog({
          title: oConfig.title,
          supportMultiselect: false,
          supportRanges: false,
          filterBar: oFilterBar,
          stretch: false,
          contentWidth: oConfig.contentWidth || "70%",
          contentHeight: oConfig.contentHeight || "60%",

          ok: function () {
            var oSelectedItem = oController[oConfig.tableName].getSelectedItem();

            if (!oSelectedItem) {
              MessageBox.error("Please select one value.");
              return;
            }

            var oData = oSelectedItem
              .getBindingContext(oConfig.odataPath ? undefined : oConfig.modelName)
              .getObject();

            oConfig.onSelect(oData);

            that.clearValueHelpSearch(oController, oConfig);
            oController[oConfig.dialogName].close();
          },

          cancel: function () {
            if (oConfig.onCancel) {
              oConfig.onCancel();
            }

            that.clearValueHelpSearch(oController, oConfig);
            oController[oConfig.dialogName].close();
          }
        });

        oController[oConfig.dialogName].setTable(oController[oConfig.tableName]);
      },

      clearValueHelpSearch: function (oController, oConfig) {
        var aInputs = oController[oConfig.inputCacheName] || [];

        aInputs.forEach(function (oInput) {
          oInput.setValue("");
        });

        if (oController[oConfig.tableName]) {
          oController[oConfig.tableName].removeSelections(true);

          var oBinding = oController[oConfig.tableName].getBinding("items");

          if (oBinding) {
            oBinding.filter([]);
          }
        }
      },

      openMaterialValueHelp: function (oController, fnOnSelect, fnOnCancel) {
        this.openValueHelp(oController, {
          title: "Select Product",
          modelName: "materialVH",
          dialogName: "_oMatVHD",
          tableName: "_oMatTable",
          inputCacheName: "_aMatInputs",
          contentWidth: "70%",
          contentHeight: "60%",
          odataPath: Constants.VALUE_HELP.MATERIAL_PATH,
          selectFields: Constants.VALUE_HELP.MATERIAL_SELECT,

          filterFields: [
            {
              name: "Product",
              label: "Product"
            },
            {
              name: "ProductDescription",
              label: "Product Description"
            }
          ],

          columns: [
            {
              name: "Product",
              label: "Product"
            },
            {
              name: "ProductDescription",
              label: "Product Description"
            }
          ],

          onSelect: fnOnSelect,
          onCancel: fnOnCancel
        });
      },

      openPlantValueHelp: function (oController, fnOnSelect, fnOnCancel) {
        this.openValueHelp(oController, {
          title: "Select Plant",
          modelName: "plantVH",
          dialogName: "_oPlantVHD",
          tableName: "_oPlantTable",
          inputCacheName: "_aPlantInputs",
          contentWidth: "60%",
          contentHeight: "60%",
          loadData: function (oCtrl) {
            return ValueHelpService.loadPlantVHData(oCtrl);
          },

          filterFields: [
            {
              name: "Plant",
              label: "Plant"
            },
            {
              name: "PlantName",
              label: "Plant Name"
            }
          ],

          columns: [
            {
              name: "Plant",
              label: "Plant"
            },
            {
              name: "PlantName",
              label: "Plant Name"
            }
          ],

          onSelect: fnOnSelect,
          onCancel: fnOnCancel
        });
      }
    };
  }
);
