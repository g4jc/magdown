Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");


function S3TorrentTornado_Magnet() {};
S3TorrentTornado_Magnet.prototype = {
	scheme: "magnet",
	prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.magdown."),
	newURI: function(aSpec, aOriginCharset, aBaseURI) {
		if (aSpec) {
			var uri = Components.classes["@mozilla.org/network/simple-uri;1"].createInstance(Components.interfaces.nsIURI);
			uri.spec = aSpec;
			return uri;
		} else {
			return null;
		}
	},
	newChannel: function(aURI) {
		var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
		observerService.notifyObservers(aURI, "magdown-magnet-open-url", "magnet");
		return Services.io.newChannel("javascript:void()", null, null);
	},
	classDescription: "Torrent Tornado - Magnet Protocol Handler",
	contractID: "@mozilla.org/network/protocol;1?name=" + "magnet",
	classID: Components.ID('{D4EE4145-3160-44C3-B17A-4AC50A7D5AC2}'),
	protocolFlags : Components.interfaces.nsIProtocolHandler.URI_STD | Components.interfaces.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE,
	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIProtocolHandler]),
};

var magdown_prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.magdown.");
if (magdown_prefs.getBoolPref('magnet_uri_association')) {
	if (XPCOMUtils.generateNSGetFactory) {
		var NSGetFactory = XPCOMUtils.generateNSGetFactory([S3TorrentTornado_Magnet]);
	} else {
		var NSGetModule = XPCOMUtils.generateNSGetModule([S3TorrentTornado_Magnet]);
	}
}
