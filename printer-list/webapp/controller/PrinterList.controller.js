sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
  ],
  (Controller, JSONModel, Filter, FilterOperator, Fragment) => {
    "use strict";

    return Controller.extend(
      "com.agrintesa.printerlist.controller.PrinterList",
      {
        onInit() {
          // Crea un modello JSON vuoto
          var oModel = new JSONModel();
          this.getView().setModel(oModel);
          let that = this;

          // Recupera i dati dalla sorgente
          this._loadData();

          // Configura il WebSocket
          this.socket = new WebSocket("ws://localhost:5000");

          // Gestisci i messaggi ricevuti
          this.socket.onmessage = function (event) {
            console.log("message received: " + JSON.stringify(event))
            var newData = JSON.parse(event.data);
            console.log(that)
            if(newData.response == 'token') 
                that.byId("_IDGenButton2").setText("prova")
           // oModel.setData(newData);
           // oModel.refresh(); // Rinfresca la tabella
          };

          // Gestisci eventuali errori
          this.socket.onerror = function (error) {
            console.error("WebSocket Error: ", error);
          };

          // Chiudi la connessione quando la vista viene distrutta
          this.getView().addEventDelegate({
            onBeforeHide: function () {
              socket.close();
            },
          });
        },

        _loadData() {
          this.oModel = this.getView().getModel();

          var sUrl = "http://localhost:5000/getAll";
          //    var sUrlUnique = "http://localhost:5000/getunique";
          var oView = this.getView();
          var that = this;

          oView.setBusy(true);

          // Effettua la chiamata AJAX per recuperare i dati
          $.ajax({
            url: sUrl,
            method: "GET",
            success: function (data) {
              // Imposta i dati nel modello
              that.oModel.setData(data);
              console.log(data);
              that.applyData = that.applyData.bind(that);
              that.fetchData = that.fetchData.bind(that);
              that.getFiltersWithValues = that.getFiltersWithValues.bind(that);

              //that.oSmartVariantManagement = oView.byId("svm");
              that.oExpandedLabel = oView.byId("expandedLabel");
              that.oSnappedLabel = oView.byId("snappedLabel");
              that.oFilterBar = oView.byId("filterbar");
              that.oTable = oView.byId("printerTable");

              that.oFilterBar.registerFetchData(that.fetchData);
              that.oFilterBar.registerApplyData(that.applyData);
              that.oFilterBar.registerGetFiltersWithValues(
                that.getFiltersWithValues
              );

              oView.setBusy(false);
            },
            error: function (error) {
              console.error("Errore nel recupero dei dati: ", error);
              oView.setBusy(false);
              return;
            },
          });
        },
        onExit: function () {
          this.oModel = null;
          // this.oSmartVariantManagement = null;
          this.oExpandedLabel = null;
          this.oSnappedLabel = null;
          this.oFilterBar = null;
          this.oTable = null;
        },

        onUpdatePress: function () {
          this._loadData();
        },
        onCustomScanPress: function () {
          console.log("onCustomScanPress");
          // Invia il messaggio "reload" al backend tramite WebSocket
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ action: "reload" }));
          } else {
            console.error("WebSocket is not open");
          }
        },
        fetchData: function () {
          console.log("fetchData");
          var aData = this.oFilterBar
            .getAllFilterItems()
            .reduce(function (aResult, oFilterItem) {
              aResult.push({
                groupName: oFilterItem.getGroupName(),
                fieldName: oFilterItem.getName(),
                fieldData: oFilterItem.getControl().getSelectedKeys(),
              });

              return aResult;
            }, []);

          return aData;
        },

        applyData: function (aData) {
          console.log("applyData");

          aData.forEach(function (oDataObject) {
            var oControl = this.oFilterBar.determineControlByName(
              oDataObject.fieldName,
              oDataObject.groupName
            );
            oControl.setSelectedKeys(oDataObject.fieldData);
          }, this);
        },

        getFiltersWithValues: function () {
          console.log("getFiltersWithValues");

          var aFiltersWithValue = this.oFilterBar
            .getFilterGroupItems()
            .reduce(function (aResult, oFilterGroupItem) {
              var oControl = oFilterGroupItem.getControl();

              if (
                oControl &&
                oControl.getSelectedKeys &&
                oControl.getSelectedKeys().length > 0
              ) {
                aResult.push(oFilterGroupItem);
              }

              return aResult;
            }, []);

          return aFiltersWithValue;
        },
        onInputChange: function (oEvent) {
          //  this.oSmartVariantManagement.currentVariantSetModified(true);
          this.oFilterBar.fireFilterChange(oEvent);
        },

        onSelectionChange: function (oEvent) {
          //  this.oSmartVariantManagement.currentVariantSetModified(true);
          this.oFilterBar.fireFilterChange(oEvent);
        },

        onSearch: function () {
          console.log("onSearch");
          var aTableFilters = this.oFilterBar
            .getFilterGroupItems()
            .reduce(function (aResult, oFilterGroupItem) {
              console.log("oFilterGroupItem: " + oFilterGroupItem);

              var aFilters = [];
              if (oFilterGroupItem.getGroupName() == "Group1") {
                console.log(
                  "aSelectedKeys: " +
                    oFilterGroupItem.getControl().getSelectedKeys()
                );

                var oControl = oFilterGroupItem.getControl(),
                  aSelectedKeys = oControl.getSelectedKeys();
                aFilters = aSelectedKeys.map(function (sSelectedKey) {
                  var f = new Filter({
                    path: oFilterGroupItem.getName(),
                    operator: FilterOperator.Contains,
                    value1: sSelectedKey,
                  });
                  console.log(JSON.stringify(f));
                  return new Filter({
                    path: oFilterGroupItem.getName(),
                    operator: FilterOperator.Contains,
                    value1: sSelectedKey,
                  });
                });

                if (aSelectedKeys && aSelectedKeys.length > 0) {
                  aResult.push(
                    new Filter({
                      filters: aFilters,
                      and: false,
                    })
                  );
                }
              } else if (oFilterGroupItem.getGroupName() == "Group2") {
                console.log(
                  "aValue: " + oFilterGroupItem.getControl().getValue()
                );

                var oControl = oFilterGroupItem.getControl(),
                  aValue = oControl.getValue();

                if (aValue && aValue.length > 0) {
                  aFilters.push(
                    new Filter({
                      path: oFilterGroupItem.getName(),
                      operator: FilterOperator.Contains,
                      value1: aValue,
                    })
                  );
                  console.log(aFilters, aValue);

                  aResult.push(
                    new Filter({
                      filters: aFilters,
                      and: false,
                    })
                  );
                }
              } else {
                console.log(oFilterGroupItem.getGroupName() + " non definito");
              }
              console.log("aFilters: " + JSON.stringify(aFilters));

              return aResult;
            }, []);

          this.oTable.getBinding("items").filter(aTableFilters);
          this.oTable.setShowOverlay(false);
        },

        onFilterChange: function () {
          this._updateLabelsAndTable();
        },

        onAfterVariantLoad: function () {
          this._updateLabelsAndTable();
        },

        getFormattedSummaryText: function () {
          console.log("getFormattedSummaryText");
          var aFiltersWithValues = this.oFilterBar.retrieveFiltersWithValues();

          if (aFiltersWithValues.length === 0) {
            return "No filters active";
          }

          if (aFiltersWithValues.length === 1) {
            return (
              aFiltersWithValues.length +
              " filter active: " +
              aFiltersWithValues.join(", ")
            );
          }

          return (
            aFiltersWithValues.length +
            " filters active: " +
            aFiltersWithValues.join(", ")
          );
        },

        getFormattedSummaryTextExpanded: function () {
          console.log("getFormattedSummaryTextExpanded");
          var aFiltersWithValues = this.oFilterBar.retrieveFiltersWithValues();
          console.log("getFormattedSummaryTextExpanded " + aFiltersWithValues);
          if (aFiltersWithValues.length === 0) {
            return "Nessun filtro attivo";
          }

          var sText = aFiltersWithValues.length + " filtri attivi",
            aNonVisibleFiltersWithValues =
              this.oFilterBar.retrieveNonVisibleFiltersWithValues();

          if (aFiltersWithValues.length === 1) {
            sText = aFiltersWithValues.length + " filtro attivo";
          }

          if (
            aNonVisibleFiltersWithValues &&
            aNonVisibleFiltersWithValues.length > 0
          ) {
            sText += " (" + aNonVisibleFiltersWithValues.length + " nascosto)";
          }

          return sText;
        },

        _updateLabelsAndTable: function () {
          console.log("_updateLabelsAndTable");
          this.oExpandedLabel.setText(this.getFormattedSummaryTextExpanded());
          this.oSnappedLabel.setText(this.getFormattedSummaryText());
          this.oTable.setShowOverlay(true);
        },

        onOpenDialog: function () {
          var oView = this.getView();
          var oDialog = oView.byId("subnetDialog");
          if (!oDialog) {
            Fragment.load({
              id: oView.getId(),
              name: "com.agrintesa.printerlist.view.SubnetDialog",
              controller: this,
            }).then(function (oDialog) {
              oView.addDependent(oDialog);
              oDialog.open();
            });
          } else {
            oDialog.open();
          }
        },

        onCloseDialog: function () {
          this.byId("subnetDialog").close();
        },
      }
    );
  }
);
