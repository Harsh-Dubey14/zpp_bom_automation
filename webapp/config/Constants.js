sap.ui.define([], function () {
  "use strict";

  return {
    BOM_USAGE: "1",
    BOM_STATUS: "2",
    ITEM_CATEGORY: "L",

    APP_MODE: {
      CREATE: "CREATE",
      CHANGE: "CHANGE"
    },

    SEARCH_MODE: {
      MATERIAL: "MATERIAL",
      BOM: "BOM"
    },

    ROW_STATUS: {
      EXISTING: "EXISTING",
      CHANGED: "CHANGED",
      NEW: "NEW",
      DELETED: "DELETED"
    },

    CHANGE_MODE: {
      UPDATE: "U",
      INSERT: "I",
      DELETE: "D"
    },

    ROUTES: {
      HEADER: "RouteView1",
      ITEM: "RouteBOMItem",
      CHANGE: "RouteBOMChange",
      CHANGE_ITEM: "RouteBOMChangeItem"
    },

    DEFAULTS: {
      BASE_QTY: 1,
      MESSAGE_TYPE: "Information",
      BILL_OF_MATERIAL_CATEGORY: "M",
      BILL_OF_MATERIAL_VERSION: "",
      HEADER_CHANGE_DOCUMENT: ""
    },

    ACTIONS: {
      VALIDATE_MATERIAL_PLANT:
        "/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.ValidateMaterialPlant",

      GET_NEXT_ALT_BOM:
        "/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.GetNextAltBOM",

      GET_ALTERNATE_BOM_ITEMS:
        "/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.GetAlternateBOMItems",

      CHANGE_BOM_ITEM:
        "/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.ChangeBOMItem",

      CHANGE_BOM_ITEMS:
        "/BomApi/com.sap.gateway.srvd_a2x.zui_bom_automation.v0001.ChangeBOMItems",

      CREATE_BOM: "/BomCreate"
    },

    ENTITY_SETS: {
      BOM_CHANGE_READ: "/BomChangeRead"
    },

    VALUE_HELP: {
      MATERIAL_PATH: "/product_plant_vh",
      MATERIAL_SELECT: ["Product", "ProductDescription"],

      PLANT_PATH: "/plant_vh",
      PLANT_SELECT: ["Plant", "PlantName"],

      COMPONENT_PATH: "/plant_component_vh",
      COMPONENT_SELECT: ["component", "ProductDescription", "uom"],

      SORT_STRING_PATH: "/sort_string",
      SORT_STRING_SELECT: ["Product", "Style", "Zcomb", "ColorName", "sizes"],

      PRODUCT_UOM_PATH: "/produtuom",
      PRODUCT_UOM_SELECT: ["Product", "AlternativeUnit", "BaseUnit"]
    }
  };
});
