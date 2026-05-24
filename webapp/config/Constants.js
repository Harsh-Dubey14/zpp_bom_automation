sap.ui.define([], function () {
  "use strict";

  return {
    BOM_USAGE: "1",
    BOM_STATUS: "2",
    ITEM_CATEGORY: "L",

    ROUTES: {
      HEADER: "RouteView1",
      ITEM: "RouteBOMItem"
    },

    DEFAULTS: {
      BASE_QTY: 1,
      MESSAGE_TYPE: "Information"
    },

    ACTIONS: {
      VALIDATE_MATERIAL_PLANT:
        "/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.ValidateMaterialPlant",

      GET_NEXT_ALT_BOM:
        "/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.GetNextAltBOM",

      GET_ALTERNATE_BOM_ITEMS:
        "/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.GetAlternateBOMItems",

      CREATE_BOM: "/BomCreate"
    },

    VALUE_HELP: {
      MATERIAL_PATH: "/product_plant_vh",
      MATERIAL_SELECT: ["Product", "ProductDescription"],

      PLANT_PATH: "/plant_vh",
      PLANT_SELECT: ["Plant", "PlantName"],

      COMPONENT_PATH: "/plant_component_vh",
      COMPONENT_SELECT: ["component", "ProductDescription", "uom"],

      SORT_STRING_PATH: "/sort_string",
      SORT_STRING_SELECT: ["Product", "Style", "Zcomb", "ColorName", "sizes"]
    }
  };
});