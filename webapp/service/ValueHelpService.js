/* global Promise */

sap.ui.define(
  [
    "sap/ui/model/json/JSONModel",
    "zppbomautomation/config/Constants",
    "zppbomautomation/util/FormatterHelper"
  ],
  function (JSONModel, Constants, FormatterHelper) {
    "use strict";

    var ValueHelpService = {
      loadVHData: function (
        oController,
        sPath,
        aSelectFields,
        sModelCacheName,
        bUniqueProduct
      ) {
        if (oController[sModelCacheName]) {
          return Promise.resolve(oController[sModelCacheName]);
        }

        return new Promise(function (resolve, reject) {
          var oODataModel = oController.getOwnerComponent().getModel();

          var oListBinding = oODataModel.bindList(
            sPath,
            null,
            null,
            null,
            {
              $select: aSelectFields.join(",")
            }
          );

          oListBinding
            .requestContexts(0, 5000)
            .then(function (aContexts) {
              var aResults = aContexts.map(function (oContext) {
                return oContext.getObject();
              });

              if (bUniqueProduct) {
                aResults = ValueHelpService._getUniqueProducts(aResults);
              }

              oController[sModelCacheName] = new JSONModel({
                items: aResults
              });

              resolve(oController[sModelCacheName]);
            })
            .catch(function (oError) {
              reject(oError);
            });
        });
      },

      loadMaterialVHData: function (oController) {
        return ValueHelpService.loadVHData(
          oController,
          Constants.VALUE_HELP.MATERIAL_PATH,
          Constants.VALUE_HELP.MATERIAL_SELECT,
          "_oMaterialVHModel",
          true
        );
      },

      loadPlantVHData: function (oController) {
        return ValueHelpService.loadVHData(
          oController,
          Constants.VALUE_HELP.PLANT_PATH,
          Constants.VALUE_HELP.PLANT_SELECT,
          "_oPlantVHModel",
          false
        );
      },

      findMaterial: function (sMaterial, oMaterialVHModel) {
        var sSearch = FormatterHelper.normalizeMaterialInput(
          sMaterial
        ).toUpperCase();

        var aItems = [];

        if (!sSearch || !oMaterialVHModel) {
          return null;
        }

        aItems = oMaterialVHModel.getProperty("/items") || [];

        return (
          aItems.find(function (oItem) {
            return String(oItem.Product || "").toUpperCase() === sSearch;
          }) || null
        );
      },

      _getUniqueProducts: function (aResults) {
        var oSeen = {};
        var aUniqueResults = [];

        aResults.forEach(function (oItem) {
          var sProduct = String(oItem.Product || "");

          if (sProduct && !oSeen[sProduct]) {
            oSeen[sProduct] = true;
            aUniqueResults.push(oItem);
          }
        });

        return aUniqueResults;
      }
    };

    return ValueHelpService;
  }
);