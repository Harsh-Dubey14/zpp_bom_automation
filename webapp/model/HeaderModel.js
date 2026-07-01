sap.ui.define(
  [
    "sap/ui/model/json/JSONModel",
    "zppbomautomation/config/Constants"
  ],
  function (JSONModel, Constants) {
    "use strict";

    return {
      getToday: function () {
        return new Date().toISOString().slice(0, 10);
      },

      createDefaultData: function () {
        return {
          Material: "",
          Plant: "",
          PlantName: "",
          PlantDisplay: "",
          BomUsage: Constants.BOM_USAGE,
          AltBom: "",
          BaseQty: Constants.DEFAULTS.BASE_QTY,
          ValidFrom: this.getToday(),
          BaseUom: "",
          BomStatus: Constants.BOM_STATUS,
          HeaderText: "",

          CopyMaterial: "",
          CopyPlant: "",
          CopyPlantName: "",
          CopyPlantDisplay: "",
          CopyAltBom: "",

          IsValidated: false,
          Message: "",
          MessageType: Constants.DEFAULTS.MESSAGE_TYPE,
          ShowMessage: false
        };
      },

      createDataFromQuery: function (oQuery) {
        return {
          Material: oQuery.Material || "",
          Plant: oQuery.Plant || "",
          PlantName: oQuery.PlantName || "",
          PlantDisplay: oQuery.PlantDisplay || oQuery.Plant || "",
          BomUsage: Constants.BOM_USAGE,
          AltBom: oQuery.AltBom || "",
          BaseQty: oQuery.BaseQty
            ? Number(oQuery.BaseQty)
            : Constants.DEFAULTS.BASE_QTY,
          ValidFrom: oQuery.ValidFrom || this.getToday(),
          BaseUom: oQuery.BaseUom || "",
          BomStatus: oQuery.BomStatus || Constants.BOM_STATUS,
          HeaderText: oQuery.HeaderText || "",

          CopyMaterial: oQuery.CopyMaterial || "",
          CopyPlant: oQuery.CopyPlant || "",
          CopyPlantName: oQuery.CopyPlantName || "",
          CopyPlantDisplay: oQuery.CopyPlantDisplay || oQuery.CopyPlant || "",
          CopyAltBom: oQuery.CopyAltBom || "",

          IsValidated: oQuery.IsValidated === "true",
          Message: oQuery.Message || "",
          MessageType:
            oQuery.MessageType || Constants.DEFAULTS.MESSAGE_TYPE,
          ShowMessage: oQuery.ShowMessage === "true"
        };
      },

      init: function (oComponent, oView) {
        var oExistingModel = oComponent.getModel("headerModel");

        if (oExistingModel) {
          oExistingModel.setProperty("/BomUsage", Constants.BOM_USAGE);

          if (oExistingModel.getProperty("/HeaderText") === undefined) {
            oExistingModel.setProperty("/HeaderText", "");
          }

          if (oExistingModel.getProperty("/PlantName") === undefined) {
            oExistingModel.setProperty("/PlantName", "");
          }

          if (oExistingModel.getProperty("/PlantDisplay") === undefined) {
            oExistingModel.setProperty(
              "/PlantDisplay",
              oExistingModel.getProperty("/Plant") || ""
            );
          }

          if (oExistingModel.getProperty("/CopyPlantName") === undefined) {
            oExistingModel.setProperty("/CopyPlantName", "");
          }

          if (oExistingModel.getProperty("/CopyPlantDisplay") === undefined) {
            oExistingModel.setProperty(
              "/CopyPlantDisplay",
              oExistingModel.getProperty("/CopyPlant") || ""
            );
          }

          oView.setModel(oExistingModel, "headerModel");
          return oExistingModel;
        }

        var oModel = new JSONModel(this.createDefaultData());

        oComponent.setModel(oModel, "headerModel");
        oView.setModel(oModel, "headerModel");

        return oModel;
      },

      reset: function (oHeaderModel) {
        if (oHeaderModel) {
          oHeaderModel.setData(this.createDefaultData());
        }
      },

      setInvalidState: function (oHeaderModel, sMessage, sMessageType) {
        if (!oHeaderModel) {
          return;
        }

        oHeaderModel.setProperty("/BaseUom", "");
        oHeaderModel.setProperty("/AltBom", "");
        oHeaderModel.setProperty("/IsValidated", false);
        oHeaderModel.setProperty("/Message", sMessage || "");
        oHeaderModel.setProperty("/MessageType", sMessageType || "Error");
        oHeaderModel.setProperty("/ShowMessage", true);
        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);
      },

      clearValidation: function (oHeaderModel) {
        if (!oHeaderModel) {
          return;
        }

        oHeaderModel.setProperty("/IsValidated", false);
        oHeaderModel.setProperty("/BaseUom", "");
        oHeaderModel.setProperty("/AltBom", "");
        oHeaderModel.setProperty("/Message", "");
        oHeaderModel.setProperty(
          "/MessageType",
          Constants.DEFAULTS.MESSAGE_TYPE
        );
        oHeaderModel.setProperty("/ShowMessage", false);
        oHeaderModel.setProperty("/BomUsage", Constants.BOM_USAGE);
      }
    };
  }
);
