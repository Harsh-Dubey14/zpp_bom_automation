sap.ui.define(
  [
    "zppbomautomation/util/ODataActionHelper",
    "zppbomautomation/config/Constants"
  ],
  function (ODataActionHelper, Constants) {
    "use strict";

    return {
      validateMaterialPlant: function (oModel, oPayload) {
        return ODataActionHelper.postAction(
          oModel,
          Constants.ACTIONS.VALIDATE_MATERIAL_PLANT,
          oPayload
        );
      },

      getNextAltBOM: function (oModel, oPayload) {
        return ODataActionHelper.postAction(
          oModel,
          Constants.ACTIONS.GET_NEXT_ALT_BOM,
          oPayload
        );
      },

      getAlternateBOMItems: function (oModel, oPayload) {
        return ODataActionHelper.postAction(
          oModel,
          Constants.ACTIONS.GET_ALTERNATE_BOM_ITEMS,
          oPayload
        );
      },

      createBom: function (oModel, oPayload) {
        return ODataActionHelper.postAction(
          oModel,
          Constants.ACTIONS.CREATE_BOM,
          oPayload
        );
      },

     changeBomItem: function (oModel, oPayload) {
  return ODataActionHelper.postAction(
    oModel,
    Constants.ACTIONS.CHANGE_BOM_ITEM,
    oPayload
  );
},

changeBomItems: function (oModel, oPayload) {
  return ODataActionHelper.postAction(
    oModel,
    Constants.ACTIONS.CHANGE_BOM_ITEMS,
    oPayload
  );
}
    };
  }
);