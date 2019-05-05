///////////////////////////////////////
// docs:
// http://pbtorrent.ucoz.ru/publ/specifikacija_protokola_bittorrent_v_1_0_na_russkom/1-1-0-1
// https://ru.wikipedia.org/wiki/BitTorrent_%28%D0%BF%D1%80%D0%BE%D1%82%D0%BE%D0%BA%D0%BE%D0%BB%29
// https://wiki.theory.org/BitTorrentSpecification
///////////////////////////////////////


this.EXPORTED_SYMBOLS = [ "torrent" ];

var s3torrent = {};
s3torrent.torrent = {};
this.torrent = s3torrent.torrent;

Components.utils.import("resource://s3torrent/history.js", s3torrent);
Components.utils.import("resource://s3torrent/tracker_http.js", s3torrent);
Components.utils.import("resource://s3torrent/tracker_udp.js", s3torrent);
Components.utils.import("resource://s3torrent/peer.js", s3torrent);
Components.utils.import("resource://s3torrent/httpseeds.js", s3torrent);
Components.utils.import("resource://s3torrent/file.js", s3torrent);
Components.utils.import("resource://s3torrent/bencode.js", s3torrent);
Components.utils.import("resource://s3torrent/digest.js", s3torrent);
Components.utils.import("resource://s3torrent/utils.js", s3torrent);

s3torrent.torrent.downloads = {};
s3torrent.torrent.protocol = {};
s3torrent.torrent.used_buffer = 0;

