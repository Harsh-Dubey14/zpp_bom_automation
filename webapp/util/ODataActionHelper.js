/* global jQuery, Promise */

sap.ui.define([], function () {
  "use strict";

  return {
    postAction: function (oModel, sRelativePath, oPayload) {
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
                message: "CSRF token could not be fetched from service root.",
                responseText: "CSRF token could not be fetched from service root."
              });
              return;
            }

            jQuery.ajax({
              url: sUrl,
              method: "POST",
              contentType: "application/json",
              dataType: "json",
              headers: {
                Accept: "application/json",
                "X-CSRF-Token": sToken
              },
              data: JSON.stringify(oPayload || {}),
              success: function (oData) {
                resolve(oData || {});
              },
              error: function (oXHR) {
                reject({
                  status: oXHR.status,
                  statusText: oXHR.statusText,
                  responseText: oXHR.responseText,
                  responseJSON: oXHR.responseJSON,
                  message: ODataActionHelperExtractError(oXHR)
                });
              }
            });
          },
          error: function (oXHR) {
            reject({
              status: oXHR.status,
              statusText: oXHR.statusText,
              responseText: oXHR.responseText,
              responseJSON: oXHR.responseJSON,
              message: ODataActionHelperExtractError(oXHR)
            });
          }
        });
      });
    }
  };

  function ODataActionHelperExtractError(oXHR) {
    var sMessage = "";

    try {
      if (
        oXHR &&
        oXHR.responseJSON &&
        oXHR.responseJSON.error &&
        oXHR.responseJSON.error.message
      ) {
        if (typeof oXHR.responseJSON.error.message === "string") {
          return oXHR.responseJSON.error.message;
        }

        if (oXHR.responseJSON.error.message.value) {
          return oXHR.responseJSON.error.message.value;
        }
      }

      if (oXHR && oXHR.responseText) {
        var oParsed = JSON.parse(oXHR.responseText);

        if (oParsed && oParsed.error && oParsed.error.message) {
          if (typeof oParsed.error.message === "string") {
            return oParsed.error.message;
          }

          if (oParsed.error.message.value) {
            return oParsed.error.message.value;
          }
        }

        return oXHR.responseText;
      }
    } catch (e) {
      sMessage = oXHR && oXHR.responseText ? oXHR.responseText : "";
    }

    return sMessage || "OData action failed.";
  }
});