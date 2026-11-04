sap.ui.define([
    "sap/ui/core/UIComponent",
    "zppbomautomation/model/models",
    "zppbomautomation/util/UnsavedChanges"
], (UIComponent, models, UnsavedChanges) => {
    "use strict";

    return UIComponent.extend("zppbomautomation.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.unsavedChanges = new UnsavedChanges(this);
            this.getRouter().initialize();
        },

        destroy() {
            this.unsavedChanges.destroy();
            UIComponent.prototype.destroy.apply(this, arguments);
        }
    });
});