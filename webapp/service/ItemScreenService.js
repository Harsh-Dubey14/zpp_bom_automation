/* global Promise */

sap.ui.define(
  [
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "zppbomautomation/config/Constants",
    "zppbomautomation/util/FormatterHelper"
  ],
  function (
    JSONModel,
    Filter,
    FilterOperator,
    Constants,
    FormatterHelper
  ) {
    "use strict";

    var ItemScreenService = {
      sanitizeQuantity: function (sValue) {
        sValue = String(sValue || "");
        sValue = sValue.replace(/[^0-9.]/g, "");

        var aParts = sValue.split(".");

        if (aParts.length > 2) {
          sValue = aParts[0] + "." + aParts.slice(1).join("");
          aParts = sValue.split(".");
        }

        if (aParts.length === 2) {
          aParts[1] = aParts[1].substring(0, 3);
          sValue = aParts[0] + "." + aParts[1];
        }

        return sValue;
      },

      isValidQuantityDecimal: function (vQuantity) {
        var sQuantity = String(vQuantity || "");

        return /^\d+(\.\d{1,3})?$/.test(sQuantity);
      },

      getComponentUom: function (oData) {
        return String(
          oData.uom ||
          oData.Uom ||
          oData.UOM ||
          oData.BaseUnit ||
          oData.BaseUom ||
          oData.BillOfMaterialItemUnit ||
          oData.BillOfMaterialItemUnit_Text ||
          ""
        ).substring(0, 3);
      },

      getComponentDescription: function (oData) {
        return String(
          oData.ProductDescription ||
          oData.productDescription ||
          oData.Description ||
          oData.description ||
          oData.MaterialDescription ||
          ""
        ).substring(0, 40);
      },

      checkComponentPlantExtension: function (oODataModel, sComponent, sPlant) {
        return new Promise(function (resolve) {
          var oListBinding = oODataModel.bindList(
            Constants.VALUE_HELP.COMPONENT_PATH,
            undefined,
            undefined,
            [
              new Filter("Plant", FilterOperator.EQ, sPlant),
              new Filter("component", FilterOperator.EQ, sComponent)
            ],
            {
              $select: Constants.VALUE_HELP.COMPONENT_SELECT.join(",")
            }
          );

          oListBinding
            .requestContexts(0, 1)
            .then(function (aContexts) {
              if (!aContexts.length) {
                resolve({
                  valid: false,
                  component: "",
                  description: "",
                  uom: ""
                });

                return;
              }

              var oData = aContexts[0].getObject();

              resolve({
                valid: true,
                component: oData.component || sComponent,
                description: ItemScreenService.getComponentDescription(oData),
                uom: ItemScreenService.getComponentUom(oData)
              });
            })
            .catch(function () {
              resolve({
                valid: false,
                component: "",
                description: "",
                uom: ""
              });
            });
        });
      },

      fillComponentDetails: function (oODataModel, oContext, sComponent, sPlant) {
        var oItemModel = oContext.getModel();
        var sPath = oContext.getPath();

        oItemModel.setProperty(sPath + "/component", sComponent);
        oItemModel.setProperty(sPath + "/description", "");
        oItemModel.setProperty(sPath + "/uom", "");

        return this.checkComponentPlantExtension(
          oODataModel,
          sComponent,
          sPlant
        ).then(function (oResult) {
          if (!oResult.valid) {
            return false;
          }

          oItemModel.setProperty(
            sPath + "/component",
            oResult.component || sComponent
          );
          oItemModel.setProperty(
            sPath + "/description",
            oResult.description || ""
          );
          oItemModel.setProperty(sPath + "/uom", oResult.uom || "");

          return true;
        });
      },

      loadComponentVHData: function (oController, sPlant) {
        if (
          oController._oComponentVHModel &&
          oController._sComponentVHPlant === sPlant
        ) {
          return Promise.resolve(oController._oComponentVHModel);
        }

        return new Promise(function (resolve, reject) {
          var oODataModel = oController.getOwnerComponent().getModel();

          var oListBinding = oODataModel.bindList(
            Constants.VALUE_HELP.COMPONENT_PATH,
            null,
            null,
            [new Filter("Plant", FilterOperator.EQ, sPlant)],
            {
              $select: Constants.VALUE_HELP.COMPONENT_SELECT.join(",")
            }
          );

          oListBinding
            .requestContexts(0, 5000)
            .then(function (aContexts) {
              var aResults = aContexts.map(function (oContext) {
                return oContext.getObject();
              });

              oController._sComponentVHPlant = sPlant;
              oController._oComponentVHModel = new JSONModel({
                items: aResults
              });

              resolve(oController._oComponentVHModel);
            })
            .catch(function (oError) {
              reject(oError);
            });
        });
      },

      loadSortStringVHData: function (oController, sComponent) {
        sComponent = String(sComponent || "").trim();

        if (!sComponent) {
          return Promise.resolve(
            new JSONModel({
              items: []
            })
          );
        }

        if (
          oController._oSortStringVHModel &&
          oController._sSortStringVHMaterial === sComponent
        ) {
          return Promise.resolve(oController._oSortStringVHModel);
        }

        return new Promise(function (resolve, reject) {
          var oODataModel = oController.getOwnerComponent().getModel();

          /*
           * Important:
           * We are passing row component from BOMChangeItem.controller.js.
           * Backend sort string VH field is Product, so component is used against Product.
           */
          var oListBinding = oODataModel.bindList(
            Constants.VALUE_HELP.SORT_STRING_PATH,
            undefined,
            undefined,
            [new Filter("Product", FilterOperator.EQ, sComponent)],
            {
              $select: Constants.VALUE_HELP.SORT_STRING_SELECT.join(",")
            }
          );

          oListBinding
            .requestContexts(0, 5000)
            .then(function (aContexts) {
              var aResults = aContexts.map(function (oContext) {
                var oData = oContext.getObject();

                return {
                  Product:
                    oData.Product ||
                    oData.product ||
                    sComponent,

                  Style:
                    oData.Style ||
                    oData.style ||
                    "",

                  Zcomb:
                    oData.Zcomb ||
                    oData.zcomb ||
                    oData.sortString ||
                    oData.SortString ||
                    oData.BOMItemSorter ||
                    oData.BomItemSorter ||
                    "",

                  sortString:
                    oData.Zcomb ||
                    oData.zcomb ||
                    oData.sortString ||
                    oData.SortString ||
                    oData.BOMItemSorter ||
                    oData.BomItemSorter ||
                    "",

                  ColorName:
                    oData.ColorName ||
                    oData.colorName ||
                    "",

                  sizes:
                    oData.sizes ||
                    oData.Sizes ||
                    oData.Size ||
                    ""
                };
              });

              oController._sSortStringVHMaterial = sComponent;
              oController._oSortStringVHModel = new JSONModel({
                items: aResults
              });

              resolve(oController._oSortStringVHModel);
            })
            .catch(function (oError) {
              reject(oError);
            });
        });
      },
      validateBeforeSave: function (oHeader, aItems) {
        if (!oHeader) {
          return {
            valid: false,
            message:
              "Header data is missing. Please go back and enter header details."
          };
        }

        if (!oHeader.Material) {
          return {
            valid: false,
            message: "Material is required."
          };
        }

        if (!oHeader.Plant) {
          return {
            valid: false,
            message: "Plant is required."
          };
        }

        if (!oHeader.BomUsage) {
          return {
            valid: false,
            message: "BOM Usage is required."
          };
        }

        if (!oHeader.AltBom) {
          return {
            valid: false,
            message: "Alternative BOM is required."
          };
        }

        if (!oHeader.BaseQty || Number(oHeader.BaseQty) <= 0) {
          return {
            valid: false,
            message: "Base Quantity must be greater than zero."
          };
        }

        if (!oHeader.BaseUom) {
  return {
    valid: false,
    message: "Base UOM is required."
  };
}
        if (!oHeader.ValidFrom) {
          return {
            valid: false,
            message: "Valid From date is required."
          };
        }

        if (!aItems.length) {
          return {
            valid: false,
            message: "Please add at least one BOM item."
          };
        }

        for (var i = 0; i < aItems.length; i++) {
          var oItem = aItems[i];
          var sPrefix = "Row " + (i + 1) + ": ";

          if (!oItem.component) {
            return {
              valid: false,
              message: sPrefix + "Component is required."
            };
          }

          if (!oItem.quantity || Number(oItem.quantity) <= 0) {
            return {
              valid: false,
              message: sPrefix + "Quantity must be greater than zero."
            };
          }
          if (!oItem.uom) {
  return {
    valid: false,
    message: sPrefix + "UOM is required."
  };
}

          if (!this.isValidQuantityDecimal(oItem.quantity)) {
            return {
              valid: false,
              message:
                sPrefix + "Quantity can have maximum 3 digits after decimal."
            };
          }
        }

        return {
          valid: true,
          message: ""
        };
      },

    buildBomCreatePayload: function (oHeader, aItems) {
  return {
    Material: oHeader.Material,
    Plant: oHeader.Plant,
    BomUsage: oHeader.BomUsage || Constants.BOM_USAGE,
    AltBom: oHeader.AltBom,
    BaseQty: Number(oHeader.BaseQty || Constants.DEFAULTS.BASE_QTY),

    // Added because backend now takes Base UOM from payload
    BaseUom: oHeader.BaseUom || oHeader.BaseUnit || oHeader.baseUom || "",

    ValidFrom: oHeader.ValidFrom,
    BomStatus: oHeader.BomStatus || Constants.BOM_STATUS,
    HeaderText: oHeader.HeaderText || "",

    _Item: aItems.map(function (oItem, iIndex) {
      return {
        ItemNo: String(
          parseInt(oItem.item || iIndex + 1, 10) || iIndex + 1
        ).padStart(4, "0"),
        ItemCategory: Constants.ITEM_CATEGORY,
        Component: String(oItem.component || "").substring(0, 40),
        Quantity: Number(oItem.quantity),
        ItemText: String(oItem.remarks || "").substring(0, 40),

        // Item UOM already comes from row payload
        Uom: String(oItem.uom || "").substring(0, 3),

        SortString: String(oItem.sortString || "").substring(0, 10)
      };
    })
  };
},
      extractBillOfMaterial: function (sApiResponse) {
        if (!sApiResponse) {
          return "";
        }

        try {
          var oApiResponse =
            typeof sApiResponse === "string"
              ? JSON.parse(sApiResponse)
              : sApiResponse;

          if (oApiResponse.BillOfMaterial) {
            return oApiResponse.BillOfMaterial;
          }

          if (oApiResponse.d && oApiResponse.d.BillOfMaterial) {
            return oApiResponse.d.BillOfMaterial;
          }

          return "";
        } catch (oParseError) {
          void oParseError;

          var aMatch = String(sApiResponse).match(
            /"BillOfMaterial"\s*:\s*"([^"]+)"/
          );

          return aMatch ? aMatch[1] : "";
        }
      }
    };

    return ItemScreenService;
  }
);
