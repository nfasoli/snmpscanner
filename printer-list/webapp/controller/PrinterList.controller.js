sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"], 
    (Controller, JSONModel) => {
    "use strict";

    return Controller.extend("com.agrintesa.printerlist.controller.PrinterList", {
        onInit() {
            // Crea un modello JSON vuoto
            var oModel = new JSONModel();
            this.getView().setModel(oModel);

            // Recupera i dati dalla sorgente
            this._loadData();
        },

        _loadData() {
            var oModel = this.getView().getModel();
            var sUrl = "http://localhost:5000/getAll";
            var oView = this.getView();

            oView.setBusy(true);

            // Effettua la chiamata AJAX per recuperare i dati
            $.ajax({
                url: sUrl,
                method: "GET",
                success: function (data) {
                    // Imposta i dati nel modello
                    oModel.setData({ printers: data });
                    oView.setBusy(false);
                },
                error: function (error) {
                    console.error("Errore nel recupero dei dati: ", error);
                    oView.setBusy(false);
                }
            });
        }
    });
});