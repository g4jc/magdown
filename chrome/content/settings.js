var magdown = {};
Components.utils.import("resource://magdown/utils.js", magdown);

//------------------------------------------------------------------------------
magdown.init = function() {
	//------------------------------------------------------------------------
	var date = new Date();
	var dbelems = document.getElementById("dateTimeFormatDL");
	for (var i=0; i<dbelems.itemCount; i++) {
		var item = dbelems.getItemAtIndex(i);
		item.setAttribute('label', date.toLocaleFormat(item.value));
	}
}
//------------------------------------------------------------------------------
magdown.select_dir = function() {
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fp.init(window, '', Components.interfaces.nsIFilePicker.modeGetFolder);

	try {
		fp.displayDirectory = magdown.utils.get_default_save_dir();
	} catch(e) {
	}

	var result = fp.show();
	if (result == fp.returnOK) {
		document.getElementById('default_save_dir').value = fp.file.path;
		document.getElementById('pref_default_save_dir').value = fp.file.path;
	}
}
//------------------------------------------------------------------------------
magdown.reset_dir = function() {
	document.getElementById('default_save_dir').value = '';
	document.getElementById('pref_default_save_dir').value = '';
}
//------------------------------------------------------------------------------
