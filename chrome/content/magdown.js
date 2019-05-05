var magdown = {};
Components.utils.import("resource://magdown/utils.js", magdown);

//------------------------------------------------------------------------------
magdown.init = function() {
	var S3TorrentTornado_class = Components.classes["@magdown.com/tornado;1"];
	var S3TorrentTornado = S3TorrentTornado_class.getService().wrappedJSObject;
	S3TorrentTornado.init();
	magdown.torrent = S3TorrentTornado.torrent;

	var popup_menu = document.getElementById('magdown_main_button_menu').cloneNode(true);
	var popup_tools = document.getElementById('magdown_toolsmenu_popup');
	popup_menu.id = 'magdown_toolsmenu_popup'
	popup_tools.parentNode.replaceChild(popup_menu, popup_tools);
	magdown.torrent.update_toolbar_text();
}
//------------------------------------------------------------------------------
magdown.button_toolbar_custom = function() {
	magdown.torrent.update_toolbar_text();
}
//------------------------------------------------------------------------------
magdown.drag_check = function(event) {
	if (event.dataTransfer.types.contains("text/uri-list") || event.dataTransfer.types.contains("application/x-moz-file")) {
		event.target.setAttribute('is_dragover', true);
		event.preventDefault();
	}
}
//------------------------------------------------------------------------------
magdown.drop_on = function(event) {
	var tFileURL = event.dataTransfer.getData("URL");
	if (tFileURL) {
		magdown.utils.add_new_torrent({ 'data' : tFileURL, 'is_url' : true, 'referrer_url' : '' });
	} else {
		var file = event.dataTransfer.mozGetDataAt("application/x-moz-file", 0);
		if (file instanceof Components.interfaces.nsIFile) {
			magdown.utils.add_new_torrent({ 'data' : file.path, 'is_file' : true });
		}
	}

	event.target.removeAttribute('is_dragover');
	event.preventDefault();
}
//------------------------------------------------------------------------------
magdown.drag_leave = function(event) {
	event.target.removeAttribute('is_dragover');
}
//------------------------------------------------------------------------------
magdown.open_download_window = function(event) {
	if (event && (event.button != 0)) {  // left click
		return false;
	}
	var tab_download = null;
	var tabs = (gBrowser.visibleTabs) ? gBrowser.visibleTabs : gBrowser.tabs;
	for (let tab of tabs) {
		if (tab.linkedBrowser.currentURI.spec == 'chrome://magdown/content/downloads_library.xul') {
			tab_download = tab;
		}
	}
	if (tab_download == null) {
		if (gBrowser.selectedBrowser.currentURI.spec == "about:blank" && !gBrowser.selectedBrowser.webProgress.isLoadingDocument) {
			tab_download = gBrowser.selectedBrowser.loadURI('chrome://magdown/content/downloads_library.xul');
		}
		else {
			tab_download = gBrowser.addTab('chrome://magdown/content/downloads_library.xul');
		}
	}
	window.setTimeout(function(){
		gBrowser.selectedTab = tab_download;
	}, 100);
}
//------------------------------------------------------------------------------
magdown.open_options_window = function(event) {
	var winD = window.openDialog('chrome://magdown/content/settings.xul', 'magdown_prefs', 'chrome,centerscreen,modal,toolbar');
	winD.focus();
}
//------------------------------------------------------------------------------
magdown.set_stop_all = function() {
	magdown.torrent.doCommand('all', 'cmd_stop_all');
}
//------------------------------------------------------------------------------
magdown.set_resume_all = function() {
	magdown.torrent.doCommand('all', 'cmd_start_all');
}
//------------------------------------------------------------------------------

window.addEventListener("load", magdown.init, false);
window.addEventListener("aftercustomization", magdown.button_toolbar_custom, false);
