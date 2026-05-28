sap.ui.define([], function () {
  "use strict";

  return {
    getErrorText: function (oError) {
      var sMessage = "";

      try {
        if (!oError) {
          return "Unexpected error occurred.";
        }

        if (oError.responseJSON && oError.responseJSON.error) {
          sMessage = this._extractGatewayError(oError.responseJSON.error);

          if (sMessage) {
            return sMessage;
          }
        }

        if (oError.responseText) {
          try {
            var oParsed = JSON.parse(oError.responseText);

            if (oParsed && oParsed.error) {
              sMessage = this._extractGatewayError(oParsed.error);

              if (sMessage) {
                return sMessage;
              }
            }
          } catch (eJson) {
            if (typeof oError.responseText === "string") {
              return oError.responseText;
            }
          }
        }

        if (oError.message) {
          return oError.message;
        }

        if (oError.statusText) {
          return oError.statusText;
        }

        return "Unexpected error occurred. Please check SAP Gateway Error Log or ADT Feed Reader.";
      } catch (e) {
        return (
          oError.responseText ||
          oError.message ||
          "Unexpected error occurred. Please check SAP Gateway Error Log or ADT Feed Reader."
        );
      }
    },

    _extractGatewayError: function (oError) {
      var aMessages = [];
      var vMessage = oError.message;

      if (typeof vMessage === "string" && vMessage) {
        aMessages.push(vMessage);
      } else if (vMessage && vMessage.value) {
        aMessages.push(vMessage.value);
      }

      if (
        oError.innererror &&
        oError.innererror.errordetails &&
        oError.innererror.errordetails.length
      ) {
        oError.innererror.errordetails.forEach(function (oDetail) {
          if (oDetail && oDetail.message) {
            aMessages.push(oDetail.message);
          }
        });
      }

      if (
        oError.details &&
        Array.isArray(oError.details) &&
        oError.details.length
      ) {
        oError.details.forEach(function (oDetail) {
          if (oDetail && oDetail.message) {
            aMessages.push(oDetail.message);
          }
        });
      }

      aMessages = aMessages.filter(function (sText, iIndex, aAll) {
        return sText && aAll.indexOf(sText) === iIndex;
      });

      return aMessages.join("\n");
    }
  };
});