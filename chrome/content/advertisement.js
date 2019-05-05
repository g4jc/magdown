var s3torrent = {};
s3torrent.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.s3torrent.");
s3torrent.from_settings = false;

//------------------------------------------------------------------------------
s3torrent.dialog_init = function() {
	window.innerHeight = window.document.documentElement.clientHeight;
	var params = (window.arguments && window.arguments[0]);
	if (params && params.from_settings) {
		s3torrent.from_settings = true;
	}

	s3torrent.tab_close_check();
}
//------------------------------------------------------------------------------
s3torrent.tab_get = function() {
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
	var wm_window = wm.getMostRecentWindow('navigator:browser');
	if (! wm_window) { return null; }

	var gBrowser_w = wm_window.getBrowser();
	var tab = gBrowser_w.selectedTab;
	return tab;
}
//------------------------------------------------------------------------------
s3torrent.tab_close_check = function() {
	var tab = s3torrent.tab_get();
	if (tab && tab.linkedBrowser && tab.linkedBrowser.currentURI && (tab.linkedBrowser.currentURI.path == '/content/advertisement.xul')) {
		s3torrent.tab_remove_event(tab);
		tab.addEventListener('TabClose', s3torrent.tab_close, true);
		tab.addEventListener("TabAttrModified", s3torrent.tab_attr_modified, false);
	}
}
//------------------------------------------------------------------------------
s3torrent.tab_attr_modified = function(event) {
	var tab = event.target;
	if (tab && tab.linkedBrowser && tab.linkedBrowser.currentURI && (tab.linkedBrowser.currentURI.path == '/content/advertisement.xul')) {
		return;
	} else {
		s3torrent.tab_remove_event(tab);
		return;
	}
}
//------------------------------------------------------------------------------
s3torrent.tab_remove_event = function(tab) {
	if (! tab) {
		tab = s3torrent.tab_get();
	}
	if (tab) {
		tab.removeEventListener('TabClose', s3torrent.tab_close, true);
		tab.removeEventListener("TabAttrModified", s3torrent.tab_attr_modified, false);
	}
}
//------------------------------------------------------------------------------
s3torrent.tab_close = function(event) {
	var advertisement = s3torrent.prefs.getCharPref("advertisement");
	if (advertisement != 'on') {
		s3torrent.offer_discount();
	}
	s3torrent.tab_remove_event(event.target);
}
//------------------------------------------------------------------------------
s3torrent.ondialogaccept = function() {
	s3torrent.advertisement_on();
	s3torrent.tab_remove_event();
}
//------------------------------------------------------------------------------
s3torrent.ondialogcancel = function(event) {
	var advertisement = s3torrent.prefs.getCharPref("advertisement");
	if (advertisement != 'on') {
		s3torrent.offer_discount();
	}
}
//------------------------------------------------------------------------------
s3torrent.ondialogcancel_button = function(event) {
	s3torrent.offer_discount();
	s3torrent.tab_remove_event();
	window.close();
}
//------------------------------------------------------------------------------
s3torrent.advertisement_on = function() {
	if (s3torrent.from_settings) {
		window.result = 'on';
	} else {
		s3torrent.prefs.setCharPref("advertisement", "on");
	}
}
//------------------------------------------------------------------------------
s3torrent.advertisement_off = function() {
	if (s3torrent.from_settings) {
		window.result = 'off2';
	} else {
		s3torrent.prefs.setCharPref("advertisement", "off2");
	}
}
//------------------------------------------------------------------------------
s3torrent.offer_discount = function() {
	var params = { 'is_ok' : false };
	var winD = window.openDialog('chrome://s3torrent/content/advertisement_offer.xul', 's3torrent_advertisement_offer', 'chrome,modal,centerscreen,toolbar', params);
	if (params.is_ok) {
		s3torrent.advertisement_on();
	} else {
		s3torrent.advertisement_off();
	}
}
//------------------------------------------------------------------------------
