var magdown = {};
magdown.metadata = null;
Components.utils.import("resource://magdown/utils.js", magdown);
Components.utils.import("resource://magdown/peer.js", magdown);

magdown.magnet = {};
magdown.onclose = false;
magdown.referrer_url = '';
magdown.torrent_url = '';
magdown.default_save_dir = '';

//------------------------------------------------------------------------------
magdown.dialog_init = function() {
	var S3TorrentTornado_class = Components.classes["@magdown.com/tornado;1"];
	var S3TorrentTornado = S3TorrentTornado_class.getService().wrappedJSObject;
	magdown.torrent = S3TorrentTornado.torrent;

	var innerWidth = magdown.utils.prefs.getIntPref('size_window_new_torrent_width');
	if (innerWidth > 0) {
		window.innerWidth = innerWidth;
	}
	var innerHeight = magdown.utils.prefs.getIntPref('size_window_new_torrent_height');
	if (innerHeight > 0) {
		window.innerHeight = innerHeight;
	}

	if (document.documentElement.getButton('extra1')) {
		document.documentElement.getButton('extra1').setAttribute('disabled', true);
	}
	if (document.documentElement.getButton('extra2')) {
		document.documentElement.getButton('extra2').setAttribute('disabled', true);
	}

	document.getElementById('magdown_add_new_url').focus();
	magdown.magnet_log_el = document.getElementById('magdown_add_new_magnet_log');
	var default_save_dir = magdown.utils.get_default_save_dir();
	if (default_save_dir) {
		magdown.default_save_dir = default_save_dir.path;
	}

	var params = (window.arguments && window.arguments[0]);
	if (params) {
		if (params.is_url) {
			document.getElementById('magdown_new_selector').value = 'url';
			document.getElementById('magdown_add_new_url').value = params.data;
			magdown.referrer_url = (params.referrer_url) ? params.referrer_url : '';
			magdown.step_1_next();
			return;
		} else if (params.is_file) {
			document.getElementById('magdown_new_selector').value = 'file';
			document.getElementById('magdown_add_new_file').value = params.data;
			document.getElementById('magdown_add_new_file_button').focus();
			magdown.step_1_next();
			return;
		}
	}
	magdown.step_1();
}
//------------------------------------------------------------------------------
magdown.step_1 = function(error) {
	magdown.magnet_log_el.hidden = true;
	magdown.magnet_log_el.value = '';

	magdown.metadata = null;
	if (error) {
		document.getElementById('magdown_step_1_next').setAttribute('is_error', true);
		try {
			alert(error);
		} catch(e) {
		}
	}
	document.getElementById('magdown_step_1_box').hidden = false;
	document.getElementById('magdown_step_2_box').hidden = true;
	document.getElementById('magdown_step_3_box').hidden = true;
	for (var el_id of ['magdown_new_selector', 'magdown_add_new_url', 'magdown_add_new_file_button', 'magdown_add_file_list_button', 'magdown_step_1_next']) {
		document.getElementById(el_id).disabled = false;
	}

	if (document.documentElement.getButton('extra1')) {
		document.documentElement.getButton('extra1').setAttribute('disabled', true);
	}
	if (document.documentElement.getButton('extra2')) {
		document.documentElement.getButton('extra2').setAttribute('disabled', true);
	}
}
//------------------------------------------------------------------------------
magdown.step_2 = function(error) {
	if (magdown.metadata == null) {
		magdown.step_1();
		return;
	}
	//-----------------------------------------------------------------------
	document.getElementById('magdown_step_1_box').hidden = true;
	document.getElementById('magdown_step_2_box').hidden = false;
	document.getElementById('magdown_step_2_prev').disabled = false;
	document.getElementById('magdown_step_2_next').disabled = (error) ? true : false;
	document.getElementById('magdown_step_3_box').hidden = true;
	if (document.documentElement.getButton('extra1')) {
		document.documentElement.getButton('extra1').setAttribute('disabled', (error) ? true : false);
	}
	if (document.documentElement.getButton('extra2')) {
		document.documentElement.getButton('extra2').setAttribute('disabled', (error) ? true : false);
	}
	//-----------------------------------------------------------------------
	var info_list = {
		'torrent_name' : magdown.metadata.info.name,
		'save_dir' : magdown.default_save_dir,
		'files_count' : magdown.metadata.file_list.length,
		'total_size' : magdown.utils.get_strings_to_KB_MB_GB(magdown.metadata.total_size) + ' (' + magdown.utils.numeral3(magdown.metadata.total_size) + ')',
		'hash' : magdown.metadata.hashhexlower,
		'publisher' : magdown.metadata.publisher || '',
		'publisher_url' : magdown.metadata['publisher-url'] || '',
		'created' : (new Date(magdown.metadata['creation date'] * 1000)).toLocaleString(),
		'comment' : magdown.metadata.comment || ''
	};

	//-----------------------------------------------------------------------
	for (var info_key in info_list) {
		var el = document.getElementById('magdown_info_' + info_key);
		el.setAttribute('label', info_list[info_key]);
	}
	if (error) {
		document.getElementById('magdown_step_2_next').setAttribute('is_error', true);
		alert(error);
	}
	else if (magdown.utils.prefs.getBoolPref('torrent.quickly_start_download')) {
		magdown.step_end();
	}
}
//------------------------------------------------------------------------------
magdown.step_3 = function() {
	if (magdown.metadata == null) {
		magdown.step_1();
		return;
	}
	//-----------------------------------------------------------------------
	document.getElementById('magdown_step_1_box').hidden = true;
	document.getElementById('magdown_step_2_box').hidden = true;
	document.getElementById('magdown_step_3_box').hidden = false;
	document.getElementById('magdown_step_3_prev').disabled = false;
	document.getElementById('magdown_step_3_next').disabled = false;

	//-----------------------------------------------------------------------
	var file_list = [].concat(magdown.metadata.file_list);
	var file_list_box = document.getElementById('magdown_step_3_file_list');
	//------------------------------------------------------------------------
	while(file_list_box.getRowCount() > 0) {
		file_list_box.removeItemAt(0);
	}

	//------------------------------------------------------------------------
	for (var file of file_list.sort( function(a,b) {
		var file_a = ['/'];
		var file_b = ['/'];
		file_a = file_a.concat(a.path);
		file_b = file_b.concat(b.path);

		var a1 = file_a.pop();
		var b1 = file_b.pop();
		if (file_a.join('') == file_b.join('')) {
			return a1 > b1;
		} else {
			return file_a.join('') > file_b.join('');
		}
	})) {
		var file_size = magdown.utils.get_strings_to_KB_MB_GB(file.length);
		var row = document.createElement('listitem');
		row.setAttribute('type', 'checkbox');
		row.addEventListener("command", magdown.select_file_list, false);
		row.file_id = file.file_id;
		row.file_length = file.length;

		var cell = document.createElement('listcell');
		cell.setAttribute('type', 'checkbox');
		cell.setAttribute("checked", true);

		cell.setAttribute('label', file.path.join('\\'));
		row.appendChild(cell);
		cell.className = 'listcell-iconic';
		cell.setAttribute('image', "moz-icon://" + file.path[file.path.length-1] + "?size=16");
	
		cell = document.createElement('listcell');
		cell.setAttribute('label', file_size);
		cell.style.textAlign = 'right';
		row.appendChild(cell);
	
		file_list_box.appendChild(row);
		row.checked = true;
	}
	magdown.select_file_list_check_total();
}
//------------------------------------------------------------------------------
magdown.step_1_next = function() {
	magdown.torrent_url = '';
	document.getElementById('magdown_step_1_next').removeAttribute('is_error');
	for (var el_id of ['magdown_new_selector', 'magdown_add_new_url', 'magdown_add_file_list_button', 'magdown_add_new_file_button', 'magdown_step_1_next']) {
		document.getElementById(el_id).disabled = true;
	}

	if (document.getElementById('magdown_new_selector').value == 'file') {
		var file_path = document.getElementById('magdown_add_new_file').value;
		if (file_path) {
			try {
				var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
				file.initWithPath(file_path);
				if (file.exists() && file.isFile()) {
					var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService)
					magdown.get_file(ioService.newFileURI(file).spec);
				} else {
					alert(magdown.utils.get_string("fileNotFound"));
					magdown.step_1();
				}
				return;
			} catch(e) {
			}
		}
	} else {
		var url = document.getElementById('magdown_add_new_url').value;
		if (/^(https?|ftps?)\:\/\/.+/i.test(url)) {
			magdown.torrent_url = url;
			magdown.get_file(url);
			return;
		} else if (/^magnet\:\?.+/.test(url)) {
			magdown.torrent_url = url;
			magdown.step_1_magnet(url);
			return;
		} else if ((url.length == 40) || (url.length == 32)) {
			url = 'magnet:?xt=urn:btih:' + url;
			magdown.step_1_magnet(url);
			return;
		}
	}
	magdown.step_1(magdown.utils.get_string("error.add_new_torrent.source"));
}
//------------------------------------------------------------------------------
magdown.step_1_magnet = function(url) {
	var params = magdown.utils.urlparse(url);
	if (params.xt && (/^urn\:btih\:.{32,40}$/.test(params.xt[0]))) {
		magdown.magnet.init(url, params);
	} else {
		alert(magdown.utils.get_string("error.add_new_torrent.source"));
		magdown.step_1();
	}
}
//------------------------------------------------------------------------------
magdown.step_2_next = function() {
	document.getElementById('magdown_step_2_prev').disabled = true;
	document.getElementById('magdown_step_2_next').disabled = true;
	document.getElementById('magdown_step_2_next').removeAttribute('is_error');
	magdown.step_3();
}
//------------------------------------------------------------------------------
magdown.step_3_next = function() {
	if ((magdown.default_save_dir != '') && (magdown.utils.confirm(magdown.utils.get_string("saveDir") + "\n" + magdown.default_save_dir, '', window))) {
		magdown.step_end();
	} else {
		if (magdown.select_dir()) {
			magdown.step_3_next();
		} else {
			magdown.step_3();
		}
	}
}
//------------------------------------------------------------------------------
magdown.select_dir_click = function() {
	if (magdown.select_dir()) {
		if (document.getElementById('magdown_info_save_dir')) {
			document.getElementById('magdown_info_save_dir').setAttribute('label', magdown.default_save_dir);
		}
	}
}
//------------------------------------------------------------------------------
magdown.select_dir = function() {
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fp.init(window, '', Components.interfaces.nsIFilePicker.modeGetFolder);
	var localFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	try {
		localFile.initWithPath(magdown.default_save_dir);
	} catch(e) {
		localFile = false;
	}
	if (localFile) {
		fp.displayDirectory = localFile;
	} 
	
	var result = fp.show();
	if (result == fp.returnOK) {
		magdown.default_save_dir = fp.file.path;
		return true;
	} else {
		return false;
	}
}
//------------------------------------------------------------------------------
magdown.step_end = function(is_later) {
	if (magdown.default_save_dir != '') {
		magdown.utils.set_default_save_dir(magdown.default_save_dir);
		magdown.metadata.save_dir = magdown.default_save_dir;
		magdown.metadata.referrer_url = magdown.referrer_url;
		magdown.metadata.torrent_url = magdown.torrent_url;

		document.getElementById('magdown_step_3_prev').disabled = true;
		document.getElementById('magdown_step_3_next').disabled = true;
		document.getElementById('magdown_step_3_next').removeAttribute('is_error');
		magdown.torrent.add_new(magdown.metadata, is_later);
		window.close();
	} else {
		magdown.step_3_next();
	}
}
//------------------------------------------------------------------------------
magdown.open_file = function() {
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fp.init(window, this.message, Components.interfaces.nsIFilePicker.modeOpen);
	fp.appendFilter("*.torrent", "*.torrent");
	var result = fp.show();
	if (result == fp.returnOK) {
		magdown.referrer_url = '';
		document.getElementById('magdown_add_new_file').value = fp.file.path;
		document.getElementById('magdown_new_selector').value = 'file';
		magdown.step_1_next();
	}
}
//------------------------------------------------------------------------------
magdown.open_file_list = function() {
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fp.init(window, this.message, Components.interfaces.nsIFilePicker.modeOpenMultiple);
	fp.appendFilter("*.torrent", "*.torrent");
	var result = fp.show();
	if (result == fp.returnOK) {
		magdown.referrer_url = '';
		var files = [];
		var fp_files = fp.files;
		while (fp_files.hasMoreElements()) {
			var file = fp_files.getNext().QueryInterface(Components.interfaces.nsILocalFile).path;
			files.push(file);
		}
		document.getElementById('magdown_new_selector').value = 'file';
		if (files.length == 1) {
			document.getElementById('magdown_add_new_file').value = files[0];
			magdown.step_1_next();
		} else if (files.length > 0) {
			magdown.open_file_list_step_1(files);
		}
	}
}
//------------------------------------------------------------------------------
magdown.get_file = function(tFileURL, is_post) {
	var xhr = new XMLHttpRequest();
	xhr.mozBackgroundRequest = true;

	var sendData = null;

	if (is_post) {
        	xhr.open("POST", tFileURL, true);
		sendData = tFileURL.replace(/^.*\?(.*)$/, "$1");
		xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	}
	else {
		xhr.open("GET", tFileURL, true);
	        xhr.setRequestHeader("Referer", magdown.referrer_url);
	}
	xhr.timeout = 10000;
	if (xhr.channel) {
		xhr.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
	}
	xhr.responseType = "arraybuffer";
	xhr.onload = function() {
		magdown.metadata = magdown.torrent.get_metadata_buffer(this.response);
		if (magdown.metadata && magdown.metadata.announce_list && magdown.metadata.info) {
			magdown.step_2(magdown.metadata.error);
		} else if (is_post) {
			magdown.step_1(magdown.metadata.error);
		} else {
			magdown.get_file(tFileURL, true);
		}
	}
	xhr.ontimeout = function() {
		magdown.step_1("Timeout");
	}
	xhr.onerror = function() {
		magdown.step_1("HTTP error");
	}
	xhr.send(sendData);
}
//-------------------------------------------------------------------------------------------
magdown.check_enter = function(event) {
	magdown.referrer_url = '';
	document.getElementById('magdown_new_selector').value = 'url';
	if (event.keyCode && (event.keyCode == 13)) {
		event.stopPropagation();
		event.preventDefault();
		if (! document.getElementById('magdown_step_1_next').disabled) {
			magdown.step_1_next();
		}
	}
}
//-------------------------------------------------------------------------------------------
magdown.ondialogcancel = function() {
	magdown.onclose = true;
}
//-------------------------------------------------------------------------------------------
magdown.onresize = function() {
	magdown.utils.prefs.setIntPref('size_window_new_torrent_width', window.innerWidth);
	magdown.utils.prefs.setIntPref('size_window_new_torrent_height', window.innerHeight);
}
//-------------------------------------------------------------------------------------------
magdown.magnet_log = function(text) {
	magdown.magnet_log_el.value += text + "\n";
	var pos = magdown.magnet_log_el.value.length;
	magdown.magnet_log_el.selectionStart = pos;
	magdown.magnet_log_el.selectionEnd = pos;
}
//-------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------
magdown.magnet.init = function(publisher_url, params) {
	magdown.magnet_log_el.hidden = false;
	magdown.magnet_log_el.value = '';

	var hash = params.xt[0].replace(/^urn\:btih\:/, '').toLowerCase();
	if (hash.length == 32) {
		hash = magdown.utils.base32tohex(hash);
	}
	var announce_url = [];
	if (params.tr) {
		announce_url = announce_url.concat(params.tr);
	}
	for (var key in params) {
		if (/^tr\.\d+$/.test(key)) {
			announce_url = announce_url.concat(params[key]);
		}
	}

	announce_url = announce_url.concat(magdown.torrent.protocol.public_trackers);

	var torrent = {
		'tracker_length' : announce_url.length,
		'is_done' : false,
		'peer' : {},
		'peer_list' : [],
		'peer_work_list' : {},
		'peer_exist_list' : {}
	};
	torrent.metadata = {
		'downloaded' : 0,
		'uploaded': 0,
		'total_size' : 0,
		'hashhexlower' : hash,
		'hashbytes' : [],
		'piece_count' : 0,
		'announce_url' : announce_url,
		'publisher_url' : publisher_url
	};
	for (var i=0; i<20; i++) {
		torrent.metadata.hashbytes.push(parseInt(torrent.metadata.hashhexlower.slice(i*2, i*2 + 2), 16))
	}
	for (var url of announce_url) {
		magdown.magnet_log('tracker: ' + url + ' - init');
		var tracker = magdown.torrent.init_tracker_run(torrent, url);
		tracker.announce('stopped', magdown.magnet.tracker_start);
	}
}
//-------------------------------------------------------------------------------------------
magdown.magnet.tracker_start = function(is_ok, tracker, torrent) {
	tracker.announce('started', magdown.magnet.tracker_end);
}
//-------------------------------------------------------------------------------------------
magdown.magnet.tracker_end = function(is_ok, tracker, torrent) {
	if (is_ok && tracker.peer_list.length == 0) {
		is_ok = false;
	}
	//------------------------------------------------------------------------------
	if (torrent.is_done) {
		is_ok = false;
	}
	//------------------------------------------------------------------------------
	torrent.tracker_length--;
	//------------------------------------------------------------------------------
	if (is_ok) {
		magdown.magnet_log('tracker: ' + tracker.url + ' - added peer-list: ' + tracker.peer_list.length);

		var go_peer = true;
		for (var peer_key in torrent.peer) {
			if (torrent.peer_exist_list[peer_key]) {
				delete torrent.peer[peer_key];
			}
		}
		for (var peer_data of tracker.peer_list) {
			if (! torrent.peer_exist_list[peer_data.ip + ':' + peer_data.port]) {
				torrent.peer_list.push(peer_data);
			}
		}

		var peer_count = 0;
		while (go_peer) {
			magdown.magnet.get_peer(torrent);
			if ((peer_count >= magdown.torrent.protocol.peer_max_count) || (Object.keys(torrent.peer_work_list).length >= magdown.torrent.protocol.peer_max_count)) {
				go_peer = false;
			}
			peer_count++;
		}
	}
	//------------------------------------------------------------------------------
	magdown.magnet_log('tracker: ' + tracker.url + ' - close');
	magdown.magnet.check_stop_error(torrent);
}
//-------------------------------------------------------------------------------------------
magdown.magnet.get_peer = function(torrent) {
	var peer_data = null;
	while (peer_data = torrent.peer_list.shift()) {
		var peer_key = peer_data.ip + ':' + peer_data.port;
		if (torrent.peer_work_list[peer_key]) {
			continue;
		}
		var peer = new magdown.Peer( torrent, peer_key, magdown.torrent.protocol );
		torrent.peer[peer_key] = peer;
		peer.is_get_magnet = true;
		peer.peer_timeout_count = 10000;
		peer.handshake(peer_data.ip, peer_data.port, magdown.magnet.peer_connect_end);
		torrent.peer_work_list[peer_key] = true;

		magdown.magnet_log(torrent.peer_list.length + '.peer: ' + peer_key + ' - init');
		break;
	}
	//------------------------------------------------------------------------------
	magdown.magnet.check_stop_error(torrent);
}
//-------------------------------------------------------------------------------------------
magdown.magnet.check_stop_error = function(torrent) {
	if (magdown.onclose) {
		torrent.is_done = true;
		magdown.magnet.stop_peers(torrent);
	}
	//------------------------------------------------------------------------------
	if ((torrent.tracker_length <= 0) && (torrent.peer_list.length == 0) && (Object.keys(torrent.peer_work_list).length == 0)) {
		if (! torrent.is_done) {
			magdown.step_1(magdown.utils.get_string('error.torrent_not_found'));
		}
	}
}
//-------------------------------------------------------------------------------------------
magdown.magnet.stop_peers = function(torrent) {
	for(var peer_key in torrent.peer) {
		torrent.peer[peer_key].socket_close(false);
	}
}
//-------------------------------------------------------------------------------------------
magdown.magnet.peer_connect_end= function(is_ok, peer, torrent, peer_data_new) {
	//------------------------------------------------------------------------------
	if (is_ok) {
		if (peer_data_new) {
			if (! torrent.peer_exist_list[peer_data_new.ip + ':' + peer_data_new.port]) {
				torrent.peer_list.unshift(peer_data_new);
			}
			return;
		}
		else if (! torrent.is_done) {
			if (torrent.metadata.info) {
				torrent.is_done = true;
				magdown.magnet_log(torrent.peer_list.length + '.peer: ' + peer.peer_key + ' - Metadata is received successfully!');
				magdown.magnet.stop_peers(torrent);
				magdown.metadata = magdown.torrent.get_metadata_magnet(torrent.metadata, torrent.metadata.info);
				magdown.step_2(magdown.metadata.error);
			}
		}
	}
	//------------------------------------------------------------------------------
	else {
		if (! torrent.is_done) {
			if (Object.keys(torrent.peer_work_list).length < magdown.torrent.protocol.peer_max_count) {
				magdown.magnet.get_peer(torrent);
			}
		}
	}
	//------------------------------------------------------------------------------
	magdown.magnet_log(torrent.peer_list.length + '.peer: ' + peer.peer_key + ' - close');

	delete torrent.peer_work_list[peer.peer_key];
	torrent.peer[peer.peer_key] = null;
	delete torrent.peer[peer.peer_key];
	//------------------------------------------------------------------------------
	magdown.magnet.check_stop_error(torrent);
}
//------------------------------------------------------------------------------
magdown.open_file_list_step_1 = function(files) {
	if ((magdown.default_save_dir != '') && (magdown.utils.confirm(magdown.utils.get_string("saveDir") + "\n" + magdown.default_save_dir, '', window))) {
		magdown.open_file_list_step_2(files);
	} else {
		if (magdown.select_dir()) {
			magdown.open_file_list_step_1(files);
		} else {
			magdown.step_1();
		}
	}
}
//------------------------------------------------------------------------------
magdown.open_file_list_step_2 = function(files) {
	var winD = window.openDialog('chrome://magdown/content/confirm_start.xul', 'magdown_confirm_start', 'chrome,modal,centerscreen');
	var is_start = false;
	if (winD.return_result == 0) {
		return;
	}
	else if (winD.return_result == 1) {
		is_start = true;
	}
	magdown.open_file_list_step_3(files, is_start);
}
//------------------------------------------------------------------------------
magdown.open_file_list_step_3 = function(files, is_start) {
	magdown.utils.set_default_save_dir(magdown.default_save_dir);
	for (var file_path of files) {
		if (file_path) {
			try {
				var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
				file.initWithPath(file_path);
				if (file.exists() && file.isFile()) {
					var fileInputStream = Components.classes['@mozilla.org/network/file-input-stream;1'].createInstance(Components.interfaces.nsIFileInputStream);
					var binaryInputStream = Components.classes['@mozilla.org/binaryinputstream;1'].createInstance(Components.interfaces.nsIBinaryInputStream);
					fileInputStream.init(file, 1, 0, 0);
					binaryInputStream.setInputStream(fileInputStream);
					var file_data = [];

					var size = 0;
					while(size = binaryInputStream.available()) {
						file_data = file_data.concat(binaryInputStream.readByteArray(size));
					}

					binaryInputStream.close();
				        fileInputStream.close();

					magdown.metadata = magdown.torrent.get_metadata_buffer(file_data);
					if (magdown.metadata && magdown.metadata.announce_list && magdown.metadata.info) {
						if (magdown.metadata.error) {
							var name = file_path;
							if (magdown.metadata && magdown.metadata.info && magdown.metadata.info.name) {
								name = magdown.metadata.info.name;
							}
							magdown.utils.notification_box(name, magdown.metadata.error);
						} else {
							magdown.metadata.save_dir = magdown.default_save_dir;
							magdown.metadata.referrer_url = '';
							magdown.metadata.torrent_url = '';
							magdown.torrent.add_new(magdown.metadata, ! is_start);
						}
					}
				}
			} catch(e) {
			}
		}
	}
	window.close();
}
//-------------------------------------------------------------------------------------------
magdown.select_file_list = function(e) {
	e.target.firstChild.setAttribute("checked", e.target.checked);
	e.target.firstChild.disabled = ! e.target.checked;
	e.target.firstChild.nextSibling.disabled = ! e.target.checked;

	magdown.metadata.file_list[e.target.file_id].status = (e.target.checked) ? 'process' : 'skip';
	if (! e.is_all) {
		magdown.select_file_list_check_total();
	}
}
//-------------------------------------------------------------------------------------------
magdown.select_file_list_all = function(checked) {
	var file_list_box = document.getElementById('magdown_step_3_file_list');
	
	for (var i=0; i<file_list_box.itemCount; i++) {
		var e = { 'target' : file_list_box.getItemAtIndex( i ), 'is_all' :  true };
		e.target.checked = checked;
		magdown.select_file_list(e);
	}

	magdown.select_file_list_check_total();
}
//-------------------------------------------------------------------------------------------
magdown.select_file_list_check_total = function() {
	var file_list_box = document.getElementById('magdown_step_3_file_list');
	var total = 0;
	var file_count = 0;

	for (var i=0; i<file_list_box.itemCount; i++) {
		var el = file_list_box.getItemAtIndex( i );
		if (el.checked) {
			total += el.file_length;
			file_count += 1;
		}
	}
	document.getElementById('magdown_step_3_file_list_total_size').value = file_count + ' / ' + magdown.utils.get_strings_to_KB_MB_GB(total);
}
//-------------------------------------------------------------------------------------------
