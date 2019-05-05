var s3torrent = {};
s3torrent.metadata = null;
Components.utils.import("resource://s3torrent/utils.js", s3torrent);
Components.utils.import("resource://s3torrent/peer.js", s3torrent);

s3torrent.magnet = {};
s3torrent.onclose = false;
s3torrent.referrer_url = '';
s3torrent.torrent_url = '';
s3torrent.default_save_dir = '';

//------------------------------------------------------------------------------
s3torrent.dialog_init = function() {
	var S3TorrentTornado_class = Components.classes["@s3torrent.com/tornado;1"];
	var S3TorrentTornado = S3TorrentTornado_class.getService().wrappedJSObject;
	s3torrent.torrent = S3TorrentTornado.torrent;

	var innerWidth = s3torrent.utils.prefs.getIntPref('size_window_new_torrent_width');
	if (innerWidth > 0) {
		window.innerWidth = innerWidth;
	}
	var innerHeight = s3torrent.utils.prefs.getIntPref('size_window_new_torrent_height');
	if (innerHeight > 0) {
		window.innerHeight = innerHeight;
	}

	if (document.documentElement.getButton('extra1')) {
		document.documentElement.getButton('extra1').setAttribute('disabled', true);
	}
	if (document.documentElement.getButton('extra2')) {
		document.documentElement.getButton('extra2').setAttribute('disabled', true);
	}

	document.getElementById('s3torrent_add_new_url').focus();
	s3torrent.magnet_log_el = document.getElementById('s3torrent_add_new_magnet_log');
	var default_save_dir = s3torrent.utils.get_default_save_dir();
	if (default_save_dir) {
		s3torrent.default_save_dir = default_save_dir.path;
	}

	var params = (window.arguments && window.arguments[0]);
	if (params) {
		if (params.is_url) {
			document.getElementById('s3torrent_new_selector').value = 'url';
			document.getElementById('s3torrent_add_new_url').value = params.data;
			s3torrent.referrer_url = (params.referrer_url) ? params.referrer_url : '';
			s3torrent.step_1_next();
			return;
		} else if (params.is_file) {
			document.getElementById('s3torrent_new_selector').value = 'file';
			document.getElementById('s3torrent_add_new_file').value = params.data;
			document.getElementById('s3torrent_add_new_file_button').focus();
			s3torrent.step_1_next();
			return;
		}
	}
	s3torrent.step_1();
}
//------------------------------------------------------------------------------
s3torrent.step_1 = function(error) {
	s3torrent.magnet_log_el.hidden = true;
	s3torrent.magnet_log_el.value = '';

	s3torrent.metadata = null;
	if (error) {
		document.getElementById('s3torrent_step_1_next').setAttribute('is_error', true);
		try {
			alert(error);
		} catch(e) {
		}
	}
	document.getElementById('s3torrent_step_1_box').hidden = false;
	document.getElementById('s3torrent_step_2_box').hidden = true;
	document.getElementById('s3torrent_step_3_box').hidden = true;
	for (var el_id of ['s3torrent_new_selector', 's3torrent_add_new_url', 's3torrent_add_new_file_button', 's3torrent_add_file_list_button', 's3torrent_step_1_next']) {
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
s3torrent.step_2 = function(error) {
	if (s3torrent.metadata == null) {
		s3torrent.step_1();
		return;
	}
	//-----------------------------------------------------------------------
	document.getElementById('s3torrent_step_1_box').hidden = true;
	document.getElementById('s3torrent_step_2_box').hidden = false;
	document.getElementById('s3torrent_step_2_prev').disabled = false;
	document.getElementById('s3torrent_step_2_next').disabled = (error) ? true : false;
	document.getElementById('s3torrent_step_3_box').hidden = true;
	if (document.documentElement.getButton('extra1')) {
		document.documentElement.getButton('extra1').setAttribute('disabled', (error) ? true : false);
	}
	if (document.documentElement.getButton('extra2')) {
		document.documentElement.getButton('extra2').setAttribute('disabled', (error) ? true : false);
	}
	//-----------------------------------------------------------------------
	var info_list = {
		'torrent_name' : s3torrent.metadata.info.name,
		'save_dir' : s3torrent.default_save_dir,
		'files_count' : s3torrent.metadata.file_list.length,
		'total_size' : s3torrent.utils.get_strings_to_KB_MB_GB(s3torrent.metadata.total_size) + ' (' + s3torrent.utils.numeral3(s3torrent.metadata.total_size) + ')',
		'hash' : s3torrent.metadata.hashhexlower,
		'publisher' : s3torrent.metadata.publisher || '',
		'publisher_url' : s3torrent.metadata['publisher-url'] || '',
		'created' : (new Date(s3torrent.metadata['creation date'] * 1000)).toLocaleString(),
		'comment' : s3torrent.metadata.comment || ''
	};

	//-----------------------------------------------------------------------
	for (var info_key in info_list) {
		var el = document.getElementById('s3torrent_info_' + info_key);
		el.setAttribute('label', info_list[info_key]);
	}
	if (error) {
		document.getElementById('s3torrent_step_2_next').setAttribute('is_error', true);
		alert(error);
	}
	else if (s3torrent.utils.prefs.getBoolPref('torrent.quickly_start_download')) {
		s3torrent.step_end();
	}
}
//------------------------------------------------------------------------------
s3torrent.step_3 = function() {
	if (s3torrent.metadata == null) {
		s3torrent.step_1();
		return;
	}
	//-----------------------------------------------------------------------
	document.getElementById('s3torrent_step_1_box').hidden = true;
	document.getElementById('s3torrent_step_2_box').hidden = true;
	document.getElementById('s3torrent_step_3_box').hidden = false;
	document.getElementById('s3torrent_step_3_prev').disabled = false;
	document.getElementById('s3torrent_step_3_next').disabled = false;

	//-----------------------------------------------------------------------
	var file_list = [].concat(s3torrent.metadata.file_list);
	var file_list_box = document.getElementById('s3torrent_step_3_file_list');
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
		var file_size = s3torrent.utils.get_strings_to_KB_MB_GB(file.length);
		var row = document.createElement('listitem');
		row.setAttribute('type', 'checkbox');
		row.addEventListener("command", s3torrent.select_file_list, false);
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
	s3torrent.select_file_list_check_total();
}
//------------------------------------------------------------------------------
s3torrent.step_1_next = function() {
	s3torrent.torrent_url = '';
	document.getElementById('s3torrent_step_1_next').removeAttribute('is_error');
	for (var el_id of ['s3torrent_new_selector', 's3torrent_add_new_url', 's3torrent_add_file_list_button', 's3torrent_add_new_file_button', 's3torrent_step_1_next']) {
		document.getElementById(el_id).disabled = true;
	}

	if (document.getElementById('s3torrent_new_selector').value == 'file') {
		var file_path = document.getElementById('s3torrent_add_new_file').value;
		if (file_path) {
			try {
				var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
				file.initWithPath(file_path);
				if (file.exists() && file.isFile()) {
					var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService)
					s3torrent.get_file(ioService.newFileURI(file).spec);
				} else {
					alert(s3torrent.utils.get_string("fileNotFound"));
					s3torrent.step_1();
				}
				return;
			} catch(e) {
			}
		}
	} else {
		var url = document.getElementById('s3torrent_add_new_url').value;
		if (/^(https?|ftps?)\:\/\/.+/i.test(url)) {
			s3torrent.torrent_url = url;
			s3torrent.get_file(url);
			return;
		} else if (/^magnet\:\?.+/.test(url)) {
			s3torrent.torrent_url = url;
			s3torrent.step_1_magnet(url);
			return;
		} else if ((url.length == 40) || (url.length == 32)) {
			url = 'magnet:?xt=urn:btih:' + url;
			s3torrent.step_1_magnet(url);
			return;
		}
	}
	s3torrent.step_1(s3torrent.utils.get_string("error.add_new_torrent.source"));
}
//------------------------------------------------------------------------------
s3torrent.step_1_magnet = function(url) {
	var params = s3torrent.utils.urlparse(url);
	if (params.xt && (/^urn\:btih\:.{32,40}$/.test(params.xt[0]))) {
		s3torrent.magnet.init(url, params);
	} else {
		alert(s3torrent.utils.get_string("error.add_new_torrent.source"));
		s3torrent.step_1();
	}
}
//------------------------------------------------------------------------------
s3torrent.step_2_next = function() {
	document.getElementById('s3torrent_step_2_prev').disabled = true;
	document.getElementById('s3torrent_step_2_next').disabled = true;
	document.getElementById('s3torrent_step_2_next').removeAttribute('is_error');
	s3torrent.step_3();
}
//------------------------------------------------------------------------------
s3torrent.step_3_next = function() {
	if ((s3torrent.default_save_dir != '') && (s3torrent.utils.confirm(s3torrent.utils.get_string("saveDir") + "\n" + s3torrent.default_save_dir, '', window))) {
		s3torrent.step_end();
	} else {
		if (s3torrent.select_dir()) {
			s3torrent.step_3_next();
		} else {
			s3torrent.step_3();
		}
	}
}
//------------------------------------------------------------------------------
s3torrent.select_dir_click = function() {
	if (s3torrent.select_dir()) {
		if (document.getElementById('s3torrent_info_save_dir')) {
			document.getElementById('s3torrent_info_save_dir').setAttribute('label', s3torrent.default_save_dir);
		}
	}
}
//------------------------------------------------------------------------------
s3torrent.select_dir = function() {
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fp.init(window, '', Components.interfaces.nsIFilePicker.modeGetFolder);
	var localFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	try {
		localFile.initWithPath(s3torrent.default_save_dir);
	} catch(e) {
		localFile = false;
	}
	if (localFile) {
		fp.displayDirectory = localFile;
	} 
	
	var result = fp.show();
	if (result == fp.returnOK) {
		s3torrent.default_save_dir = fp.file.path;
		return true;
	} else {
		return false;
	}
}
//------------------------------------------------------------------------------
s3torrent.step_end = function(is_later) {
	if (s3torrent.default_save_dir != '') {
		s3torrent.utils.set_default_save_dir(s3torrent.default_save_dir);
		s3torrent.metadata.save_dir = s3torrent.default_save_dir;
		s3torrent.metadata.referrer_url = s3torrent.referrer_url;
		s3torrent.metadata.torrent_url = s3torrent.torrent_url;

		document.getElementById('s3torrent_step_3_prev').disabled = true;
		document.getElementById('s3torrent_step_3_next').disabled = true;
		document.getElementById('s3torrent_step_3_next').removeAttribute('is_error');
		s3torrent.torrent.add_new(s3torrent.metadata, is_later);
		window.close();
	} else {
		s3torrent.step_3_next();
	}
}
//------------------------------------------------------------------------------
s3torrent.open_file = function() {
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fp.init(window, this.message, Components.interfaces.nsIFilePicker.modeOpen);
	fp.appendFilter("*.torrent", "*.torrent");
	var result = fp.show();
	if (result == fp.returnOK) {
		s3torrent.referrer_url = '';
		document.getElementById('s3torrent_add_new_file').value = fp.file.path;
		document.getElementById('s3torrent_new_selector').value = 'file';
		s3torrent.step_1_next();
	}
}
//------------------------------------------------------------------------------
s3torrent.open_file_list = function() {
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fp.init(window, this.message, Components.interfaces.nsIFilePicker.modeOpenMultiple);
	fp.appendFilter("*.torrent", "*.torrent");
	var result = fp.show();
	if (result == fp.returnOK) {
		s3torrent.referrer_url = '';
		var files = [];
		var fp_files = fp.files;
		while (fp_files.hasMoreElements()) {
			var file = fp_files.getNext().QueryInterface(Components.interfaces.nsILocalFile).path;
			files.push(file);
		}
		document.getElementById('s3torrent_new_selector').value = 'file';
		if (files.length == 1) {
			document.getElementById('s3torrent_add_new_file').value = files[0];
			s3torrent.step_1_next();
		} else if (files.length > 0) {
			s3torrent.open_file_list_step_1(files);
		}
	}
}
//------------------------------------------------------------------------------
s3torrent.get_file = function(tFileURL, is_post) {
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
	        xhr.setRequestHeader("Referer", s3torrent.referrer_url);
	}
	xhr.timeout = 10000;
	xhr.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
	xhr.responseType = "arraybuffer";
	xhr.onload = function() {
		s3torrent.metadata = s3torrent.torrent.get_metadata_buffer(this.response);
		if (s3torrent.metadata && s3torrent.metadata.announce_list && s3torrent.metadata.info) {
			s3torrent.step_2(s3torrent.metadata.error);
		} else if (is_post) {
			s3torrent.step_1(s3torrent.metadata.error);
		} else {
			s3torrent.get_file(tFileURL, true);
		}
	}
	xhr.ontimeout = function() {
		s3torrent.step_1("Timeout");
	}
	xhr.onerror = function() {
		s3torrent.step_1("HTTP error");
	}
	xhr.send(sendData);
}
//-------------------------------------------------------------------------------------------
s3torrent.check_enter = function(event) {
	s3torrent.referrer_url = '';
	document.getElementById('s3torrent_new_selector').value = 'url';
	if (event.keyCode && (event.keyCode == 13)) {
		event.stopPropagation();
		event.preventDefault();
		if (! document.getElementById('s3torrent_step_1_next').disabled) {
			s3torrent.step_1_next();
		}
	}
}
//-------------------------------------------------------------------------------------------
s3torrent.ondialogcancel = function() {
	s3torrent.onclose = true;
}
//-------------------------------------------------------------------------------------------
s3torrent.onresize = function() {
	s3torrent.utils.prefs.setIntPref('size_window_new_torrent_width', window.innerWidth);
	s3torrent.utils.prefs.setIntPref('size_window_new_torrent_height', window.innerHeight);
}
//-------------------------------------------------------------------------------------------
s3torrent.magnet_log = function(text) {
	s3torrent.magnet_log_el.value += text + "\n";
	var pos = s3torrent.magnet_log_el.value.length;
	s3torrent.magnet_log_el.selectionStart = pos;
	s3torrent.magnet_log_el.selectionEnd = pos;
}
//-------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------
s3torrent.magnet.init = function(publisher_url, params) {
	s3torrent.magnet_log_el.hidden = false;
	s3torrent.magnet_log_el.value = '';

	var hash = params.xt[0].replace(/^urn\:btih\:/, '').toLowerCase();
	if (hash.length == 32) {
		hash = s3torrent.utils.base32tohex(hash);
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

	announce_url = announce_url.concat(s3torrent.torrent.protocol.public_trackers);

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
		s3torrent.magnet_log('tracker: ' + url + ' - init');
		var tracker = s3torrent.torrent.init_tracker_run(torrent, url);
		tracker.announce('stopped', s3torrent.magnet.tracker_start);
	}
}
//-------------------------------------------------------------------------------------------
s3torrent.magnet.tracker_start = function(is_ok, tracker, torrent) {
	tracker.announce('started', s3torrent.magnet.tracker_end);
}
//-------------------------------------------------------------------------------------------
s3torrent.magnet.tracker_end = function(is_ok, tracker, torrent) {
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
		s3torrent.magnet_log('tracker: ' + tracker.url + ' - added peer-list: ' + tracker.peer_list.length);

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
			s3torrent.magnet.get_peer(torrent);
			if ((peer_count >= s3torrent.torrent.protocol.peer_max_count) || (Object.keys(torrent.peer_work_list).length >= s3torrent.torrent.protocol.peer_max_count)) {
				go_peer = false;
			}
			peer_count++;
		}
	}
	//------------------------------------------------------------------------------
	s3torrent.magnet_log('tracker: ' + tracker.url + ' - close');
	s3torrent.magnet.check_stop_error(torrent);
}
//-------------------------------------------------------------------------------------------
s3torrent.magnet.get_peer = function(torrent) {
	var peer_data = null;
	while (peer_data = torrent.peer_list.shift()) {
		var peer_key = peer_data.ip + ':' + peer_data.port;
		if (torrent.peer_work_list[peer_key]) {
			continue;
		}
		var peer = new s3torrent.Peer( torrent, peer_key, s3torrent.torrent.protocol );
		torrent.peer[peer_key] = peer;
		peer.is_get_magnet = true;
		peer.peer_timeout_count = 10000;
		peer.handshake(peer_data.ip, peer_data.port, s3torrent.magnet.peer_connect_end);
		torrent.peer_work_list[peer_key] = true;

		s3torrent.magnet_log(torrent.peer_list.length + '.peer: ' + peer_key + ' - init');
		break;
	}
	//------------------------------------------------------------------------------
	s3torrent.magnet.check_stop_error(torrent);
}
//-------------------------------------------------------------------------------------------
s3torrent.magnet.check_stop_error = function(torrent) {
	if (s3torrent.onclose) {
		torrent.is_done = true;
		s3torrent.magnet.stop_peers(torrent);
	}
	//------------------------------------------------------------------------------
	if ((torrent.tracker_length <= 0) && (torrent.peer_list.length == 0) && (Object.keys(torrent.peer_work_list).length == 0)) {
		if (! torrent.is_done) {
			s3torrent.step_1(s3torrent.utils.get_string('error.torrent_not_found'));
		}
	}
}
//-------------------------------------------------------------------------------------------
s3torrent.magnet.stop_peers = function(torrent) {
	for(var peer_key in torrent.peer) {
		torrent.peer[peer_key].socket_close(false);
	}
}
//-------------------------------------------------------------------------------------------
s3torrent.magnet.peer_connect_end= function(is_ok, peer, torrent, peer_data_new) {
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
				s3torrent.magnet_log(torrent.peer_list.length + '.peer: ' + peer.peer_key + ' - Metadata is received successfully!');
				s3torrent.magnet.stop_peers(torrent);
				s3torrent.metadata = s3torrent.torrent.get_metadata_magnet(torrent.metadata, torrent.metadata.info);
				s3torrent.step_2(s3torrent.metadata.error);
			}
		}
	}
	//------------------------------------------------------------------------------
	else {
		if (! torrent.is_done) {
			if (Object.keys(torrent.peer_work_list).length < s3torrent.torrent.protocol.peer_max_count) {
				s3torrent.magnet.get_peer(torrent);
			}
		}
	}
	//------------------------------------------------------------------------------
	s3torrent.magnet_log(torrent.peer_list.length + '.peer: ' + peer.peer_key + ' - close');

	delete torrent.peer_work_list[peer.peer_key];
	torrent.peer[peer.peer_key] = null;
	delete torrent.peer[peer.peer_key];
	//------------------------------------------------------------------------------
	s3torrent.magnet.check_stop_error(torrent);
}
//------------------------------------------------------------------------------
s3torrent.open_file_list_step_1 = function(files) {
	if ((s3torrent.default_save_dir != '') && (s3torrent.utils.confirm(s3torrent.utils.get_string("saveDir") + "\n" + s3torrent.default_save_dir, '', window))) {
		s3torrent.open_file_list_step_2(files);
	} else {
		if (s3torrent.select_dir()) {
			s3torrent.open_file_list_step_1(files);
		} else {
			s3torrent.step_1();
		}
	}
}
//------------------------------------------------------------------------------
s3torrent.open_file_list_step_2 = function(files) {
	var winD = window.openDialog('chrome://s3torrent/content/confirm_start.xul', 's3torrent_confirm_start', 'chrome,modal,centerscreen');
	var is_start = false;
	if (winD.return_result == 0) {
		return;
	}
	else if (winD.return_result == 1) {
		is_start = true;
	}
	s3torrent.open_file_list_step_3(files, is_start);
}
//------------------------------------------------------------------------------
s3torrent.open_file_list_step_3 = function(files, is_start) {
	s3torrent.utils.set_default_save_dir(s3torrent.default_save_dir);
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

					s3torrent.metadata = s3torrent.torrent.get_metadata_buffer(file_data);
					if (s3torrent.metadata && s3torrent.metadata.announce_list && s3torrent.metadata.info) {
						if (s3torrent.metadata.error) {
							var name = file_path;
							if (s3torrent.metadata && s3torrent.metadata.info && s3torrent.metadata.info.name) {
								name = s3torrent.metadata.info.name;
							}
							s3torrent.utils.notification_box(name, s3torrent.metadata.error);
						} else {
							s3torrent.metadata.save_dir = s3torrent.default_save_dir;
							s3torrent.metadata.referrer_url = '';
							s3torrent.metadata.torrent_url = '';
							s3torrent.torrent.add_new(s3torrent.metadata, ! is_start);
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
s3torrent.select_file_list = function(e) {
	e.target.firstChild.setAttribute("checked", e.target.checked);
	e.target.firstChild.disabled = ! e.target.checked;
	e.target.firstChild.nextSibling.disabled = ! e.target.checked;

	s3torrent.metadata.file_list[e.target.file_id].status = (e.target.checked) ? 'process' : 'skip';
	if (! e.is_all) {
		s3torrent.select_file_list_check_total();
	}
}
//-------------------------------------------------------------------------------------------
s3torrent.select_file_list_all = function(checked) {
	var file_list_box = document.getElementById('s3torrent_step_3_file_list');
	
	for (var i=0; i<file_list_box.itemCount; i++) {
		var e = { 'target' : file_list_box.getItemAtIndex( i ), 'is_all' :  true };
		e.target.checked = checked;
		s3torrent.select_file_list(e);
	}

	s3torrent.select_file_list_check_total();
}
//-------------------------------------------------------------------------------------------
s3torrent.select_file_list_check_total = function() {
	var file_list_box = document.getElementById('s3torrent_step_3_file_list');
	var total = 0;
	var file_count = 0;

	for (var i=0; i<file_list_box.itemCount; i++) {
		var el = file_list_box.getItemAtIndex( i );
		if (el.checked) {
			total += el.file_length;
			file_count += 1;
		}
	}
	document.getElementById('s3torrent_step_3_file_list_total_size').value = file_count + ' / ' + s3torrent.utils.get_strings_to_KB_MB_GB(total);
}
//-------------------------------------------------------------------------------------------
