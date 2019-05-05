var s3torrent = {};
Components.utils.import("resource://s3torrent/utils.js", s3torrent);

//------------------------------------------------------------------------------
s3torrent.init = function() {
	var S3TorrentTornado_class = Components.classes["@s3torrent.com/tornado;1"];
	var S3TorrentTornado = S3TorrentTornado_class.getService().wrappedJSObject;
	S3TorrentTornado.init();
	s3torrent.torrent = S3TorrentTornado.torrent;

	var popup_menu = document.getElementById('s3torrent_main_button_menu').cloneNode(true);
	var popup_tools = document.getElementById('s3torrent_toolsmenu_popup');
	popup_menu.id = 's3torrent_toolsmenu_popup'
	popup_tools.parentNode.replaceChild(popup_menu, popup_tools);
	s3torrent.torrent.update_toolbar_text();
}
//------------------------------------------------------------------------------
s3torrent.button_toolbar_custom = function() {
	s3torrent.torrent.update_toolbar_text();
}
//------------------------------------------------------------------------------
s3torrent.drag_check = function(event) {
	if (event.dataTransfer.types.contains("text/uri-list") || event.dataTransfer.types.contains("application/x-moz-file")) {
		event.target.setAttribute('is_dragover', true);
		event.preventDefault();
	}
}
//------------------------------------------------------------------------------
s3torrent.drop_on = function(event) {
	var tFileURL = event.dataTransfer.getData("URL");
	if (tFileURL) {
		s3torrent.utils.add_new_torrent({ 'data' : tFileURL, 'is_url' : true, 'referrer_url' : '' });
	} else {
		var file = event.dataTransfer.mozGetDataAt("application/x-moz-file", 0);
		if (file instanceof Components.interfaces.nsIFile) {
			s3torrent.utils.add_new_torrent({ 'data' : file.path, 'is_file' : true });
		}
	}

	event.target.removeAttribute('is_dragover');
	event.preventDefault();
}
//------------------------------------------------------------------------------
s3torrent.drag_leave = function(event) {
	event.target.removeAttribute('is_dragover');
}
//------------------------------------------------------------------------------
s3torrent.open_download_window = function(event) {
	if (event && (event.button != 0)) {  // left click
		return false;
	}
	var tab_download = null;
	var tabs = (gBrowser.visibleTabs) ? gBrowser.visibleTabs : gBrowser.tabs;
	for (let tab of tabs) {
		if (tab.linkedBrowser.currentURI.spec == 'about:downloads-torrent') {
			tab_download = tab;
		}
	}
	if (tab_download == null) {
		if (gBrowser.selectedBrowser.currentURI.spec == "about:blank" && !gBrowser.selectedBrowser.webProgress.isLoadingDocument) {
			tab_download = gBrowser.selectedBrowser.loadURI('about:downloads-torrent');
		}
		else {
			tab_download = gBrowser.addTab('about:downloads-torrent');
		}
	}
	window.setTimeout(function(){
		gBrowser.selectedTab = tab_download;
	}, 100);
}
//------------------------------------------------------------------------------
s3torrent.open_options_window = function(event) {
	var winD = window.openDialog('chrome://s3torrent/content/settings.xul', 's3torrent_prefs', 'chrome,centerscreen,modal,toolbar');
	winD.focus();
}
//------------------------------------------------------------------------------
s3torrent.set_stop_all = function() {
	s3torrent.torrent.doCommand('all', 'cmd_stop_all');
}
//------------------------------------------------------------------------------
s3torrent.set_resume_all = function() {
	s3torrent.torrent.doCommand('all', 'cmd_start_all');
}
//------------------------------------------------------------------------------

window.addEventListener("load", s3torrent.init, false);
window.addEventListener("aftercustomization", s3torrent.button_toolbar_custom, false);
