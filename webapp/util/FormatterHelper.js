sap.ui.define([], function () {
  "use strict";

  return {
    formatItemNumber: function (iNumber) {
      return String(iNumber).padStart(2, "0");
    },

    formatQuantityForDisplay: function (vQuantity) {
      var fQuantity = Number(vQuantity || 0);

      if (!isFinite(fQuantity)) {
        return "0.000";
      }

      return fQuantity.toFixed(3);
    },

    formatComponentForDisplay: function (sComponent) {
      sComponent = String(sComponent || "");

      if (/^\d+$/.test(sComponent)) {
        return sComponent.replace(/^0+/, "") || "0";
      }

      return sComponent;
    },

    normalizeMaterialInput: function (sValue) {
      return String(sValue || "").trim();
    }
  };
});