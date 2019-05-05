var s3torrent = {};
Components.utils.import("resource://s3torrent/utils.js", s3torrent);

//------------------------------------------------------------------------------
s3torrent.init = function() {
	//------------------------------------------------------------------------
	var date = new Date();
	var dbelems = document.getElementById("dateTimeFormatDL");
	for (var i=0; i<dbelems.itemCount; i++) {
		var item = dbelems.getItemAtIndex(i);
		item.setAttribute('label', date.toLocaleFormat(item.value));
	}
	s3torrent.advertisement_status();
}
//------------------------------------------------------------------------------
s3torrent.select_dir = function() {
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fp.init(window, '', Components.interfaces.nsIFilePicker.modeGetFolder);

	try {
		fp.displayDirectory = s3torrent.utils.get_default_save_dir();
	} catch(e) {
	}

	var result = fp.show();
	if (result == fp.returnOK) {
		document.getElementById('default_save_dir').value = fp.file.path;
		document.getElementById('pref_default_save_dir').value = fp.file.path;
	}
}
//------------------------------------------------------------------------------
s3torrent.reset_dir = function() {
	document.getElementById('default_save_dir').value = '';
	document.getElementById('pref_default_save_dir').value = '';
}
//------------------------------------------------------------------------------
s3torrent.advertisement = function() {
	var winD = window.openDialog('chrome://s3torrent/content/advertisement.xul', 's3torrent_advertisement', 'chrome,modal,centerscreen,toolbar', { 'from_settings' : true });
	if (winD.result && (/^(on)|(off2)$/.test(winD.result))) {
		document.getElementById('pref_advertisement').value = winD.result;
		s3torrent.advertisement_status();
	}
}
//------------------------------------------------------------------------------
s3torrent.advertisement_status = function() {
	if (document.getElementById('pref_advertisement').value == 'on') {
		document.getElementById('adv_is_enabled').hidden = false;
		document.getElementById('adv_customization').hidden = false;
		document.getElementById('adv_is_disabled').hidden = true;
	} else {
		document.getElementById('adv_is_enabled').hidden = true;
		document.getElementById('adv_customization').hidden = true;
		document.getElementById('adv_is_disabled').hidden = false;
	}
}
//------------------------------------------------------------------------------
