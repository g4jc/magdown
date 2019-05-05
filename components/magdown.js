Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

//------------------------------------------------------------------------------
function S3TorrentTornado() { 
}
//------------------------------------------------------------------------------
S3TorrentTornado.prototype = {
	classID: Components.ID('{D4EE4145-3160-44C3-B17A-4AC50D7D8AC1}'),
	contractID: '@magdown.com/tornado;1',
	classDescription: 'Torrent Tornado',
	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver, Components.interfaces.nsISupportsWeakReference, Components.interfaces.nsISupports]),
	get wrappedJSObject(){return(this);},

	//------------------------------------------------------------------------
	init_is_started : false,
	//------------------------------------------------------------------------
	init : function() {
		if (this.torrent || this.init_is_started) { return; }
		this.init_is_started = true;
		Components.utils.import("resource://magdown/torrent.js", this);
		this.torrent.init();
		this.set_about();
	},
	//------------------------------------------------------------------------
	set_about : function() {
		var about = {
			'Contract' : "@mozilla.org/network/protocol/about;1?what=downloads-torrent",
			'Description' : "Torrent Tornado about module",
			'UUID' : Components.ID("D4EE4145-3060-44A3-B17A-1BC50D1D8AC1"),
			'Factory' : {
				createInstance: function(outer, iid) {
					if (outer != null) {
						throw Components.results.NS_ERROR_NO_AGGREGATION;
					}
					return about.aboutPage.QueryInterface(iid);
				}
			},
			'aboutPage' : {
				QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIAboutModule]),
				getURIFlags: function(aURI) {
					return Components.interfaces.nsIAboutModule.ALLOW_SCRIPT;
				},
				newChannel: function(aURI, aLoadInfo) {
					var channel = null;
					try {
						var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
						var newURI = ios.newURI("chrome://magdown/content/downloads_library.xul", null, null);
						channel = ios.newChannelFromURIWithLoadInfo(newURI, aLoadInfo);
						channel.originalURI = aURI;
					} catch(e) {
						var uri = Services.io.newURI("chrome://magdown/content/downloads_library.xul", null, null);
						channel = Services.io.newChannelFromURI(uri);
						channel.originalURI = aURI;
					}
					return channel;
				},
				getURIFlags: function(aURI) { 0 }
			}
		}
		Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar).registerFactory(about.UUID, about.Description, about.Contract, about.Factory);
	}
}

if (XPCOMUtils.generateNSGetFactory) {
	var NSGetFactory = XPCOMUtils.generateNSGetFactory([S3TorrentTornado]);
}

//------------------------------------------------------------------------------
