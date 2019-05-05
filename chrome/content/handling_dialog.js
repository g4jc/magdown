var s3torrent = {};
Components.utils.import("resource://s3torrent/utils.js", s3torrent);

//------------------------------------------------------------------------------
s3torrent.init = function() {
	if (dialog && dialog.onAccept && dialog._URI) {
		var url = dialog._URI.spec;
		if (/urn\:btih\:[\w\d]{32}/.test(url)) {
			s3torrent.init_run();
		}
	}
}
//------------------------------------------------------------------------------
s3torrent.init_run = function() {
	dialog.onAccept_tmp = dialog.onAccept;
	dialog.onAccept = s3torrent.onAccept;

	var items = document.getElementById("items");
	var elm = document.createElement("richlistitem");
	elm.setAttribute("type", "handler");
	elm.setAttribute("name", s3torrent.utils.get_string('extensions.s3torrent@tornado.name'));
	elm.setAttribute("image", 'chrome://s3torrent/skin/s3torrent32.png');
	elm.id = 's3torrent';
	items.insertBefore(elm, items.firstChild);
	items.selectedItem = elm;

	if (document.getElementById("remember")) {
		document.getElementById("remember").style.display = 'none';
	}
}
//------------------------------------------------------------------------------
s3torrent.onAccept = function() {
	var elm = document.getElementById("items").selectedItem;
	if (elm.id == 's3torrent') {
		s3torrent.utils.add_new_torrent({ 'data' : dialog._URI.spec, 'is_url' : true, 'referrer_url' : '' });
		return true;
	} else {
		return dialog.onAccept_tmp();
	}
}
//-------------------------------------------------------------------------------------------
window.addEventListener("load", s3torrent.init, false);
