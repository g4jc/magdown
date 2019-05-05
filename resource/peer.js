this.EXPORTED_SYMBOLS = [ "Peer" ];

var s3torrent = {};
Components.utils.import("resource://s3torrent/bencode.js", s3torrent);
Components.utils.import("resource://s3torrent/buffer.js", s3torrent);
Components.utils.import("resource://s3torrent/utils.js", s3torrent);
Components.utils.import("resource://s3torrent/digest.js", s3torrent);
Components.utils.import("resource://s3torrent/TCPSocket.js", s3torrent);

//-----------------------------------------------------------------------------------
s3torrent.Peer = function(torrent, peer_key, protocol) {
	this.torrent = torrent;
	this.peer_key = peer_key;
	this.tcpSocket = null;
	this.callback = null;
	this.socket_open = false;
	this.peer_client_name = '---';
	this.peer_client_id = null;
	this.protocol = protocol;
	this.peer_is_start = false;
	this.peer_is_handshake = false;
	this.peer_is_bitfield = false;
	this.peer_is_request = false;
	this.am_interested = false;
	this.am_unchoking = false;
	this.piece_have = {};
	this.piece_download = {};
	this.peer_interval = null;
	this.peer_timeout = null;
	this.peer_timeout_count = 5000;
	this.download_speed = 0;
	this.download_speed_data = [];
	this.buffer_read = new s3torrent.Buffer();
	this.is_get_magnet = false;
	this.is_get_magnet_count = 0;
	this.request_count = -1;
	this.request_count_max = 3;
	this.request_check = true;
	this.peer_percent = 0;

	for (var i =0; i<this.torrent.metadata.piece_count; i++) {
		this.piece_have['piece_' + i] = 0;
	}
//	this.set_timeout();
}

this.Peer = s3torrent.Peer;

