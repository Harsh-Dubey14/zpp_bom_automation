sap.ui.define(["sap/ui/model/json/JSONModel"], function (JSONModel) {
  "use strict";

  return {
    createDefaultData: function () {
      return {
        BomId: "",
        Status: "",
        StatusState: "None",
        Message: "",
        MessageType: "Information",
        ShowMessage: false,
        BillOfMaterial: "",
        CreatedBomVariant: "",
        CanSave: true,
        Editable: true
      };
    },

    init: function (oView) {
      var oExistingModel = oView.getModel("resultModel");

      if (oExistingModel) {
        return oExistingModel;
      }

      var oModel = new JSONModel(this.createDefaultData());

      oView.setModel(oModel, "resultModel");

      return oModel;
    },

    reset: function (oResultModel) {
      if (oResultModel) {
        oResultModel.setData(this.createDefaultData());
      }
    },

    setCreating: function (oResultModel) {
      if (!oResultModel) {
        return;
      }

      oResultModel.setProperty("/CanSave", false);
      oResultModel.setProperty("/Message", "Creating BOM...");
      oResultModel.setProperty("/MessageType", "Information");
      oResultModel.setProperty("/ShowMessage", true);
    },

    setError: function (oResultModel, sMessage) {
      if (!oResultModel) {
        return;
      }

      oResultModel.setProperty("/CanSave", true);
      oResultModel.setProperty("/Editable", true);
      oResultModel.setProperty("/StatusState", "Error");
      oResultModel.setProperty(
        "/Message",
        sMessage || "Unexpected error occurred."
      );
      oResultModel.setProperty("/MessageType", "Error");
      oResultModel.setProperty("/ShowMessage", true);
    },

    applyCreateResponse: function (oResultModel, oResponse, sBillOfMaterial) {
      var sStatus = oResponse.Status || "";
      var sMessage = oResponse.Message || "";

      oResultModel.setProperty("/BomId", oResponse.BomId || "");
      oResultModel.setProperty("/Status", sStatus);
      oResultModel.setProperty("/Message", sMessage);
      oResultModel.setProperty("/ShowMessage", true);
      oResultModel.setProperty("/BillOfMaterial", sBillOfMaterial || "");

      if (sStatus === "SUCCESS") {
        oResultModel.setProperty("/StatusState", "Success");
        oResultModel.setProperty("/MessageType", "Success");
        oResultModel.setProperty("/CanSave", false);
        oResultModel.setProperty("/Editable", false);
        return;
      }

      if (sStatus === "ERROR") {
        oResultModel.setProperty("/StatusState", "Error");
        oResultModel.setProperty("/MessageType", "Error");
        oResultModel.setProperty("/CanSave", true);
        oResultModel.setProperty("/Editable", true);
        return;
      }

      oResultModel.setProperty("/StatusState", "Warning");
      oResultModel.setProperty("/MessageType", "Warning");
      oResultModel.setProperty("/CanSave", true);
      oResultModel.setProperty("/Editable", true);
    }
  };
});