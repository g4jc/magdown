var magdown = {};
Components.utils.import("resource://magdown/utils.js", magdown);

//------------------------------------------------------------------------------
magdown.init = function() {
	if (dialog && dialog.onAccept && dialog._URI) {
		var url = dialog._URI.spec;
		if (/urn\:btih\:[\w\d]{32}/.test(url)) {
			magdown.init_run();
		}
	}
}
//------------------------------------------------------------------------------
magdown.init_run = function() {
	dialog.onAccept_tmp = dialog.onAccept;
	dialog.onAccept = magdown.onAccept;

	var items = document.getElementById("items");
	var elm = document.createElement("richlistitem");
	elm.setAttribute("type", "handler");
	elm.setAttribute("name", magdown.utils.get_string('extensions.magdown@tornado.name'));
	elm.setAttribute("image", 'chrome://magdown/skin/magdown32.png');
	elm.id = 'magdown';
	items.insertBefore(elm, items.firstChild);
	items.selectedItem = elm;

	if (document.getElementById("remember")) {
		document.getElementById("remember").style.display = 'none';
	}
}
//------------------------------------------------------------------------------
magdown.onAccept = function() {
	var elm = document.getElementById("items").selectedItem;
	if (elm.id == 'magdown') {
		magdown.utils.add_new_torrent({ 'data' : dialog._URI.spec, 'is_url' : true, 'referrer_url' : '' });
		return true;
	} else {
		return dialog.onAccept_tmp();
	}
}
//-------------------------------------------------------------------------------------------
window.addEventListener("load", magdown.init, false);
