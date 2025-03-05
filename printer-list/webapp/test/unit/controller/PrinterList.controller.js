/*global QUnit*/

sap.ui.define([
	"comagrintesa/printer-list/controller/PrinterList.controller"
], function (Controller) {
	"use strict";

	QUnit.module("PrinterList Controller");

	QUnit.test("I should test the PrinterList controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
