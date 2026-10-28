sap.ui.define([
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Filter, FilterOperator) {
  "use strict";

  return {
    search: function (oModel, sPath, aSelect, sKey, sQuery, aBaseFilters, iStart, iLength, aSearchFields) {
      var aTerms = String(sQuery || "").trim().split(/\s+/).filter(Boolean);
      var aFields = aTerms.length ? (aSearchFields || [sKey, "ProductDescription", "PrintName"]) : [null];
      var aRequests = aFields.map(function (sField) {
        return Promise.resolve().then(function () {
          var aFilters = aBaseFilters.slice();
          aTerms.forEach(function (sTerm) {
            aFilters.push(new Filter(sField, FilterOperator.Contains, sTerm));
          });
          var oBinding = oModel.bindList(sPath, null, null, aFilters, {
            $select: aSelect.join(",")
          });
          return oBinding.requestContexts(iStart, iLength).then(function (aContexts) {
            return aContexts.map(function (oContext) { return oContext.getObject(); });
          }).finally(function () { oBinding.destroy(); });
        }).then(function (aItems) {
          return { items: aItems };
        }, function (oError) {
          return { error: oError };
        });
      });
      return Promise.all(aRequests).then(function (aResults) {
        if (aResults.every(function (oResult) { return oResult.error; })) {
          throw aResults[0].error;
        }
        var oSeen = Object.create(null);
        var aItems = [];
        aResults.forEach(function (oResult) {
          (oResult.items || []).forEach(function (oItem) {
            var sValue = String(oItem[sKey] || "");
            if (sValue && !oSeen[sValue]) {
              oSeen[sValue] = true;
              aItems.push(oItem);
            }
          });
        });
        return aItems.slice(0, iLength);
      });
    }
  };
});