//-----------------------------------------------------------------------------------
s3torrent.Peer.prototype = {
	//-----------------------------------------------------------------------------
	set_timeout : function() {
		this.clear_timeout();
		var _this = this;
		this.peer_timeout = s3torrent.utils.setTimeout(function() { _this.socket_close(false); }, this.peer_timeout_count);
		return;
	},
	//-----------------------------------------------------------------------------
	clear_timeout : function() {
		if (this.peer_timeout != null) {
			s3torrent.utils.clearTimeout(this.peer_timeout);
			this.peer_timeout = null;
		}
	},
	//-----------------------------------------------------------------------------
	check_interval : function() {
		var _this = this;
		this.buffer_check();
		this.make_request();
		this.peer_interval = s3torrent.utils.setTimeout(function() { _this.check_interval(true); }, 500);
	},
	//-----------------------------------------------------------------------------
	clear_interval : function() {
		if (this.peer_interval != null) {
			s3torrent.utils.clearTimeout(this.peer_interval);
			this.peer_interval = null;
		}
	},
	//-----------------------------------------------------------------------------
	get_info : function() {
		[ this.download_speed, this.download_speed_data ] = s3torrent.utils.calculate_speed(this.download_speed_data);

		var info = {
			'peer_ip_port' : this.peer_key,
			'peer_client_name' : this.peer_client_name,
			'peer_percent' : this.peer_percent,
			'peer_speed' : this.download_speed
		};
		return info;
	},
	//-----------------------------------------------------------------------------
	socket_send : function(data) {
		try{
			this.set_timeout();
			var is_send = this.tcpSocket.send(data);
			if (! is_send) {
				this.socket_close(false);
			}
		} catch(e) {
			this.socket_close(false);
		}
	},
	//-----------------------------------------------------------------------------
	socket_close : function(is_ok) {
		if (this.callback) {
			this.callback(is_ok, this, this.torrent);
			this.callback = null;
		}
		if (this.socket_open) {
			try {
				this.tcpSocket.close();
			} catch(e) {
			}
		}
		this.socket_open = false;
		this.socket_clean();
	},
	//-----------------------------------------------------------------------------
	socket_clean : function() {
		this.buffer_read.clear();
		this.clear_interval();
		this.clear_timeout();
		delete this.torrent;
		this.piece_have = {};
	},
	//-----------------------------------------------------------------------------
	on_error : function(event) {
		this.socket_close(false);
	},
	//-----------------------------------------------------------------------------
	on_close : function(event) {
		this.peer_is_start = false;
//		this.tcpSocket = null;
		this.socket_close(false);
	},
	//-----------------------------------------------------------------------------
	on_data : function(readResult) {
		if (! this.peer_is_start) { return false; }
		if (readResult.data.byteLength == 0) { return; }
		this.set_timeout();
		//-----------------------------------------------------------------------
		if (this.peer_is_handshake) {
			this.buffer_read.add(readResult.data);
			this.buffer_check();
		}
		//-----------------------------------------------------------------------
		else {
			this.on_HANDSHAKE(readResult);
		}
	},
	//-----------------------------------------------------------------------------
	buffer_check : function() {
		var data = this.buffer_read.get();
		while (data != null) {
			var resp = this.parse_response(data);
			this.response_selector(resp.type, resp.payload);
			resp = null;
			data = this.buffer_read.get();
		}
	},
	//-----------------------------------------------------------------------------
	parse_response : function(buf) {
		var data = {}
		var msgsz = new DataView(buf, 0, 4).getUint32(0);
		if (msgsz == 0) {
			data.type = 'KEEPALIVE'
		} else {
			data.code = new Uint8Array(buf, 4, 1)[0];
			var message = this.protocol.message_codes[data.code];
			data.type = message;
			data.payload = buf;
		}
		return data;
	},
	//-----------------------------------------------------------------------------
	set_payload: function(type, payloads) {
		if (! payloads) { payloads = [] }
		var payloadsz = 0;
		for (var i=0; i<payloads.length; i++) {
			payloadsz += payloads[i].byteLength;
		}
		var b = new Uint8Array(payloadsz + 5);
		var v = new DataView(b.buffer, 0, 5);
		v.setUint32(0, payloadsz + 1); // this plus one is important :-)
		v.setUint8(4, this.protocol.message_names[type]);
		var idx = 5;
		for (var i=0; i<payloads.length; i++) {
			b.set( new Uint8Array(payloads[i]), idx );
			idx += payloads[i].byteLength;
		}
		return b.buffer;
	},
	//-----------------------------------------------------------------------------
	response_selector : function(type, payload) {
		switch (type) {
			case 'KEEPALIVE':
				break; 
			case 'CHOKE':
				this.am_unchoking = false;
				this.socket_close(false);
				break; 
			case 'UNCHOKE':
				this.am_unchoking = true;
				break; 
			case 'INTERESTED':
				this.on_INTERESTED(payload);
				break; 
			case 'REQUEST':
				this.on_REQUEST(payload);
				break; 
			case 'UTORRENT_MSG':
				this.on_UTORRENT_MSG(payload);
				break; 
			case 'BITFIELD':
				this.on_BITFIELD(payload);
				break; 
			case 'HAVE':
				this.on_HAVE(payload);
				break; 
			case 'HAVE_ALL':
				this.on_HAVE_ALL(payload);
				break; 
			case 'HAVE_NONE':
			case 'REJECT_REQUEST':
				this.socket_close(false);
				break; 
			case 'PIECE':
				this.on_PIECE(payload);
				break; 
			default:
				s3torrent.utils.console_log('= S3.Torrent => unknown type : ' + type);
				break;
		}
		payload = null;
		this.make_request();
	},
	//-----------------------------------------------------------------------------
	make_request : function() {
		if (! this.peer_is_start) { return false; }
		if (! this.peer_is_handshake) { return false; }
		if (this.is_get_magnet) { return false; }
		if (! this.peer_is_bitfield) {
			this.send_bitfield();
			return false;
		}
		if (! this.am_interested) {
			this.am_interested = true;
			var payload = this.set_payload('INTERESTED');
			this.socket_send(payload);
			return false;
		}
		if (this.am_unchoking) {
			if (this.request_count <= this.request_count_max) {
				this.peer_timeout_count = 15000;
				this.set_timeout();
				this.send_request_pieces();
			}
		}
	},
	//-----------------------------------------------------------------------------
	handshake : function(ip, port, callback) {
		this.set_timeout();
		var _this = this;
		this.callback = callback;
//		var baseSocket = Components.classes["@mozilla.org/tcp-socket;1"].createInstance(Components.interfaces.nsIDOMTCPSocket);
		var baseSocket = new s3torrent.TCPSocket();
		this.tcpSocket = baseSocket.open(ip, port, { binaryType: 'arraybuffer' });
		this.socket_open = true;
		this.tcpSocket.onopen = function(e) { _this.send_handshake(e); }
		this.tcpSocket.ondata = function(e) { _this.on_data(e); }
		this.tcpSocket.onerror = function(e) { _this.on_error(e); }
		this.tcpSocket.onclose = function(e) { _this.on_close(e); }
		this.check_interval();
	},
	//-----------------------------------------------------------------------------
	send_handshake : function(e) {
		if (! this.torrent) {
			this.socket_close(false);
			return;
		}
		// handshake: <pstrlen><pstr><reserved><info_hash><peer_id> 
		var bytes = []
		bytes.push( this.protocol.protocol_name.length );
		for (var i=0; i<this.protocol.protocol_name.length; i++) {
			bytes.push( this.protocol.protocol_name.charCodeAt(i) )
		}
		bytes = bytes.concat( this.protocol.handshake_flags );
		bytes = bytes.concat( this.torrent.metadata.hashbytes );
		bytes = bytes.concat( s3torrent.utils.get_peerid_bytes() );
		var payload = new Uint8Array( bytes ).buffer;
		this.peer_is_start = true;
		this.socket_send(payload);
	},
	//-----------------------------------------------------------------------------
	send_handshake_ext: function() {
		var _this = this;
		var data = {
			v: this.protocol.client_name,
//			p: 6666, // our listening port
			m: this.protocol.extension_messages,
//			'upload_only': 1
		};
		if (this.torrent.metadata.info_buffer) {
			data.metadata_size = this.torrent.metadata.info_buffer.byteLength;
		}

		var arr = new Uint8Array(s3torrent.bencode.encode( data )).buffer;
		var payload = this.set_payload('UTORRENT_MSG', [new Uint8Array([0]).buffer, arr]);
		this.socket_send(payload);
	},
	//-----------------------------------------------------------------------------
	send_bitfield: function() {
		this.peer_is_bitfield = true;
		var numPieces = this.torrent.metadata.piece_count;
		var maxi = Math.ceil(numPieces/8);
		var arr = [];

		for (var i=0; i<maxi; i++) {
			var curByte = 0;
			var idx = 8*i;
			for (var j=7; j>=0; j--) {
				if (idx < numPieces) {
					var is_have = this.torrent.piece_hash['piece_' + idx].completed ? 1 : 0;
					curByte = (curByte | (is_have << j));
				}
				idx++;
			}
			arr.push(curByte);
		}
		var payload = this.set_payload('BITFIELD' ,[new Uint8Array(arr).buffer]);
		this.socket_send(payload);
	},
	//-----------------------------------------------------------------------------
	send_request_pieces: function() {
		this.percent = s3torrent.utils.calculate_percent(this.piece_have)
		if ((this.request_count >= 0) && this.request_check) {
			return;
		}
		if (this.request_count > this.request_count_max) {
			return;
		}

		var result = this.protocol.get_piece_request(this.torrent, this.piece_have, 0);
		if (result.action == 'cancel') {
			if (this.request_count <= 0) {
				this.socket_close(false);
				return;
			}
		}
		else if (result.action != 'download') {
			return;
		}
		else if (this.piece_download[result.piece_id + '-' + result.chunk_offset]) {
			return;
		}

		var payload = new Uint8Array(12);
		var v = new DataView(payload.buffer);
		v.setUint32(0, result.piece_id);
		v.setUint32(4, result.chunk_offset);
		v.setUint32(8, result.chunk_size);

		result.start_time = new Date().getTime();
		this.piece_download[result.piece_id + '-' + result.chunk_offset] = result;
		var payload_req = this.set_payload('REQUEST', [payload.buffer]);
		this.request_count++;
		this.socket_send(payload_req);
//		if ((this.request_count > 0) && (this.request_count <= this.request_count_max)) {
//			this.send_request_pieces();
//		}
	},
	//-----------------------------------------------------------------------------
	on_HANDSHAKE : function(readResult) {
		var _this = this;
		if (readResult.data.byteLength == 0) {
			this.socket_close(false);
			return;
		}

		var buf = readResult.data;
		var sofar = 0;
		var v = new DataView(buf, 0, 1);
		sofar += 1;
		if (v.getUint8(0) == this.protocol.protocol_name.length) {
			if (s3torrent.utils.ui82str( new Uint8Array(buf, 1, this.protocol.protocol_name.length) ) == this.protocol.protocol_name) {
				try {
					sofar += this.protocol.protocol_name.length;
					var reserved = new Uint8Array(buf,sofar,8); // reserved bytes
					sofar += 8;
					var infohash = new Uint8Array(buf,sofar,20); // infohash
					sofar += 20;
					this.peer_client_id = new Uint8Array(buf,sofar,20); // peer id
					this.peer_client_name = s3torrent.utils.get_peerclient_name(s3torrent.utils.ui82str(this.peer_client_id));
					if (s3torrent.utils.bytes_to_hex_string(s3torrent.utils.ui82str(infohash)) == this.torrent.metadata.hashhexlower) {
						this.peer_is_handshake = true;
						if (readResult.data.byteLength > this.protocol.handshake_length) {
							var data = buf.slice(this.protocol.handshake_length);
							this.buffer_read.add(data);
							this.buffer_check();
						}
						if ((reserved[5] & 0x10) != 0) {
							this.send_handshake_ext();
						} else if (this.is_get_magnet) {
							this.socket_close(false);
							return;
						}
						this.make_request();
						return;
					}
				} catch(e) {
				}
			}
		}
		this.socket_close(false);
	},
	//-----------------------------------------------------------------------------
	on_UTORRENT_MSG: function(payload) {
		//-- handshake_ext ----------------------------------------------
		var msg_code = new DataView(payload, 5, 1).getUint8(0);

		//-----------------------------------------------------------------------
		//-- client_name
		//-----------------------------------------------------------------------
		if (msg_code == 0) {
			var handshake_ext = s3torrent.bencode.decode(s3torrent.utils.ui82str(new Uint8Array(payload, 6)), { utf8:true });
			if (handshake_ext.v) {
				this.peer_client_name = handshake_ext.v;
			}
			//----------------------------------------------------------------
			if (this.is_get_magnet && handshake_ext.m && handshake_ext.m.ut_metadata && handshake_ext.metadata_size) {
				this.magnet_info_ext = handshake_ext;
				var metadata_size = handshake_ext.metadata_size;
				var num_chunks = Math.ceil( metadata_size / this.protocol.piece_size );
				this.metadata_response_list = new Array(num_chunks);
				for (var i=0; i<num_chunks; i++) {
					var d = {
						'piece' : i,
						'msg_type' : 0,
						'total_size' : metadata_size
					};
					var code = handshake_ext.m.ut_metadata;
					var payload_send = this.set_payload('UTORRENT_MSG', [new Uint8Array([code]).buffer, new Uint8Array(s3torrent.bencode.encode(d)).buffer]);
					this.socket_send(payload_send);
				}
			}
		}
		//-----------------------------------------------------------------------
		//-- ut_metadata
		//-----------------------------------------------------------------------
		else if ((msg_code == 2) && (this.is_get_magnet)) {
			var ext_message = s3torrent.bencode.decode(s3torrent.utils.ui82str(new Uint8Array(payload, 6)));
			if (ext_message.msg_type == 1) {
				var data_start_idx = s3torrent.bencode.encode(ext_message).length;
				var infodict_chunk_data = new Uint8Array(payload, 6 + data_start_idx);
				var infodict_chunk_num = ext_message.piece;
				this.metadata_response_list[infodict_chunk_num] = infodict_chunk_data;
				var is_complete = true;
				for (var data of this.metadata_response_list) {
					if (! data) {
						is_complete = false;
						break;
					}
				}
				if (is_complete) {
					var b = new Uint8Array(this.magnet_info_ext.metadata_size);
					var idx = 0;
					for (var data of this.metadata_response_list) {
						b.set( data, idx );
						idx += data.byteLength;
					}
					var infodict = s3torrent.bencode.decode(s3torrent.utils.ui82str(b), { utf8:true });
					var sha1_hash = s3torrent.digest.checksum_buffer([s3torrent.bencode.encode(infodict)], 'SHA1');
					if (sha1_hash.text == this.torrent.metadata.hashhexlower) {
						this.torrent.metadata.info = infodict;
						this.socket_close(true);
					} else {
						this.socket_close(false);
					}
				}
			}
		}
		//-----------------------------------------------------------------------
		//-- ut_pex
		//-----------------------------------------------------------------------
		else if (msg_code == 3) {
			var ext_message = s3torrent.bencode.decode(s3torrent.utils.ui82str(new Uint8Array(payload, 6)));
			if (ext_message.added) {
				var peer_data = ext_message.added;
				var num_peers = peer_data.length/6;
				for (var i=0; i<num_peers; i++) {
					var idx = 6*i;
					var host = [peer_data.charCodeAt( idx ), peer_data.charCodeAt( idx+1 ), peer_data.charCodeAt( idx+2 ), peer_data.charCodeAt( idx+3 )].join('.');
					var port = peer_data.charCodeAt( idx+4 ) * 256 + peer_data.charCodeAt( idx+5 );
					if (this.callback) {
						this.callback(true, this, this.torrent, { 'ip' : host, 'port' : port });
					}
				}
        		}
		}

	},
	//-----------------------------------------------------------------------------
	on_HAVE: function(payload) {
		var idx = new DataView(payload,5,4).getUint32(0);
		this.piece_have['piece_' + idx] = 1;
		this.peer_percent = s3torrent.utils.calculate_percent(this.piece_have);
	},
	//-----------------------------------------------------------------------------
	on_HAVE_ALL: function(payload) {
		for (var i =0; i<this.torrent.metadata.piece_count; i++) {
			this.piece_have['piece_' + i] = 1;
		}
		this.peer_percent = s3torrent.utils.calculate_percent(this.piece_have);
	},
	//-----------------------------------------------------------------------------
	on_BITFIELD: function(payload) {
		var bitfield = new Uint8Array(payload, 5);
		for (var i=0; i<bitfield.length; i++) {
			var idx = 8*i;
			for (var j=0; j<8; j++) {
				var bit = Math.pow(2,7-j) & bitfield[i];
				this.piece_have['piece_' + idx] = bit ? 1 : 0;
				if (idx == this.torrent.metadata.piece_count) {
					break;
				}
				idx++;
			}
		}
		this.peer_percent = s3torrent.utils.calculate_percent(this.piece_have);
		if (this.peer_percent == 0) {
			this.socket_close(false);
		}
	},
	//-----------------------------------------------------------------------------
	on_PIECE : function(payload) {
	        var v = new DataView(payload, 5, 12);
	        var piece_id = v.getUint32(0);
	        var chunk_offset = v.getUint32(4);
	        var data = new Uint8Array(payload, 5+8);
		var is_done = false;

		var result = this.piece_download[piece_id + '-' + chunk_offset];

		if ((result && result.chunk_size == data.byteLength)) {
			result.end_time = new Date().getTime();
			var download_time = result.end_time - result.start_time;
			[ this.download_speed, this.download_speed_data ] = s3torrent.utils.calculate_speed(this.download_speed_data, result);
			is_done = true;
			this.peer_is_request = true;
		} else {
			data = null;
		}
		this.protocol.set_piece_request(this.torrent, result, is_done, data);
		payload = null;
		data = null;

		this.request_count--;
		if (this.request_count < 0) {
			this.request_count = 0;
		}
		this.request_check = false;
		this.piece_download[result.piece_id + '-' + result.chunk_offset] = null;
		delete this.piece_download[result.piece_id + '-' + result.chunk_offset];
//		this.make_request();
	},
	on_INTERESTED : function(payload) {
		var payload = this.set_payload('CHOKE');
		this.socket_send(payload);
	},
	on_REQUEST : function(payload) {
		var payload = this.set_payload('CHOKE');
		this.socket_send(payload);
	}
}
//-----------------------------------------------------------------------------------
