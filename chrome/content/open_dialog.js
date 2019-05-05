var magdown = {};
Components.utils.import("resource://magdown/utils.js", magdown);

magdown.rememberChoice_disabled = null;

//-----------------------------------------------------------------------------------
magdown.init = function() {
	try {
		var oDialog = document.getElementById("unknownContentType");
		oDialog.setAttribute("ondialogaccept", "if (magdown.open_dialog()) return true; " + oDialog.getAttribute("ondialogaccept"));
	}
	catch(e) {
		document.getElementById('magdown_open').hidden = true;
		return;
	}
		
	magdown.rememberChoice_disabled = document.getElementById('rememberChoice').getAttribute('disabled');
	document.getElementById('mode').addEventListener("RadioStateChange", magdown.toggle_radio, true);

 	var mimeType = null;
 	try {
		var mimeService = Components.classes["@mozilla.org/mime;1"].getService(Components.interfaces.nsIMIMEService);
	 	mimeType = mimeService.getTypeFromURI(dialog.mLauncher.source);
	}
	catch (e) {
		mimeType = dialog.mLauncher.MIMEInfo.MIMEType;
	}

	if ((mimeType.indexOf("x-bittorrent") != -1) || (mimeType.indexOf("magnet") != -1) || (/\.torrent$/i.test(dialog.mLauncher.suggestedFileName))) {
		document.getElementById('magdown_open').hidden = false;
		if (magdown.utils.prefs.getBoolPref('torrent_dialog_item_selected')) {
			document.getElementById('mode').selectedItem = document.getElementById('magdown_open');
		}

	} else {
		document.getElementById('magdown_open').hidden = true;
	}
}
//-----------------------------------------------------------------------------------
magdown.toggle_radio = function() {
	if (document.getElementById('magdown_open').selected) {
		document.getElementById('rememberChoice').setAttribute("disabled", true);
	} else {
		document.getElementById('rememberChoice').setAttribute("disabled", magdown.rememberChoice_disabled);
	}
}
//-----------------------------------------------------------------------------------
magdown.open_dialog = function() {
	if (document.getElementById('magdown_open').selected) {
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
		magdown.utils.add_new_torrent({ 'data' : dialog.mLauncher.source.spec, 'is_url' : true, 'referrer_url' : referrer_url });
		magdown.utils.prefs.setBoolPref('torrent_dialog_item_selected', true);
		return true;
  	}
	magdown.utils.prefs.setBoolPref('torrent_dialog_item_selected', false);
	return false;
}
//-----------------------------------------------------------------------------------
window.addEventListener("load", magdown.init, false);
