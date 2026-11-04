sap.ui.define(["sap/m/MessageBox"], function (MessageBox) {
    "use strict";

    var MESSAGE = "You have unsaved BOM changes. Leave this screen and discard them?";

    function UnsavedChanges(oComponent) {
        this.component = oComponent;
        this.shell = sap.ushell && sap.ushell.Container;
        this.provider = this.isDirty.bind(this);
        if (this.shell && this.shell.registerDirtyStateProvider) {
            this.shell.registerDirtyStateProvider(this.provider);
        }
        this.onInput = function (oEvent) {
            var oDom = this.view && this.view.getDomRef();
            if (oDom && oDom.contains(oEvent.target)) {
                this.pendingInput = true;
            }
        }.bind(this);
        this.onUnload = function (oEvent) {
            if (this.isDirty()) {
                oEvent.preventDefault();
                oEvent.returnValue = "";
            }
        }.bind(this);
        this.onHashChange = function (oEvent) {
            var sOldHash = new URL(oEvent.oldURL).hash;
            var sNewHash = new URL(oEvent.newURL).hash;
            // The launchpad owns cross-application navigation and its data-loss dialog.
            var bShellNavigation = this.shell &&
                sOldHash.split("&/")[0] !== sNewHash.split("&/")[0];
            if (bShellNavigation || !this.isDirty()) {
                return;
            }
            // Run before the router sees the changed hash, preserving the current view on Cancel.
            oEvent.stopImmediatePropagation();
            window.history.replaceState(window.history.state, "", oEvent.oldURL);
            if (this.dialogOpen) {
                return;
            }
            this.dialogOpen = true;
            MessageBox.warning(MESSAGE, {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.CANCEL,
                onClose: function (sAction) {
                    this.dialogOpen = false;
                    if (sAction === MessageBox.Action.OK) {
                        this.end();
                        window.location.hash = sNewHash;
                    }
                }.bind(this)
            });
        }.bind(this);
        this.onRoute = function (oEvent) {
            var sName = oEvent.getParameter("name");
            if (sName !== "RouteBOMItem" && sName !== "RouteBOMChangeItem") {
                this.end();
            }
        }.bind(this);
        oComponent.getRouter().attachRouteMatched(this.onRoute);
        document.addEventListener("input", this.onInput, true);
        window.addEventListener("beforeunload", this.onUnload);
        window.addEventListener("hashchange", this.onHashChange, true);
    }

    UnsavedChanges.prototype.snapshot = function () {
        return JSON.stringify(["headerModel", "itemModel"].map(function (sName) {
            var oModel = this.component.getModel(sName);
            return oModel ? oModel.getData() : null;
        }, this));
    };

    UnsavedChanges.prototype.begin = function (oView) {
        this.view = oView;
        this.markClean();
    };

    UnsavedChanges.prototype.markClean = function () {
        this.baseline = this.snapshot();
        this.pendingInput = false;
    };

    UnsavedChanges.prototype.isDirty = function () {
        return Boolean(this.view && (this.pendingInput || this.baseline !== this.snapshot()));
    };

    UnsavedChanges.prototype.end = function () {
        this.view = null;
        this.pendingInput = false;
    };

    UnsavedChanges.prototype.confirmLeave = function (fnLeave) {
        if (!this.isDirty()) {
            this.end();
            fnLeave();
            return;
        }
        if (this.dialogOpen) {
            return;
        }
        this.dialogOpen = true;
        MessageBox.warning(MESSAGE, {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.CANCEL,
            onClose: function (sAction) {
                this.dialogOpen = false;
                if (sAction === MessageBox.Action.OK) {
                    this.end();
                    fnLeave();
                }
            }.bind(this)
        });
    };

    UnsavedChanges.prototype.destroy = function () {
        this.end();
        if (this.shell && this.shell.deregisterDirtyStateProvider) {
            this.shell.deregisterDirtyStateProvider(this.provider);
        }
        this.component.getRouter().detachRouteMatched(this.onRoute);
        document.removeEventListener("input", this.onInput, true);
        window.removeEventListener("beforeunload", this.onUnload);
        window.removeEventListener("hashchange", this.onHashChange, true);
    };

    return UnsavedChanges;
});
