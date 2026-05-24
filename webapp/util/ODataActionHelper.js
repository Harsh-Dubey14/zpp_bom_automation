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
    }
  };
});