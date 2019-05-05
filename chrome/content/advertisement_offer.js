var s3torrent = {};

//------------------------------------------------------------------------------
s3torrent.dialog_init = function() {
	window.innerHeight = window.document.documentElement.clientHeight;
	//------------------------------------------------------------------------
	var button_cancel = document.documentElement.getButton('cancel');
	if (button_cancel) {
		s3torrent.set_label(button_cancel, 'No');
	}
	//------------------------------------------------------------------------
	var button_accept = document.documentElement.getButton('accept');
	if (button_accept) {
		s3torrent.set_label(button_accept, 'Yes');
	}
	//------------------------------------------------------------------------
}
//------------------------------------------------------------------------------
s3torrent.ondialogaccept = function() {
	window.arguments[0].is_ok=true;
}
//------------------------------------------------------------------------------
s3torrent.set_label = function(button, label) {
	try {
		var stringbundle = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService).createBundle("chrome://global/locale/commonDialogs.properties");
		var aLabel = stringbundle.GetStringFromName(label);

		var accessKey = null;
		if (/ *\(\&([^&])\)(:?)$/.test(aLabel)) {
			aLabel = RegExp.leftContext + RegExp.$2;
			accessKey = RegExp.$1;
		} else if (/^([^&]*)\&(([^&]).*$)/.test(aLabel)) {
			aLabel = RegExp.$1 + RegExp.$2;
			accessKey = RegExp.$3;
		}

		aLabel = aLabel.replace(/\&\&/g, "&");
		button.label = aLabel;

//		if (accessKey) {
//			button.accessKey = accessKey;
//		}
	} catch(e) {
	}
}
//------------------------------------------------------------------------------
