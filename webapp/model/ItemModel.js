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
          items: [],
          pendingDeletes: []
        };
      },

      createBlankItem: function (iItemNo) {
        return {
          item: FormatterHelper.formatItemNumber(iItemNo || 1),
          component: "",
          description: "",
          remarks: "",
          quantity: "",
          uom: "",
          sortString: "",
          category: Constants.ITEM_CATEGORY,

          rowStatus: Constants.ROW_STATUS ? Constants.ROW_STATUS.NEW : "NEW",
          changeMode: Constants.CHANGE_MODE ? Constants.CHANGE_MODE.INSERT : "I",
          isNew: true,
          isChanged: false,
          isDeleted: false
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
          oItemModel.refresh(true);
        }
      },

      clearItems: function (oItemModel) {
        if (oItemModel) {
          oItemModel.setProperty("/items", []);
          oItemModel.setProperty("/pendingDeletes", []);
          oItemModel.refresh(true);
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
        var iNextItem = this.getNextItemNumber(aItems);

        aItems.push(this.createBlankItem(iNextItem));

        oItemModel.setProperty("/items", aItems);
        oItemModel.refresh(true);
      },

      getNextItemNumber: function (aItems) {
        var iMax = 0;

        (aItems || []).forEach(function (oItem) {
          if (!oItem) {
            return;
          }

          if (oItem.rowStatus === "DELETED" || oItem.isDeleted) {
            return;
          }

          var iItem = parseInt(oItem.item, 10);

          if (!isNaN(iItem) && iItem > iMax) {
            iMax = iItem;
          }
        });

        return iMax + 1;
      },

      deleteIndexes: function (oItemModel, aIndexesToDelete) {
        var aItems = oItemModel.getProperty("/items") || [];

        aIndexesToDelete.sort(function (a, b) {
          return b - a;
        });

        aIndexesToDelete.forEach(function (iIndex) {
          aItems.splice(iIndex, 1);
        });

        oItemModel.setProperty("/items", aItems);
        oItemModel.refresh(true);

        return aItems;
      },

      renumber: function (aItems) {
        for (var i = 0; i < aItems.length; i++) {
          aItems[i].item = FormatterHelper.formatItemNumber(i + 1);
        }
      },
      formatNextItemNumber: function (aItems) {
        var iMax = 0;

        (aItems || []).forEach(function (oItem) {
          if (!oItem) {
            return;
          }

          if (oItem.rowStatus === "DELETED" || oItem.isDeleted) {
            return;
          }

          var iItem = parseInt(oItem.item, 10);

          if (!isNaN(iItem) && iItem > iMax) {
            iMax = iItem;
          }
        });

        return FormatterHelper.formatItemNumber(iMax + 1);
      },
      applySortStringSelections: function (oItemModel, sPath, aSelectedZcomb) {
        var iRowIndex = Number(sPath.split("/").pop());
        var aItems = oItemModel.getProperty("/items") || [];

        if (isNaN(iRowIndex) || !aItems[iRowIndex]) {
          return false;
        }

        aSelectedZcomb = (aSelectedZcomb || [])
          .map(function (vSelected) {
            if (typeof vSelected === "string") {
              return String(vSelected || "").trim().toUpperCase();
            }

            if (!vSelected) {
              return "";
            }

            return String(
              vSelected.Zcomb ||
              vSelected.zcomb ||
              vSelected.sortString ||
              vSelected.SortString ||
              vSelected.BOMItemSorter ||
              vSelected.BomItemSorter ||
              vSelected.bomItemSorter ||
              ""
            )
              .trim()
              .toUpperCase();
          })
          .filter(function (sSortString, iIndex, aArray) {
            return sSortString && aArray.indexOf(sSortString) === iIndex;
          });

        if (!aSelectedZcomb.length) {
          return false;
        }

        var oBaseRow = Object.assign({}, aItems[iRowIndex]);

        /*
         * First selected sort string updates same row.
         */
        aItems[iRowIndex].sortString = aSelectedZcomb[0];

        /*
         * Remaining selected sort strings duplicate the row.
         */
        for (var i = 1; i < aSelectedZcomb.length; i++) {
  var oNewRow = JSON.parse(JSON.stringify(oBaseRow));

  oNewRow.item = this.formatNextItemNumber(aItems);
  oNewRow.sortString = aSelectedZcomb[i];

          /*
           * For Create BOM, duplicated rows are just new frontend rows.
           */
          oNewRow.rowStatus = Constants.ROW_STATUS ? Constants.ROW_STATUS.NEW : "NEW";
          oNewRow.changeMode = Constants.CHANGE_MODE
            ? Constants.CHANGE_MODE.INSERT
            : "I";
          oNewRow.isNew = true;
          oNewRow.isChanged = false;
          oNewRow.isDeleted = false;

          aItems.push(oNewRow);
        }

        oItemModel.setProperty("/items", aItems);
        oItemModel.refresh(true);

        return true;
      },
    };
  }
);