//------------------------------------------------------------------------------
s3torrent.torrent.init = function() {
	s3torrent.torrent.protocol = s3torrent.torrent.get_protocol();
	s3torrent.file.download_error = s3torrent.torrent.download_error;
	s3torrent.torrent.request_observer_init();

	s3torrent.torrent.peer_box_list = [];
	s3torrent.torrent.is_get_peer_busy = false;

	var torrent_list = s3torrent.history.load_history_list();
	for (var metadata of torrent_list) {
		if (! s3torrent.torrent.downloads[metadata.s3torrent_id]) {
			metadata.info_buffer = new Uint8Array(s3torrent.bencode.encode(metadata.info)).buffer;
			var torrent = s3torrent.torrent.create(metadata);
			if ((torrent.metadata.is_stopped == false) && (torrent.metadata.is_completed == false)) {
				torrent.metadata.is_stopped = true;
				s3torrent.torrent.action_start(metadata.s3torrent_id, true);
			} else if (torrent.metadata.is_completed == false) {
				s3torrent.torrent.calculate_data(torrent);
			}
		}
	}
	s3torrent.torrent.update_toolbar_text();
}
//------------------------------------------------------------------------------
s3torrent.torrent.get_protocol = function() {
	//-----------------------------------------------------------------------------
	var protocol = {
		protocol_name: 'BitTorrent protocol',
		client_name: 'BitComet/1.37.12.31',
		peer_max_count: s3torrent.utils.prefs.getIntPref('torrent.peer_max_count', 20),
		peer_max_const: 500,
		data_max_buffer: s3torrent.utils.prefs.getIntPref('torrent.data_max_buffer'),
		piece_max_buffer: 100000, // 100 KB memory
		extension_messages: { ut_metadata: 2, ut_pex: 3 },
		piece_size: 16384,
		chunk_size: 16384,
		handshake_length: 68,
		handshake_flags: [0,0,0,0,0,
                     0x10, // have to set this bit, or we wont get ut_metadata
                     0,0],
		message_codes: {
			'0' : 'CHOKE',
			'1' : 'UNCHOKE',
			'2' : 'INTERESTED',
			'3' : 'NOT_INTERESTED',
			'4' : 'HAVE',
			'5' : 'BITFIELD',
			'6' : 'REQUEST',
			'7' : 'PIECE',
			'8' : 'CANCEL',
			'14' : 'HAVE_ALL',
			'15' : 'HAVE_NONE',
			'16' : 'REJECT_REQUEST',
			'20' : 'UTORRENT_MSG'
		},
		message_names: {},
		get_piece_request : s3torrent.torrent.get_piece_request,
		set_piece_request : s3torrent.torrent.set_piece_request,
		// http://pastebin.com/KcETt8JA
		public_trackers: ['udp://tracker.openbittorrent.com:80', 'udp://tracker.istole.it:6969', 'http://exodus.desync.com:6969/announce', 'http://pow7.com:80/announce', 'udp://tracker.publicbt.com:80', 'udp://tracker.istole.it:80', 'udp://tracker.ccc.de:80']
	};
	for (var i in protocol.message_codes) {
		protocol.message_names[protocol.message_codes[i]] = i;
	}

	return protocol;
};
//------------------------------------------------------------------------------
s3torrent.torrent.get_metadata_magnet = function(meta_tmp, info) {
	var metadata = {
		'comment' : '',
		'created by' : 'Magnet',
		'creation date' : Math.ceil(new Date().getTime() / 1000),
		'encoding' : 'UTF-8',
		'publisher' : 'Magnet',
		'publisher-url' : meta_tmp.publisher_url
	};
	metadata.info = info;

	metadata.hashbytes = meta_tmp.hashbytes;
	metadata.hashhexlower = meta_tmp.hashhexlower;
	metadata.s3torrent_id = 's3torrent_' + meta_tmp.hashhexlower;

	//-----------------------------------------------------------------------------
	var check_torrent_id = s3torrent.history.get_history(metadata.s3torrent_id);
	if (check_torrent_id) {
		metadata.error = s3torrent.utils.get_string('error.torrent_file_exists', [ check_torrent_id.info.name ]);
	}

	//-----------------------------------------------------------------------------
	metadata.announce_list = {};
	var tracker_id = 0;
	metadata.announce = meta_tmp.announce_url.shift();
	metadata['announce-list'] = [meta_tmp.announce_url];
	metadata.announce_list['tracker_id_' + tracker_id] = { 'url' :metadata.announce };
	for (var url_list of metadata['announce-list']) {
		for (var url of url_list) {
			tracker_id++;
			metadata.announce_list['tracker_id_' + tracker_id] = { 'url' :url };
		}
	}
	//-----------------------------------------------------------------------------
	metadata.total_size = 0;
	metadata.file_list = [];

	if (metadata.info.files) {
		for (var file of metadata.info.files) {
			metadata.file_list.push({ 'length': file.length, 'path': file.path,  'parent_dir' : metadata.info.name, 'file_id':  metadata.file_list.length, 'status': 'process' });
			metadata.total_size += file.length;
		}
	} else {
		metadata.total_size += metadata.info.length;
		metadata.file_list.push({ 'length': metadata.info.length, 'path': [metadata.info.name], 'parent_dir' : '', 'file_id':  metadata.file_list.length, 'status': 'process' });
	}

	return metadata;
}
//------------------------------------------------------------------------------
s3torrent.torrent.get_metadata_buffer = function(buffer) {
	var metadata = {};

	try {
		// try to make this utf-8 aware...
		if (buffer.byteLength > Math.pow(2,25)) { // 32 megs 
			metadata.error = s3torrent.utils.get_string('error.torrent_file_to_large', s3torrent.utils.get_strings_to_KB_MB_GB(buffer.byteLength));
		}
		//-----------------------------------------------------------------
//		metadata = s3torrent.bencode.decode(s3torrent.utils.ui82str(new Uint8Array(buffer)));
		metadata = s3torrent.bencode.decode(s3torrent.utils.ui82str(new Uint8Array(buffer)), { utf8:true });
	 	if (metadata.encoding) {
			if (metadata.encoding.toLowerCase() != 'utf-8' && metadata.encoding.toLowerCase() != 'utf8') {
//				metadata = s3torrent.bencode.decode(s3torrent.utils.ui82str(new Uint8Array(buffer)), { utf8:true });
				metadata = s3torrent.bencode.decode(s3torrent.utils.ui82str(new Uint8Array(buffer)));
			}
		}

		//-----------------------------------------------------------------
		var sha1_hash = s3torrent.digest.checksum_buffer([s3torrent.bencode.encode(metadata.info)], 'SHA1');
		metadata.hashbytes = sha1_hash.bytes;
		metadata.hashhexlower = sha1_hash.text;
		metadata.s3torrent_id = 's3torrent_' + sha1_hash.text;
	} catch(e) {
		metadata.error = s3torrent.utils.get_string('error.torrent_file_invalid');
        }

	//-----------------------------------------------------------------------------
	var check_torrent_id = s3torrent.history.get_history(metadata.s3torrent_id);
	if (check_torrent_id) {
		metadata.error = s3torrent.utils.get_string('error.torrent_file_exists', [ check_torrent_id.info.name ]);
	}

	//-----------------------------------------------------------------------------
	var tmp_announce_url = [].concat(s3torrent.torrent.protocol.public_trackers);
	metadata.announce_list = {};
	var tracker_id = 0;
	if (! metadata.announce) {
		metadata.announce = tmp_announce_url.shift();
	}
	metadata.announce_list['tracker_id_' + tracker_id] = { 'url' : metadata.announce };
	//-----------------------------------------------------------------------------
	if (metadata['announce-list']) {
		for (var url_list of metadata['announce-list']) {
			for (var url of url_list) {
				if (url == metadata.announce) { continue; }
				tracker_id++;
				metadata.announce_list['tracker_id_' + tracker_id] = { 'url' :url };
			}
		}
	}
	//-----------------------------------------------------------------------------
	else {
		for (var url of tmp_announce_url) {
			if (url == metadata.announce) { continue; }
			tracker_id++;
			metadata.announce_list['tracker_id_' + tracker_id] = { 'url' :url };
		}
	}
	//-----------------------------------------------------------------------------
	metadata.total_size = 0;
	metadata.file_list = [];

	if (metadata.info) {
		if (metadata.info.files) {
			for (var file of metadata.info.files) {
				metadata.file_list.push({ 'length': file.length, 'path': file.path,  'parent_dir' : metadata.info.name, 'file_id':  metadata.file_list.length, 'status': 'process' });
				metadata.total_size += file.length;
			}
		} else {
			metadata.total_size += metadata.info.length;
			metadata.file_list.push({ 'length': metadata.info.length, 'path': [metadata.info.name], 'parent_dir' : '', 'file_id':  metadata.file_list.length, 'status': 'process' });
		}
	}

	return metadata;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.add_new = function(metadata, is_later) {
	if (metadata && metadata.announce_list && metadata.info) {
		//----------------------------------------------------------------------------
		metadata.info_buffer = new Uint8Array(s3torrent.bencode.encode(metadata.info)).buffer;

		//----------------------------------------------------------------------------
		metadata.is_completed = false;
		metadata.is_stopped = true;
		metadata.is_error = false;
		metadata.is_error_text = '';

		//----------------------------------------------------------------------------
		metadata.downloaded = 0;
		metadata.uploaded = 0;
		metadata.start_time = new Date().getTime();
		metadata.end_time = new Date().getTime();

		//----------------------------------------------------------------------------
		metadata.piece_current = 0;
		metadata.piece_future = 0;
		metadata.piece_length = metadata.info['piece length'];
		metadata.piece_count = Math.ceil(metadata.total_size / metadata.piece_length);
		metadata.chunk_offset = 0;

		//----------------------------------------------------------------------------
		var torrent = s3torrent.torrent.create(metadata);
		s3torrent.utils.notification_box(torrent.metadata.info.name, s3torrent.utils.get_string('download.created'));
		if (s3torrent.utils.prefs.getBoolPref('DL.switchDownloadsTab')) {
			try {
				var wm_window = s3torrent.utils.get_window();
				wm_window.s3torrent.open_download_window();
			} catch(e) {
			}
		}
		if (is_later) {
			s3torrent.torrent.calculate_data(torrent);
		} else {
			s3torrent.torrent.action_start(metadata.s3torrent_id);
		}
		s3torrent.torrent.history_save(torrent);
	}
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.create = function(metadata) {
	var torrent = {};
	torrent.metadata = metadata;
	torrent.piece_buffer = {};
	torrent.piece_buffer_length = 0;
	torrent.piece_buffer_check = false;

	torrent.metadata.download_speed = 0;
	torrent.download_speed_data = [];
	torrent.piece_hash = {};

	torrent.tracker = {};
	torrent.peer = {};
	torrent.peer_list = [];
	torrent.peer_black_list = {};
	torrent.peer_grey_list = {};
	torrent.httpseed = null;

	s3torrent.torrent.downloads[metadata.s3torrent_id] = torrent;
	return torrent;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.action_stop = function(torrent_id) {
	for (var torrent_key in s3torrent.torrent.downloads) {
		if ((torrent_id == 'all') || (torrent_id == torrent_key)) {
			var torrent = s3torrent.torrent.downloads[torrent_key];
			if (torrent && (torrent.metadata.is_stopped == false) && (torrent.metadata.is_completed == false)) {
				s3torrent.torrent.download_stop(torrent);
			}
		}
	}
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.action_start = function(torrent_id, is_disable_notification) {
	for (var torrent_key in s3torrent.torrent.downloads) {
		if ((torrent_id == 'all') || (torrent_id == torrent_key)) {
			var torrent = s3torrent.torrent.downloads[torrent_key];
			if (torrent && torrent.metadata.is_stopped && (! torrent.metadata.is_completed)) {
				torrent.metadata.is_error = false;
				torrent.metadata.is_error_text = '';
				torrent.metadata.is_stopped = false;
				torrent.piece_buffer = {};
				//---------------------------------------------------------
				for (var i =0; i<torrent.metadata.piece_count; i++) {
					torrent.piece_hash['piece_' + i] = null;
					delete torrent.piece_hash['piece_' + i];
				}
				//---------------------------------------------------------
				s3torrent.torrent.calculate_data(torrent);
				if (! s3torrent.torrent.check_stop_status(torrent)) {
					if (! torrent.peer_work_list) {
						torrent.peer_work_list = {};
					}
					if (! is_disable_notification) {
						s3torrent.utils.notification_box(torrent.metadata.info.name, s3torrent.utils.get_string('download.started'));
					}
					for (var tracker_key in torrent.metadata.announce_list) {
						s3torrent.torrent.init_tracker(torrent, tracker_key);
					}
					s3torrent.torrent.httpseed_start(torrent);
				}
				s3torrent.torrent.history_save(torrent);
			}
		}
	}
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.check_stop_status = function(torrent) {
	var status = torrent.metadata.is_completed || torrent.metadata.is_error || torrent.metadata.is_stopped;
	return status;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.httpseed_start = function(torrent) {
	if (torrent.httpseed && torrent.httpseed.is_work) {
		return;
	}
	s3torrent.torrent.httpseed_stop(torrent);
	if (torrent.metadata['httpseeds']) {
		if ((! torrent.httpseed) || (! torrent.httpseed.is_work)) {
			torrent.httpseed = new s3torrent.HTTPSeeds( torrent, torrent.metadata['httpseeds'], s3torrent.torrent.protocol,  s3torrent.torrent.httpseed_callback );
			torrent.httpseed.request();
		}
	}
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.httpseed_stop = function(torrent) {
	if (torrent.httpseed) {
		torrent.httpseed.connect_close(true);
		torrent.httpseed = null;
		s3torrent.torrent.history_save(torrent);
	}
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.httpseed_callback = function(is_ok, httpseed, torrent) {
	if (! is_ok) {
//		s3torrent.torrent.httpseed_start(torrent);
	}
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.init_tracker = function(torrent, tracker_key) {
	var announce = torrent.metadata.announce_list[tracker_key];
	if (! announce) { return; }
	if (s3torrent.torrent.check_stop_status(torrent)) { return; }

	torrent.tracker[tracker_key] = s3torrent.torrent.init_tracker_run( torrent, announce.url );
	torrent.tracker[tracker_key].tracker_key = tracker_key;
	torrent.tracker[tracker_key].announce('stopped', s3torrent.torrent.announce_restart);
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.init_tracker_run = function(torrent, url) {
	var tracker = null;

	if (url.toLowerCase().match('^udp')) {
		tracker = new s3torrent.UDPTracker( torrent, url );
	} else {
		tracker = new s3torrent.HTTPTracker( torrent, url );
	}
	return tracker;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.announce_restart = function(is_ok, tracker, torrent) {
	tracker.announce('started', s3torrent.torrent.announce_end);
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.announce_end = function(is_ok, tracker, torrent) {
	if (is_ok && tracker.peer_list.length <= 1) {
		tracker.peer_list = [];
		is_ok = false;
	}
	//------------------------------------------------------------------------------
	if (s3torrent.torrent.check_stop_status(torrent)) {
		is_ok = false;
	}
	//------------------------------------------------------------------------------
	var announce = torrent.metadata.announce_list[tracker.tracker_key];
	//------------------------------------------------------------------------------
	if (is_ok) {
		tracker.is_error = false;
		//------------------------------------------------------------------------
		for (var peer of tracker.peer_list) {
			var peer_key = peer.ip + ':' + peer.port;
			if ((! torrent.peer_black_list[peer_key]) && (! torrent.peer_work_list[peer_key])) {
				torrent.peer_list.push(peer);
			}
		}

		while (s3torrent.torrent.get_peer_check(torrent)) {
			if (! s3torrent.torrent.get_peer(torrent)) {
				break;
			}
		}
	}
	//------------------------------------------------------------------------------
	else {
		tracker.is_error = true;
		//-----------------------------------------------------------------------
		var all_tracker_error = true;
		for (var tracker_key in torrent.metadata.announce_list) {
			var tracker_torrent = torrent.tracker[tracker_key];
			if (tracker_torrent) {
				if (! tracker_torrent.is_error) {
					all_tracker_error = false;
				}
			} else {
				all_tracker_error = false;
			}
		}
		if (all_tracker_error) {
			s3torrent.torrent.download_error(torrent, 'error.torrent_not_found');
		}
	}
	s3torrent.torrent.history_save(torrent);
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.peer_connect_end = function(is_ok, peer, torrent, peer_data_new) {
	var is_get_peer = false;
	if (! torrent) { return; }
	for (var i in peer.piece_download) {
		var piece_download = peer.piece_download[i];
		var piece = torrent.piece_hash['piece_' + piece_download.piece_id];
		if (piece_download.piece_id < torrent.metadata.piece_future) {
			torrent.metadata.piece_future = piece_download.piece_id;
		}
		var chunk_key = 'chunk_' + piece_download.chunk_offset;
		if (piece && piece.chunk_offset_hash[chunk_key] && (! piece.chunk_offset_hash[chunk_key].done)) {
			piece.chunk_offset_hash[chunk_key] = null;
			delete piece.chunk_offset_hash[chunk_key];
		}
	}
	//------------------------------------------------------------------------------
	if (is_ok) {
		if (peer_data_new) {
			var peer_key_new = peer_data_new.ip + ':' + peer_data_new.port;
			var is_added = true;
			for (var peer_data of torrent.peer_list) {
				var peer_key = peer_data.ip + ':' + peer_data.port;
				if (peer_key == peer_key_new) {
					is_added = false;
				}
			}
			if (torrent.peer_black_list[peer_key_new]) {
				is_added = false;
			}

			if (is_added) {
				torrent.peer_list.push(peer_data_new);
			}
			return;
		}
	}
	//------------------------------------------------------------------------------
	else {
		is_get_peer = true;
		if ((peer.peer_percent == 0) && (! torrent.peer_grey_list[peer.peer_key])) {
			torrent.peer_black_list[peer.peer_key] = true;
			var tmp_list = [];
			for (var peer_data of torrent.peer_list) {
				var peer_key = peer_data.ip + ':' + peer_data.port;
				if (peer_key != peer.peer_key) {
					tmp_list.push(peer_data);
				}
			}
			torrent.peer_list = [].concat(tmp_list);
			tmp_list = [];
		} else {
			torrent.peer_grey_list[peer.peer_key] = true;
		}
	}
	//------------------------------------------------------------------------------
	delete torrent.peer_work_list[peer.peer_key];
	torrent.peer[peer.peer_key] = null;
	delete torrent.peer[peer.peer_key];
	//-----------------------------------------------------------------------------
	if (is_get_peer) {
		while (s3torrent.torrent.get_peer_check(torrent)) {
			if (! s3torrent.torrent.get_peer(torrent)) {
				break;
			}
		}
	}
	//-----------------------------------------------------------------------------
	s3torrent.torrent.history_save(torrent);
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.get_peer = function(torrent) {
	var peer_data = null;
	var tmp_list = [];
	var tmp_hash = {};
	var is_ok = false;

	//-----------------------------------------------------------------------------
	while (peer_data = torrent.peer_list.shift()) {
		var peer_key = peer_data.ip + ':' + peer_data.port;
		if (tmp_hash[peer_key]) { continue; }

		tmp_list.push(peer_data);
		tmp_hash[peer_key] = true;

		if (torrent.peer_work_list[peer_key]) {
			continue;
		}
		torrent.peer_work_list[peer_key] = true;
		var peer = new s3torrent.Peer( torrent, peer_key, s3torrent.torrent.protocol );
		peer.ip = peer_data.ip;
		peer.port = peer_data.port;
		torrent.peer[peer_key] = peer;
		//-----------------------------------------------------------------------
		s3torrent.torrent.peer_box_list.push(peer);
		s3torrent.torrent.get_peer_run();
		is_ok = true;
		break;
	}
	//-----------------------------------------------------------------------------
	torrent.peer_list = torrent.peer_list.concat(tmp_list);
	tmp_list = [];
	tmp_hash = {};
	//-----------------------------------------------------------------------------
	if (torrent.peer_list.length == 0) {
		torrent.peer_grey_list = {};
		torrent.peer_black_list = {};

		s3torrent.utils.setTimeout(function(){ 
			for (var tracker_key in torrent.metadata.announce_list) {
				s3torrent.torrent.init_tracker(torrent, tracker_key);
			}
		}, tracker.req_interval * 60000);
	}
	//-----------------------------------------------------------------------------
	return is_ok;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.get_peer_check = function(torrent) {
	if (s3torrent.torrent.check_stop_status(torrent)) {
		return false;
	}
	//-----------------------------------------------------------------------------
	var peer_max_count = s3torrent.torrent.get_peer_max_count();
	var result_count = s3torrent.torrent.get_peer_count(torrent);
	//-----------------------------------------------------------------------------
	if (result_count.all == 0) {
		return false;
	}
	//-----------------------------------------------------------------------------
	if (result_count.work >= result_count.all) {
		return false;
	}
	//-----------------------------------------------------------------------------
	if (peer_max_count > result_count.work) {
		return true;
	}

	return false;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.check_speed_limit = function(torrent) {
	var speed_limit_all = s3torrent.utils.prefs.getIntPref('torrent.speed_limit_all', 0);
	var speed_limit_one = s3torrent.utils.prefs.getIntPref('torrent.speed_limit_one', 0);
	if ((speed_limit_all == 0) && (speed_limit_one == 0)) { return true; }

	if (speed_limit_one > 0) {
		if (torrent.metadata && torrent.metadata.download_speed) {
			if ((torrent.metadata.download_speed / 1024) > speed_limit_one) {
				return false;
			}
		}
	}

	if (speed_limit_all > 0) {
		var speed_all = 0;
		for (var torrent_key in s3torrent.torrent.downloads) {
			var torrent2 = s3torrent.torrent.downloads[torrent_key];
			if (! s3torrent.torrent.check_stop_status(torrent2)) {
				if (torrent2.metadata && torrent2.metadata.download_speed) {
					speed_all += torrent2.metadata.download_speed;
				}
			}
		}
		return ((speed_all / 1024) > speed_limit_all) ? false : true;
	}

	return true;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.get_peer_run = function(is_force) {
	if (is_force || (! s3torrent.torrent.is_get_peer_busy)) {
		s3torrent.torrent.is_get_peer_busy = true;
		var peer = s3torrent.torrent.peer_box_list.shift();
		if (peer) {
			if ((! peer.torrent) || s3torrent.torrent.check_stop_status(peer.torrent)) {
				peer.piece_have = {};
				if (peer.torrent) {
					delete peer.torrent.peer_work_list[peer.peer_key];
					peer.torrent.peer[peer.peer_key] = null;
					delete peer.torrent.peer[peer.peer_key];
					delete peer.torrent;
					peer = null;
				}
			} else if (peer.socket_open) {
				peer = null;
			} else {
				peer.handshake(peer.ip, peer.port, s3torrent.torrent.peer_connect_end);
			}
		}
		//-----------------------------------------------------------------------
		if (s3torrent.torrent.peer_box_list.length > 0) {
			s3torrent.utils.setTimeout(function(){
				s3torrent.torrent.get_peer_run(true);
			}, 300);
		}
		//-----------------------------------------------------------------------
		else {
			s3torrent.torrent.is_get_peer_busy = false;
		}
	}
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.download_complete = function(torrent) {
	torrent.metadata.is_completed = true;
	torrent.metadata.is_error = false;
	torrent.metadata.downloaded = s3torrent.torrent.calculate_total_size(torrent);
	s3torrent.torrent.download_stop(torrent);
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.download_error = function(torrent, msg, file_path) {
	torrent.metadata.is_error = true;
	torrent.metadata.is_completed = false;
	torrent.metadata.is_error_text = s3torrent.utils.get_string(msg, [ file_path ]);
	s3torrent.utils.notification_box(torrent.metadata.is_error_text);
	s3torrent.torrent.download_stop(torrent);
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.download_stop = function(torrent) {
	for(var peer_key in torrent.peer) {
		torrent.peer[peer_key].socket_close(true);
		delete torrent.peer_work_list[peer_key];
	}
	s3torrent.torrent.httpseed_stop(torrent);

	for (var i =0; i<torrent.metadata.piece_count; i++) {
		var piece = torrent.piece_hash['piece_' + i];
		if (piece) {
			for (var chunk_key in piece.chunk_offset_hash) {
				if (piece.chunk_offset_hash[chunk_key].data) {
					s3torrent.torrent.used_buffer -= piece.chunk_offset_hash[chunk_key].data.byteLength;
				}
				piece.chunk_offset_hash[chunk_key] = null;
				delete piece.chunk_offset_hash[chunk_key];
			}
		}
	}
	s3torrent.torrent.save_data(torrent);

	torrent.metadata.download_speed = 0;
	torrent.download_speed_data = [];
	if ((! torrent.metadata.is_removed) && (! torrent.metadata.is_stopped) && (! torrent.metadata.is_completed)) {
		s3torrent.utils.notification_box(torrent.metadata.info.name, s3torrent.utils.get_string('download.stopped'));
	}
	torrent.metadata.is_stopped = true;
	s3torrent.torrent.history_save(torrent);
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.get_piece_request = function(torrent, piece_have, piece_future_inc, piece_current_id) {
	var result = { 'piece_id': 0, 'chunk_offset': null, 'chunk_size': 0, 'action' : 'cancel' };
	if (torrent && torrent.metadata.is_removed) { return result; }

	//------------------------------------------------------------------------------
	if ((! torrent) || (s3torrent.torrent.check_stop_status(torrent))) {
		return result;
	}
	//------------------------------------------------------------------------------
	if ((torrent.metadata.piece_current + piece_future_inc) >= torrent.metadata.piece_count) {
		result.action = 'pause';
		return result;
	} 
	//------------------------------------------------------------------------------
	if (! s3torrent.torrent.check_speed_limit(torrent)) {
		result.action = 'pause';
		return result;
	}
	//------------------------------------------------------------------------------
	result.piece_id = torrent.metadata.piece_current + piece_future_inc;
	//------------------------------------------------------------------------------
	var piece = torrent.piece_hash['piece_' + result.piece_id];
	result.chunk_size = s3torrent.torrent.protocol.chunk_size;
	result.chunk_offset = null;
	result.action = 'pause';

	//------------------------------------------------------------------------------
	if (piece_have['piece_' + result.piece_id] > 0) {
		var chunk_work_list = [];
		var chunk_offset_count = s3torrent.torrent.chunk_offset_count(torrent, result.piece_id);
		if (! piece.completed) {
			for (var i = 0; i< chunk_offset_count; i++) {
				var chunk_key = 'chunk_' + (i * result.chunk_size);
				if (! piece.chunk_offset_hash[chunk_key]) {
					result.chunk_offset = i * result.chunk_size;
					result.action = 'download';
					var piece_length = s3torrent.torrent.calculate_piece_length(torrent, result.piece_id);
					if ((result.chunk_offset + result.chunk_size) > piece_length) {
						result.chunk_size = piece_length - result.chunk_offset;
					}
					piece.chunk_offset_hash['chunk_' + result.chunk_offset] = { 'done' : false, 'data' : null, 'piece_id' : result.piece_id, 'chunk_offset' : result.chunk_offset, 'chunk_size' : result.chunk_size };
					break;
				} else if (! piece.chunk_offset_hash[chunk_key].done) {
					chunk_work_list.push(piece.chunk_offset_hash[chunk_key]);
				}
			}
		}
		//------------------------------------------------------------------------
		if (result.action == 'pause') {
			var max_count = s3torrent.torrent.calculate_total_buffer(torrent.metadata.piece_length);
			if (piece_future_inc <= max_count) {
				var piece_future_inc_tmp = piece_future_inc;
				if (piece_future_inc_tmp == 0) {
					piece_current_id = torrent.metadata.piece_current;
					piece_future_inc_tmp = (torrent.metadata.piece_future - torrent.metadata.piece_current);
					if (piece_future_inc_tmp <= 0) {
						piece_future_inc_tmp = 1;
					}
				} else {
					piece_future_inc_tmp++;
				}
				if (max_count > 0) {
					if (piece_current_id == torrent.metadata.piece_current) {
						torrent.metadata.piece_future = torrent.metadata.piece_current + piece_future_inc_tmp;
					}
					result = s3torrent.torrent.get_piece_request(torrent, piece_have, piece_future_inc_tmp, piece_current_id);
				}
				if ((piece_future_inc == 0) && ((result.action == 'pause') || (result.action == 'cancel'))) {
					var hash = chunk_work_list[Math.floor(Math.random()*chunk_work_list.length)];
					if (hash) {
						if (hash.done) {
							if (s3torrent.torrent.calculate_piece_elements(torrent, torrent.metadata.piece_current)) {
								s3torrent.torrent.calculate_piece_timeout(torrent, torrent.metadata.piece_current);
							}
						}
						else if (chunk_work_list.length < 5) {
							result.piece_id = hash.piece_id;
							result.chunk_offset = hash.chunk_offset;
							result.chunk_size = hash.chunk_size;
							result.action = 'download';
						}
					} else {
						if (s3torrent.torrent.calculate_piece_elements(torrent, torrent.metadata.piece_current)) {
							s3torrent.torrent.calculate_piece_timeout(torrent, torrent.metadata.piece_current);
						}
					}
				}
			}
		}
		chunk_work_list = [];
	}
	//------------------------------------------------------------------------------
	else {
		result.action = 'cancel';
	}

	return result;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.set_piece_request = function(torrent, piece_download, is_done, data) {
	if (torrent && torrent.metadata.is_removed) { return; }
	//------------------------------------------------------------------------------
	if (piece_download.piece_id < torrent.metadata.piece_current) {
		is_done = false;
	}
	//------------------------------------------------------------------------------
	var piece = torrent.piece_hash['piece_' + piece_download.piece_id];
	var chunk_key = 'chunk_' + piece_download.chunk_offset;
	//------------------------------------------------------------------------------
	if (is_done) {
		if (piece.chunk_offset_hash[chunk_key] && (! piece.chunk_offset_hash[chunk_key].done)) {
			s3torrent.torrent.used_buffer += data.byteLength;
//			torrent.metadata.downloaded += data.byteLength;
		}
		piece.chunk_offset_hash[chunk_key] = { 'done' : true, 'data' : data };
		s3torrent.torrent.calculate_speed(torrent, piece_download);
//		s3torrent.torrent.calculate_piece_timeout(torrent, piece_download.piece_id);
		s3torrent.torrent.history_save(torrent);
	}
	//------------------------------------------------------------------------------
	else {
		if ((piece_download.piece_id < torrent.metadata.piece_future) && (piece_download.piece_id >= torrent.metadata.piece_current)) {
			torrent.metadata.piece_future = piece_download.piece_id;
		}
		if (piece.chunk_offset_hash[chunk_key] && (! piece.chunk_offset_hash[chunk_key].done)) {
			piece.chunk_offset_hash[chunk_key] = null;
			delete piece.chunk_offset_hash[chunk_key];
		}
	}
	//------------------------------------------------------------------------------
	s3torrent.torrent.calculate_piece_timeout(torrent, piece_download.piece_id);
	data = null;
	//------------------------------------------------------------------------------
	while (s3torrent.torrent.get_peer_check(torrent)) {
		if (! s3torrent.torrent.get_peer(torrent)) {
			break;
		}
	}

	return true;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.calculate_piece_timeout = function(torrent, piece_id, is_force) {
	s3torrent.utils.setTimeout(function(){ s3torrent.torrent.calculate_piece(torrent, piece_id, is_force); }, 100);
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.calculate_piece = function(torrent, piece_id, is_force) {
	if (piece_id < torrent.metadata.piece_current) {
		torrent.piece_hash['piece_' + piece_id].chunk_offset_hash = {};
		torrent.piece_hash['piece_' + piece_id].chunk_offset_current = 0;
		return true;
	}
	if (piece_id > torrent.metadata.piece_current) {
		return false;
	}
	if ((! is_force) && torrent.is_calculate_piece) { return false; }
	torrent.is_calculate_piece = true;

	var piece = torrent.piece_hash['piece_' + piece_id];
	if (! piece) {
		torrent.is_calculate_piece = false;
		return;
	}
	if (piece.completed) {
		torrent.piece_hash['piece_' + piece_id].chunk_offset_hash = {};
		torrent.piece_hash['piece_' + piece_id].chunk_offset_current = 0;
		torrent.is_calculate_piece = false;
		return;
	}

	var piece_completed = [];
	var chunk_size = s3torrent.torrent.protocol.chunk_size;
	var chunk_offset_count = s3torrent.torrent.chunk_offset_count(torrent, piece_id);

	for (var i = 0; i< chunk_offset_count; i++) {
		var piece_hash = piece.chunk_offset_hash['chunk_' + (i * chunk_size)];
		if (piece_hash && piece_hash.done) {
			piece_completed.push(piece_hash.data);
		}
	}

	if (piece_completed.length == chunk_offset_count) {
		//----------------------------------------------------------------------------------
		for (var chunk_key in piece.chunk_offset_hash) {
			piece.chunk_offset_hash[chunk_key] = {};
			delete piece.chunk_offset_hash[chunk_key];
		}
		//----------------------------------------------------------------------------------
		var sha1_hash = s3torrent.digest.checksum_buffer(piece_completed, 'SHA1');
		var piece_hashsum = torrent.metadata.info.pieces.slice( piece_id * 20, (piece_id+1)*20 );
		if (sha1_hash.hash == piece_hashsum) {
			//---------------------------------------------------------------------------
			var piece_data = new Uint8Array(s3torrent.torrent.calculate_piece_length(torrent, piece_id));
			var data_length = 0;
			for (var data of piece_completed) {
				piece_data.set( new Uint8Array( data ), data_length );
				data_length += data.byteLength;
			}
			//---------------------------------------------------------------------------
			torrent.piece_buffer[piece_id] = { 'data': piece_data, 'piece_id' : piece_id };
			torrent.piece_buffer_length += data_length;
			//---------------------------------------------------------------------------
			var is_get_piece_num = true;
			var piece_current = torrent.metadata.piece_current;
			while (is_get_piece_num) {
				piece_current++;
				var piece = torrent.piece_hash['piece_' + piece_current];
				if (piece) {
					if (! piece.completed) {
						is_get_piece_num = false;
					}
				} else {
					is_get_piece_num = false;
				}
			}
			//---------------------------------------------------------------------------
			if (piece_current >= torrent.metadata.piece_count) {
				s3torrent.torrent.download_complete(torrent);
				s3torrent.torrent.save_data(torrent);
				s3torrent.utils.notification_box(torrent.metadata.info.name, s3torrent.utils.get_string('download.completed'));
			} else {
				if (torrent.piece_buffer_length > s3torrent.torrent.protocol.piece_max_buffer) {
					s3torrent.utils.setTimeout(function() { s3torrent.torrent.save_data(torrent); }, 100);
				}
				torrent.metadata.piece_current = piece_current;
				torrent.metadata.piece_future = piece_current;
				s3torrent.torrent.calculate_piece_timeout(torrent, piece_current, true);
			}
			s3torrent.torrent.throw_peer_slow(torrent);
		}
	}

	torrent.is_calculate_piece = false;
	return true;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.calculate_piece_elements = function(torrent, piece_id) {
	var piece = torrent.piece_hash['piece_' + piece_id];
	if (! piece) {
		return false;
	}
	var piece_completed = 0;
	var chunk_size = s3torrent.torrent.protocol.chunk_size;
	var chunk_offset_count = s3torrent.torrent.chunk_offset_count(torrent, piece_id);

	for (var i = 0; i< chunk_offset_count; i++) {
		var piece_hash = piece.chunk_offset_hash['chunk_' + (i * chunk_size)];
		if (piece_hash && piece_hash.done) {
			piece_completed++;
		}
	}

	if (piece_completed >= chunk_offset_count) {
		return true;
	}

	return false;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.calculate_speed = function(torrent, piece_download) {
	[ torrent.metadata.download_speed, torrent.download_speed_data ] = s3torrent.utils.calculate_speed(torrent.download_speed_data, piece_download);
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.calculate_total_size = function(torrent) {
	var total_size = 0;
	for (var file of torrent.metadata.file_list) {
		if (file.status && (file.status == 'skip')) {
		} else {
			total_size += file.length;
		}
	}
	return total_size;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.calculate_downloaded_size = function(torrent) {
	var downloaded_size = 0;
	for (var file of torrent.metadata.file_list) {
		if (file.status && (file.status == 'skip')) {
		} else {
			downloaded_size += file.downloaded || 0;
		}
	}
	return downloaded_size;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.calculate_piece_length = function(torrent, piece_id) {
	var length = torrent.metadata.total_size - (piece_id * torrent.metadata.piece_length);
	return (length > torrent.metadata.piece_length) ? torrent.metadata.piece_length : length;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.chunk_offset_count = function(torrent, piece_id) {
	var piece_length = s3torrent.torrent.calculate_piece_length(torrent, piece_id);
	var chunk_offset_count = Math.ceil(piece_length / s3torrent.torrent.protocol.chunk_size);
	return chunk_offset_count;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.throw_peer_slow = function(torrent) {
	var result_count = s3torrent.torrent.get_peer_count(torrent);
	var peer_max_count = s3torrent.torrent.get_peer_max_count();

	var peer_count = result_count.work;
	var peer_key_slow = '-none-';
	var download_speed = -1;
	for(var peer_key in torrent.peer_work_list) {
		if (torrent.peer[peer_key] && ((torrent.peer[peer_key].download_speed <= download_speed) || (download_speed < 0))) {
			download_speed = torrent.peer[peer_key].download_speed;
			peer_key_slow = peer_key;
		}
	}

	if (torrent.peer[peer_key_slow]) {
		if (result_count.work > peer_max_count) {
			torrent.peer[peer_key_slow].socket_close(false);
		}
		else if ((peer_count > 3) && (peer_count > peer_max_count-3)) {
			if (torrent.peer[peer_key_slow] && (download_speed > 0)) {
				torrent.peer[peer_key_slow].socket_close(false);
			}
		}
	}
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.calculate_data = function(torrent, is_change_file_status) {
	var length_data = s3torrent.file.load_data(torrent);
	if (length_data < 0) {
		torrent.metadata.is_error = true;
		torrent.metadata.is_error_text = 'make_file_path';
	} else {
		//----------------------------------------------------------------------
		torrent.metadata.downloaded = length_data;
		//----------------------------------------------------------------------
		var offset_length = 0;
		var piece_length = torrent.metadata.piece_length;
		torrent.metadata.piece_current = -1;
		var file_position = 0;
		var torrent_is_done = true;

		//----------------------------------------------------------------------
		for (var file of torrent.metadata.file_list) {
			var file_length = file.length;
			var piece_count = Math.ceil(file.length / piece_length);

			while (file_length > 0) {
				var piece_id = Math.floor(offset_length / piece_length);
				var length_ofset_f_data = offset_length + file_length;
				var length_ofset_p_data = (piece_id+1) * piece_length;
				if (length_ofset_p_data > length_ofset_f_data) {
					offset_length += file_length;
					file_length = 0;
				} else {
					var offset = length_ofset_p_data - offset_length;
					offset_length += offset;
					file_length -= offset;
				}

				var is_completed = (torrent.piece_hash['piece_' + piece_id]) ? torrent.piece_hash['piece_' + piece_id].completed : true;

				if ((file.status != 'skip') && (file.status != 'done')) {
					if (length_ofset_p_data > (file_position + file.downloaded)) {
						is_completed = false;
						if (torrent.metadata.piece_current < 0) {
							torrent.metadata.piece_current = piece_id;
						}
						torrent_is_done = false;
					}
				}
				if (is_change_file_status && torrent.piece_hash['piece_' + piece_id]) {
					torrent.piece_hash['piece_' + piece_id].completed = is_completed;
				} else {
					torrent.piece_hash['piece_' + piece_id] = {
						'completed' : is_completed,
						'chunk_offset_hash' : {},
						'chunk_offset_current' : 0
					};
				}
			}
			file_position += file.length;
		}
		//----------------------------------------------------------------------
		torrent.metadata.is_completed = torrent_is_done;
		//----------------------------------------------------------------------
		if (torrent_is_done) {
			torrent.metadata.piece_current = torrent.metadata.piece_count-1;
		}
		//----------------------------------------------------------------------
		torrent.metadata.piece_future = torrent.metadata.piece_current; 
	}

	s3torrent.torrent.history_save(torrent);
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.calculate_total_buffer = function(piece_length) {
	if (s3torrent.torrent.used_buffer < 0) {
		s3torrent.torrent.used_buffer = 0;
	}
	var data_max_buffer = s3torrent.torrent.protocol.data_max_buffer * 1024 * 1024;
	var avail_buffer = data_max_buffer - s3torrent.torrent.used_buffer;
	var max_count = Math.ceil(avail_buffer / piece_length);
	return max_count;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.save_data = function(torrent, is_force) {
	if ((! is_force) && (torrent.piece_buffer_check)) { return; }
	if (torrent.metadata.is_error) { return; }
	if (torrent.metadata.is_removed) { return; }

	torrent.piece_buffer_check = true;

	//------------------------------------------------------------------------
	var piece_buffer = [];
	for (var piece_id in torrent.piece_buffer) {
		piece_buffer.push(piece_id);
	}
	if (piece_buffer.length > 0) {
		piece_buffer = piece_buffer.sort( function(a,b) {
			return parseInt(a) > parseInt(b);
		});
	}
	//-----------------------------------------------------------------------------------------
	var piece_id = null;
	var file_byteLength = 0;
	var piece_is_saved = false;

	while (piece_id = piece_buffer.shift()) {
		var piece_data = torrent.piece_buffer[piece_id];
		delete torrent.piece_buffer[piece_id];

		var run_save = true;
		if (torrent.piece_hash['piece_' + piece_data.piece_id].completed) {
			run_save = false;
		}
		else if (piece_data.piece_id > torrent.metadata.piece_current) {
			torrent.piece_buffer[piece_id] = piece_data;
			piece_buffer.unshift(piece_id);
			break;
		}
		else if (file_byteLength > (5*1024*1024)) {
			torrent.piece_buffer[piece_id] = piece_data;
			piece_buffer.unshift(piece_id);
			break;
		}
		var piece_length = piece_data.data.byteLength;
		torrent.piece_buffer_length -= piece_length;
		s3torrent.torrent.used_buffer -= piece_length;
		file_byteLength += piece_length;
		//------------------------------------------------------------------------------
		if (run_save) {
			torrent.piece_hash['piece_' + piece_data.piece_id].chunk_offset_hash = {};
			torrent.piece_hash['piece_' + piece_data.piece_id].chunk_offset_current = 0;

			var result = s3torrent.file.save_data(torrent, piece_data);
			if (result >= 0) {
				torrent.piece_hash['piece_' + piece_data.piece_id].completed = true;
			}
		}
		piece_is_saved = true;
	}
	//-----------------------------------------------------------------------------------------
	if (! piece_is_saved) {
		if (piece_buffer.length > 0) {
			piece_data = torrent.piece_buffer[piece_buffer.shift()];
			torrent.piece_hash['piece_' + piece_data.piece_id].chunk_offset_hash = {};
			torrent.piece_hash['piece_' + piece_data.piece_id].chunk_offset_current = 0;
		}
		torrent.piece_buffer_check = false;
		return;
	}
	//-----------------------------------------------------------------------------------------
	if (piece_buffer.length > 0) {
		var is_stopped = s3torrent.torrent.check_stop_status(torrent);
		if (torrent.metadata.is_completed || is_stopped) {
			s3torrent.torrent.save_data(torrent, true);
		} else {
			s3torrent.utils.setTimeout(function() { s3torrent.torrent.save_data(torrent, true); }, 300);
		}
	} else {
		torrent.piece_buffer_check = false;
	}
	//-----------------------------------------------------------------------------------------
	torrent.metadata.downloaded = s3torrent.file.load_data(torrent);
	s3torrent.torrent.history_save(torrent);
	return;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.get_peer_count = function(torrent) {
	var peer_all = 0;
	var peer_request = 0;
	var peer_work = 0;

	if (torrent) {
		peer_all = (torrent.tracker && torrent.peer_list) ? torrent.peer_list.length : 0;
		for (var peer_key in torrent.peer_work_list) {
			peer_work++;
			if (torrent.peer[peer_key].peer_is_request) {
				peer_request++;
			}
		}
	}
	return { 'all' : peer_all, 'work' : peer_work, 'request' : peer_request, 'wait' : (peer_work - peer_request) };
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.get_peer_max_count = function() {

	if (s3torrent.torrent.protocol.peer_max_count > s3torrent.torrent.protocol.peer_max_const) {
		s3torrent.torrent.protocol.peer_max_count = s3torrent.torrent.protocol.peer_max_const;
	}

	var peer_max_count = s3torrent.torrent.protocol.peer_max_count;
	if (peer_max_count > 5) {
		var process_count = 0;
		for (var torrent_key in s3torrent.torrent.downloads) {
			var torrent = s3torrent.torrent.downloads[torrent_key];
			if (torrent) {
				if (! s3torrent.torrent.check_stop_status(torrent)) {
					process_count++;
				}
			}
		}
		if (process_count > 0) {
			var peer_max_const = s3torrent.torrent.protocol.peer_max_const;
			if ((peer_max_count * process_count) > peer_max_const) {
				peer_max_count = Math.ceil(peer_max_const / process_count);
			}
		}
		if (peer_max_count < 5) {
			peer_max_count = 5;
		}
	}
	return peer_max_count;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.history_save = function(torrent) {
	if (torrent.metadata.is_removed) { return; }

	var time = new Date().getTime();
	[ torrent.metadata.download_speed, torrent.download_speed_data ] = s3torrent.utils.calculate_speed(torrent.download_speed_data);
	s3torrent.torrent.update_toolbar_text();

	if (s3torrent.torrent.check_stop_status(torrent)) {
		torrent.metadata.end_time = time;
	}
	if ((! torrent.history_save_time) || (torrent.metadata.is_stopped)) {
		torrent.history_save_time = 0;
	}
	if ((torrent.history_save_time + 1000) < time) {
		torrent.history_save_time = time;
		s3torrent.history.set_history(torrent.metadata.s3torrent_id, torrent.metadata);
		s3torrent.utils.notify_observers(null, "s3torrent-change", torrent.metadata.s3torrent_id);
	}
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.history_remove = function(torrent_id, force) {
	var torrent = s3torrent.torrent.downloads[torrent_id];
	if (torrent) {
		torrent.metadata.is_removed = true;
		s3torrent.torrent.download_stop(torrent);
		if (force || (! torrent.metadata.is_completed)) {
			s3torrent.file.delete_data(torrent, force);
		}
		delete s3torrent.torrent.downloads[torrent_id];
		torrent = null;
	}
	s3torrent.history.remove_history(torrent_id);
	s3torrent.torrent.update_toolbar_text();
	s3torrent.utils.notify_observers(null, "s3torrent-remove", torrent_id);
	return true;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.doCommand = function(torrent_id, cmd, params) {
	var torrent = s3torrent.torrent.downloads[torrent_id];
	if (! torrent) {
		switch (cmd) {
			case 'get_torrent_id_list':
				return s3torrent.torrent.downloads;
				break; 
			case 'cmd_stop_all':
				s3torrent.torrent.action_stop('all');	
				break; 
			case 'cmd_start_all':
				s3torrent.torrent.action_start('all');	
				break; 
		}
		return; 
	}

	var name = torrent.metadata.info.name;
	switch (cmd) {
		case 'downloadsCmd_pauseResume':
			if (torrent.metadata.is_stopped) {
				s3torrent.torrent.action_start(torrent_id);
			} else {
				s3torrent.torrent.action_stop(torrent_id);
			}
			break; 
		case 'downloadsCmd_cancel':
			s3torrent.torrent.history_remove(torrent_id);
			s3torrent.utils.notification_box(name, s3torrent.utils.get_string('download.canceled'));
			break; 
		case 'cmd_delete':
			s3torrent.torrent.history_remove(torrent_id);
			s3torrent.utils.notification_box(name, s3torrent.utils.get_string('download.deleted'));
			break; 
		case 'downloadsCmd_retry':
			s3torrent.torrent.download_stop(torrent);
			s3torrent.file.delete_data(torrent, true);
			if (params.save_dir) {
				torrent.metadata.save_dir = params.save_dir;
			}
			torrent.metadata.is_completed = false;
			s3torrent.torrent.action_start(torrent_id);
			break; 
		case 'cmd_delete_files':
			torrent.metadata.is_completed = false;
			s3torrent.torrent.history_remove(torrent_id, true);
			s3torrent.utils.notification_box(name, s3torrent.utils.get_string('download.deleted'));
			break; 
		case 'downloadsCmd_show':
			var dir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			try {
				dir.initWithPath(torrent.metadata.save_dir);
				dir.reveal();
			} catch(e) {
			}
			break; 
		case 'downloadsCmd_open':
			if (torrent.metadata.file_list.length == 1) {
				params = { 'file_id' : 0 };
			}

			if (params) {
				if (! s3torrent.file.open_file(torrent, params.file_id)) {
					s3torrent.utils.alert(s3torrent.utils.get_string("fileNotFound"));
				}
			} else {
				var dir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
				try {
					dir.initWithPath(torrent.metadata.save_dir);
					dir.append(name);
					dir.reveal();
				} catch(e) {
				}
			}
			break; 
		case 'get_magnet_link':
			var magnet_url = 'magnet:?xt=urn:btih:' + torrent.metadata.hashhexlower + '&tr=' + s3torrent.utils.urlencode(torrent.metadata.announce);
			return magnet_url;
			break; 
		case 'get_torrent_data':
			return torrent;
			break; 
		case 'get_peer_count':
			var result = s3torrent.torrent.get_peer_count(torrent);
			return [ result.all, result.work ];
			break; 
		case 'get_tracker_list':
			var tracker_list = [];
			for (var tracker_key in torrent.metadata.announce_list) {
				var tracker = torrent.metadata.announce_list[tracker_key];
				var peer_count = 0;
				var is_error = false;
				var tracker_torrent = torrent.tracker[tracker_key];
				if (tracker_torrent) {
					peer_count = (tracker_torrent.peer_list) ? tracker_torrent.peer_list.length : 0;
					is_error = tracker_torrent.is_error;
				}
				tracker_list.push({ 'url' : tracker.url, 'peer_count' : peer_count, 'is_error' : is_error });
			}
			return tracker_list;
			break; 
		case 'set_tracker_list':
			if (! s3torrent.torrent.check_stop_status(torrent)) { break; }
			torrent.metadata.announce_list = {};
			var tracker_id = 0;
			for (var tracker_url of params.tracker_list) {
				tracker_url = tracker_url.replace(/^\s+|\s+$/g, '');
				if (tracker_url != '') {
					torrent.metadata.announce_list['tracker_id_' + tracker_id] = { 'url' :tracker_url };
					tracker_id++;
				}
			}
			s3torrent.torrent.history_save(torrent);
			break; 
		case 'get_peer_list':
			var peer_list = [];
			for (var peer_key in torrent.peer_work_list) {
				if (torrent.peer_work_list[peer_key] && torrent.peer[peer_key]) {
					var peer = torrent.peer[peer_key];
//					if (peer.peer_percent > 0) {
						peer_list.push(peer.get_info());
//					}
				}
			}
			peer_list = (peer_list.length > 0) ? peer_list.sort( function(a,b) { return a.peer_speed < b.peer_speed }) : peer_list;
			return peer_list;
			break; 
		case 'get_httpseed_list':
			var httpseed_list = [];
			if (torrent.httpseed && torrent.httpseed.is_work) {
				httpseed_list.push(torrent.httpseed.get_info());
			}
			return httpseed_list;
			break; 
		case 'get_file_list':
			return [].concat(torrent.metadata.file_list);
			break; 
		case 'set_file_status':
			if (torrent.metadata.file_list[params.file_id].status != 'done') {
				torrent.metadata.file_list[params.file_id].status = (params.is_process) ? 'process' : 'skip';
				if (! params.is_all) {
					s3torrent.torrent.calculate_data(torrent, true);
					if (torrent.metadata.is_completed) {
						s3torrent.torrent.download_stop(torrent);
					}
				}
			}
			break;
		case 'set_file_status_all':
			s3torrent.torrent.calculate_data(torrent, true);
			if (torrent.metadata.is_completed) {
				s3torrent.torrent.download_stop(torrent);
			}
			break;
		case 'get_torrent_info_list':
			var result = {
				'torrent_name' : torrent.metadata.info.name,
				'save_dir' : torrent.metadata.save_dir,
				'files_count' : torrent.metadata.file_list.length,
				'total_size' : s3torrent.utils.get_strings_to_KB_MB_GB(torrent.metadata.total_size) + ' (' + s3torrent.utils.numeral3(torrent.metadata.total_size) + ')',
				'progress' : Math.floor((torrent.metadata.downloaded*100)/torrent.metadata.total_size) + '%',
				'hash' : torrent.metadata.hashhexlower,
				'magnet_link' : 'magnet:?xt=urn:btih:' + torrent.metadata.hashhexlower + '&tr=' + s3torrent.utils.urlencode(torrent.metadata.announce),
				'publisher' : torrent.metadata.publisher || '---',
				'publisher_url' : torrent.metadata['publisher-url'] || '',
				'created' : (new Date(torrent.metadata['creation date'] * 1000)).toLocaleString(),
				'error_text' : (torrent.metadata.is_error) ? torrent.metadata.is_error_text : '',
				'comment' : torrent.metadata.comment || '',
				'download_page' : torrent.metadata.referrer_url,
				'download_link' : torrent.metadata.torrent_url
			};
			return result;
			break;
		case 'get_total_size':
			return s3torrent.torrent.calculate_total_size(torrent);
			break;
		case 'get_downloaded_size':
			return s3torrent.torrent.calculate_downloaded_size(torrent);
			break;
		case 'cmd_save_metadata':
			var wm_window = s3torrent.utils.get_window();
			var field_list = ["announce", "announce-list", "comment", "created by", "creation date", "encoding", "info", "publisher", "publisher-url", "httpseeds", "url-list"];
			var metadata = {};
			for (var field of field_list) {
				if (torrent.metadata[field]) {
					metadata[field] = torrent.metadata[field];
				}
			}
			var data_save = new Uint8Array(s3torrent.bencode.encode(metadata));
			if (s3torrent.file.save_metadata(wm_window, torrent, data_save)) {
				s3torrent.utils.notification_box(torrent.metadata.info.name, s3torrent.utils.get_string('metadata.saved'));
			}
			break;
	}
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.request_observer = {
	observe: function (aSubject, aTopic, aData) {
		//-----------------------------------------------------------------------
		if (aTopic == 's3torrent-magnet-open-url') {
			var aURI = aSubject.QueryInterface(Components.interfaces.nsIURI);
			if (! aURI) { return; }

			var url = aURI.spec;
			if (/urn\:btih\:[\w\d]{32}/.test(url) && s3torrent.utils.prefs.getBoolPref('magnet_uri_association')) {
				s3torrent.utils.add_new_torrent({ 'data' : url, 'is_url' : true, 'referrer_url' : '' });
			} else {
				try {
					var expsvb = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].getService(Components.interfaces.nsIExternalProtocolService);
					if (expsvb.externalProtocolHandlerExists('magnet')) {
						var dload = Components.classes["@mozilla.org/content-dispatch-chooser;1"].getService(Components.interfaces.nsIContentDispatchChooser);
						dload.ask(expsvb.getProtocolHandlerInfo('magnet'), null, aURI, null);
					}
				} catch(e) {
				}
			}
		}
		//-----------------------------------------------------------------------
		else if (aTopic == 's3torrent-add-new-torrent') {
			var params = aSubject.wrappedJSObject;
			s3torrent.utils.add_new_torrent_run(params);
		}
		//-----------------------------------------------------------------------
		else if (aTopic == 'http-on-examine-response' ) {
			var is_torrent = s3torrent.utils.prefs.getBoolPref('torrent_file_association');
			var is_magnet = s3torrent.utils.prefs.getBoolPref('magnet_uri_association');
			if (! is_torrent && ! is_magnet) { return; }

			try {
				var httpChannel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
				if (! httpChannel) { return; }
				if (! s3torrent.torrent.check_httpChannel_window(httpChannel)) { return; }

				var url = httpChannel.URI.spec;
				var content_type = httpChannel.getResponseHeader("Content-Type");
				var referrer_url = (httpChannel.referrer && httpChannel.referrer.spec) ? httpChannel.referrer.spec : '';

				if ((is_torrent && content_type.indexOf("x-bittorrent") != -1) || (is_magnet && content_type.indexOf("magnet") != -1)) {
					httpChannel.cancel(Components.results.NS_BINDING_ABORTED);
					s3torrent.utils.add_new_torrent({ 'data' : url, 'is_url' : true, 'referrer_url' : referrer_url });
				}
				else if ((is_torrent && /^[^\?]+\.torrent$/.test(url)) || (is_magnet && /^magnet\:/.test(url))) {
					httpChannel.cancel(Components.results.NS_BINDING_ABORTED);
					s3torrent.utils.add_new_torrent({ 'data' : url, 'is_url' : true, 'referrer_url' : referrer_url });
				}
			} catch(e) {
			}
		}
		//-----------------------------------------------------------------------
		else if(aTopic == 'http-on-modify-request') {
			var is_torrent = s3torrent.utils.prefs.getBoolPref('torrent_file_association');
			var is_magnet = s3torrent.utils.prefs.getBoolPref('magnet_uri_association');
			if (! is_torrent && ! is_magnet) { return; }

			try {
				var httpChannel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
				if (! httpChannel) { return; }
				if (! s3torrent.torrent.check_httpChannel_window(httpChannel)) { return; }

				var url = httpChannel.URI.spec;
				var referrer_url = (httpChannel.referrer && httpChannel.referrer.spec) ? httpChannel.referrer.spec : '';

				if ((is_torrent && /^[^\?]+\.torrent$/.test(url)) || (is_magnet && /^magnet\:/.test(url))) {
					httpChannel.cancel(Components.results.NS_BINDING_ABORTED);
					s3torrent.utils.add_new_torrent({ 'data' : url, 'is_url' : true, 'referrer_url' : referrer_url });
				}
			} catch(e) {
			}
		}
		//-----------------------------------------------------------------------
		else if(aData == 'torrent.peer_max_count') {
			s3torrent.torrent.protocol.peer_max_count = s3torrent.utils.prefs.getIntPref('torrent.peer_max_count', 20);
			if (s3torrent.torrent.protocol.peer_max_count > s3torrent.torrent.protocol.peer_max_const) {
				s3torrent.torrent.protocol.peer_max_count = s3torrent.torrent.protocol.peer_max_const;
				s3torrent.utils.prefs.setIntPref('torrent.peer_max_count', s3torrent.torrent.protocol.peer_max_const);
			}
		}
		//-----------------------------------------------------------------------
		else if(aData == 'torrent.data_max_buffer') {
			s3torrent.torrent.protocol.data_max_buffer = s3torrent.utils.prefs.getIntPref('torrent.data_max_buffer');
		}
		//-----------------------------------------------------------------------
		else if(aData == 'show_counter_in_toolbarbutton') {
			s3torrent.torrent.update_toolbar_text();
		}
	}
};
//-----------------------------------------------------------------------------------
s3torrent.torrent.check_httpChannel_window = function(httpChannel) {
	//-----------------------------------------------------------------------
	var loadContext, associatedWindow;
	try {
		var interfaceRequestor = httpChannel.notificationCallbacks.QueryInterface(Components.interfaces.nsIInterfaceRequestor);
		loadContext = interfaceRequestor.getInterface(Components.interfaces.nsILoadContext);
	} catch (ex) {
		try {
			loadContext = httpChannel.loadGroup.notificationCallbacks.getInterface(Components.interfaces.nsILoadContext);
		} catch (ex2) {
			loadContext = null;
		}
     	}
	//-----------------------------------------------------------------------
	if (loadContext) {
		// On e10s (multiprocess, aka electrolysis) Firefox,
		// loadContext.topFrameElement gives us a reference to the XUL <browser>
		// element we need. However, on non-e10s Firefox, topFrameElement is null.
		if (loadContext.topFrameElement) {
			associatedWindow = loadContext.topFrameElement.contentWindow;
		}
		try {
			// If loadContext is an nsDocShell, associatedWindow is present.
			// Otherwise, if it's just a LoadContext, accessing it will throw
			// NS_ERROR_UNEXPECTED.
			associatedWindow = loadContext.associatedWindow;
		} catch (e) {
		}
	}
	if (associatedWindow) {
		return true;
	}
	return false;
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.request_observer_init = function() {
	var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
	observerService.addObserver(s3torrent.torrent.request_observer, 's3torrent-magnet-open-url', false);
	observerService.addObserver(s3torrent.torrent.request_observer, 's3torrent-add-new-torrent', false);
	observerService.addObserver(s3torrent.torrent.request_observer, 'http-on-examine-response', false);
	observerService.addObserver(s3torrent.torrent.request_observer, 'http-on-modify-request', false);

	try {
		if (!("addObserver" in s3torrent.utils.prefs)) {
			s3torrent.utils.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		}
		s3torrent.utils.prefs.addObserver("", s3torrent.torrent.request_observer, false);
	} catch(e) {
	}
}
//-----------------------------------------------------------------------------------
s3torrent.torrent.update_toolbar_text = function() {
	try {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
		var e = wm.getEnumerator("navigator:browser");

		var process_count = 0;
		var complete_count = 0;
		var is_error = false;
		var is_stop = true;
		var show_counter = s3torrent.utils.prefs.getBoolPref('show_counter_in_toolbarbutton');

		for (var torrent_key in s3torrent.torrent.downloads) {
			var torrent = s3torrent.torrent.downloads[torrent_key];
			if (torrent) {
				if (torrent.metadata.is_completed) {
					complete_count++;
				} else {
					process_count++;
				}
				if (torrent.metadata.is_error) {
					is_error = true;
				}
				if (! s3torrent.torrent.check_stop_status(torrent)) {
					is_stop = false;
				}
			}
		}

		while (e.hasMoreElements()) {
			var win = e.getNext();
			var button_text = win.document.getElementById('s3torrent_toolbar_button_text');
			var button_image = win.document.getElementById('s3torrent_toolbar_button');
			if (button_text) {
				if (show_counter && (process_count || complete_count)) {
					button_text.hidden = false;
					button_text.value = process_count + ':' + complete_count;
				} else {
					button_text.hidden = true;
				}
			}
			if (button_image) {
				button_image.setAttribute('tooltiptext', s3torrent.utils.get_string('extensions.s3torrent@tornado.name') + ' (' + process_count + ':' + complete_count + ')');

				button_image.removeAttribute('is_error');
				button_image.removeAttribute('is_stop');
				if (is_error) {
					button_image.setAttribute('is_error', true);
				}
				else if (is_stop) {
					button_image.setAttribute('is_stop', true);
				}
			}
		}
	} catch (e){
	}
	return;
}
//-----------------------------------------------------------------------------------
