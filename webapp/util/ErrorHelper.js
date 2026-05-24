sap.ui.define([], function () {
  "use strict";

  return {
    getErrorText: function (oError) {
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
        return (
          oError.responseText ||
          oError.message ||
          "Unexpected error occurred."
        );
      }
    }
  };
});