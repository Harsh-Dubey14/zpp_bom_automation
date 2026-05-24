sap.ui.define(
  [
    "sap/ui/model/json/JSONModel",
    "zppbomautomation/config/Constants",
    "zppbomautomation/util/FormatterHelper"
  ],
  function (JSONModel, Constants, FormatterHelper) {
    "use strict";

    return {
      createDefaultData: function () {
        return {
          items: []
        };
      },

      createBlankItem: function (iItemNo) {
        return {
          item: FormatterHelper.formatItemNumber(iItemNo || 1),
          component: "",
          description: "",
          quantity: "",
          uom: "",
          sortString: "",
          category: Constants.ITEM_CATEGORY
        };
      },

      init: function (oComponent, oView) {
        var oExistingModel = oComponent.getModel("itemModel");

        if (oExistingModel) {
          oView.setModel(oExistingModel, "itemModel");
          return oExistingModel;
        }

        var oModel = new JSONModel(this.createDefaultData());

        oComponent.setModel(oModel, "itemModel");
        oView.setModel(oModel, "itemModel");

        return oModel;
      },

      reset: function (oItemModel) {
        if (oItemModel) {
          oItemModel.setData(this.createDefaultData());
        }
      },

      clearItems: function (oItemModel) {
        if (oItemModel) {
          oItemModel.setProperty("/items", []);
        }
      },

      setItems: function (oItemModel, aItems) {
        if (oItemModel) {
          oItemModel.setProperty("/items", aItems || []);
          oItemModel.refresh(true);
        }
      },

      addRow: function (oItemModel) {
        var aItems = oItemModel.getProperty("/items") || [];
        var iNextItem = 1;

        if (aItems.length > 0) {
          var iLastItem = parseInt(aItems[aItems.length - 1].item, 10);

          if (!isNaN(iLastItem)) {
            iNextItem = iLastItem + 1;
          }
        }

        aItems.push(this.createBlankItem(iNextItem));

        oItemModel.setProperty("/items", aItems);
      },

      deleteIndexes: function (oItemModel, aIndexesToDelete) {
        var aItems = oItemModel.getProperty("/items") || [];

        aIndexesToDelete.sort(function (a, b) {
          return b - a;
        });

        aIndexesToDelete.forEach(function (iIndex) {
          aItems.splice(iIndex, 1);
        });

        this.renumber(aItems);

        oItemModel.setProperty("/items", aItems);

        return aItems;
      },

      renumber: function (aItems) {
        for (var i = 0; i < aItems.length; i++) {
          aItems[i].item = FormatterHelper.formatItemNumber(i + 1);
        }
      },

      applySortStringSelections: function (oItemModel, sPath, aSelectedZcomb) {
        var iRowIndex = Number(sPath.split("/").pop());
        var aItems = oItemModel.getProperty("/items") || [];

        if (isNaN(iRowIndex) || !aItems[iRowIndex]) {
          return false;
        }

        var oBaseRow = Object.assign({}, aItems[iRowIndex]);

        aItems[iRowIndex].sortString = aSelectedZcomb[0];

        for (var i = 1; i < aSelectedZcomb.length; i++) {
          var oNewRow = Object.assign({}, oBaseRow, {
            sortString: aSelectedZcomb[i]
          });

          aItems.splice(iRowIndex + i, 0, oNewRow);
        }

        this.renumber(aItems);

        oItemModel.setProperty("/items", aItems);
        oItemModel.refresh(true);

        return true;
      }
    };
  }
);