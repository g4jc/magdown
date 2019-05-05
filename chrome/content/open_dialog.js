var s3torrent = {};
Components.utils.import("resource://s3torrent/utils.js", s3torrent);

s3torrent.rememberChoice_disabled = null;

//-----------------------------------------------------------------------------------
s3torrent.init = function() {
	try {
		var oDialog = document.getElementById("unknownContentType");
		oDialog.setAttribute("ondialogaccept", "if (s3torrent.open_dialog()) return true; " + oDialog.getAttribute("ondialogaccept"));
	}
	catch(e) {
		document.getElementById('s3torrent_open').hidden = true;
		return;
	}
		
	s3torrent.rememberChoice_disabled = document.getElementById('rememberChoice').getAttribute('disabled');
	document.getElementById('mode').addEventListener("RadioStateChange", s3torrent.toggle_radio, true);

 	var mimeType = null;
 	try {
		var mimeService = Components.classes["@mozilla.org/mime;1"].getService(Components.interfaces.nsIMIMEService);
	 	mimeType = mimeService.getTypeFromURI(dialog.mLauncher.source);
	}
	catch (e) {
		mimeType = dialog.mLauncher.MIMEInfo.MIMEType;
	}

	if ((mimeType.indexOf("x-bittorrent") != -1) || (mimeType.indexOf("magnet") != -1) || (/\.torrent$/i.test(dialog.mLauncher.suggestedFileName))) {
		document.getElementById('s3torrent_open').hidden = false;
		if (s3torrent.utils.prefs.getBoolPref('torrent_dialog_item_selected')) {
			document.getElementById('mode').selectedItem = document.getElementById('s3torrent_open');
		}

	} else {
		document.getElementById('s3torrent_open').hidden = true;
	}
}
//-----------------------------------------------------------------------------------
s3torrent.toggle_radio = function() {
	if (document.getElementById('s3torrent_open').selected) {
		document.getElementById('rememberChoice').setAttribute("disabled", true);
	} else {
		document.getElementById('rememberChoice').setAttribute("disabled", s3torrent.rememberChoice_disabled);
	}
}
//-----------------------------------------------------------------------------------
s3torrent.open_dialog = function() {
	if (document.getElementById('s3torrent_open').selected) {
		var openerDocument = null;
		var referrer_url = '';

		try {
			openerDocument = dialog.mContext.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindow).document;
		} catch(e) {
			openerDocument = top.opener && top.opener.content && top.opener.content.document || null;
		}

		try {
			referrer_url = dialog.mContext.QueryInterface(Components.interfaces.nsIWebNavigation).currentURI.spec;
		} catch(e) {
			referrer_url = openerDocument && openerDocument.URL || '';
		}
		s3torrent.utils.add_new_torrent({ 'data' : dialog.mLauncher.source.spec, 'is_url' : true, 'referrer_url' : referrer_url });
		s3torrent.utils.prefs.setBoolPref('torrent_dialog_item_selected', true);
		return true;
  	}
	s3torrent.utils.prefs.setBoolPref('torrent_dialog_item_selected', false);
	return false;
}
//-----------------------------------------------------------------------------------
window.addEventListener("load", s3torrent.init, false);
