// http://www.bittorrent.org/beps/bep_0017.html
// http://www.bittorrent.org/beps/bep_0019.html

this.EXPORTED_SYMBOLS = [ "HTTPSeeds" ];

var s3torrent = {};
Components.utils.import("resource://s3torrent/utils.js", s3torrent);
Components.utils.import("resource://s3torrent/bencode.js", s3torrent);

//-----------------------------------------------------------------------------------
s3torrent.HTTPSeeds = function(torrent, url_list, protocol, callback) {
	this.url_list = url_list;
	this.torrent = torrent;
	this.protocol = protocol;
	this.timeout_id = null;
	this.callback = callback;
	this.download_speed = 0;
	this.download_speed_data = [];
	this.piece_have = {};
	this.piece_download = {};
	this.is_work = true;
	this.host = '';
	this.port = '';
	this.request_count = -1;
	this.request_count_max = 3;

	for (var i =0; i<this.torrent.metadata.piece_count; i++) {
		this.piece_have['piece_' + i] = 1;
	}
}

this.HTTPSeeds = s3torrent.HTTPSeeds;

//-----------------------------------------------------------------------------------
s3torrent.HTTPSeeds.prototype = {
	//-----------------------------------------------------------------------------
	on_timeout : function() {
		this.connect_close(false);
	},
	//-----------------------------------------------------------------------------
	get_info : function() {
		[ this.download_speed, this.download_speed_data ] = s3torrent.utils.calculate_speed(this.download_speed_data);

		var info = {
			'peer_ip_port' : this.host + ':' + this.port,
			'peer_client_name' : 'HTTP Seed',
			'peer_percent' : '100',
			'peer_speed' : this.download_speed
		};
		return info;
	},
	//-----------------------------------------------------------------------------
	connect_close : function(is_ok) {
		if (this.callback) {
			this.callback(is_ok, this, this.torrent);
			this.callback = null;
		}
		if (this.timeout_id) {
			try {
			} catch(e) {
				s3torrent.utils.clearTimeout( this.timeout_id );
			}
		}
		this.is_work = false;
	},
	//-----------------------------------------------------------------------------
	request: function() {
		if (! this.is_work) {
			return;
		}
		if (this.url_list.length == 0) {
			this.connect_close(true);
			return;
		}
		if (this.request_count > this.request_count_max) {
			return;
		}
		//----------------------------------------------------------------------
		var _this = this;
		var result = this.protocol.get_piece_request(this.torrent, this.piece_have, 0);
		if (result.action == 'cancel') {
			if (this.request_count <= 0) {
				this.connect_close(false);
			}
			return;
		}
		else if (result.action != 'download') {
			this.connect_close(false);
			return;
		}
		else if (this.piece_download[result.piece_id + '-' + result.chunk_offset]) {
			return;
		}

		//----------------------------------------------------------------------
		result.start_time = new Date().getTime();
		var ranges_end = result.chunk_offset + result.chunk_size;

		var xhr = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Components.interfaces.nsIXMLHttpRequest);
		xhr.mozBackgroundRequest = true;

		var url = this.url_list[Math.floor(Math.random()*this.url_list.length)];

		var parsedUrl = s3torrent.utils.parse_uri(url);
		this.host = parsedUrl.host;
		this.port = parseInt(parsedUrl.port) || 80;

		url += (url.indexOf('?') == -1) ? '?' : '&';
		url += 'info_hash=' + s3torrent.utils.urlencode(s3torrent.utils.ui82str(this.torrent.metadata.hashbytes));
		url += '&piece=' + result.piece_id;
		url += '&ranges=' + result.chunk_offset + '-' + ranges_end;

		try {
			xhr.open("GET", url, true);
		} catch(e) {
			_this.connect_close(false);
			return;
		}
		xhr.timeout = 10000;
		xhr.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
		xhr.responseType = "arraybuffer";
		xhr.onload = function(evt) {
			s3torrent.utils.clearTimeout( _this.timeout_id );
			_this.on_response(evt.target.response, result.piece_id, result.chunk_offset);
		}
		xhr.onerror = function(evt) {
			_this.connect_close(false);
		}
		xhr.onprogress = function(evt) {
			if (evt.loaded > result.chunk_size) {
				xhr.abort();
				_this.connect_close(false);
			}
		}

		var range = result.piece_id * this.torrent.metadata.piece_length + result.chunk_offset;

//		xhr.setRequestHeader('Status', '206 Partial content');
		xhr.setRequestHeader('User-Agent', 'BitComet/1.37.12.31');
//		xhr.setRequestHeader('Accept-Ranges', 'bytes');
//		xhr.setRequestHeader('Content-Range', 'bytes ' + range + '-' + (range + result.chunk_size - 1) + '/' + (range + result.chunk_size));
		xhr.setRequestHeader('Range', 'bytes='  + range + '-' + (range + result.chunk_size - 1)); // the bytes (incl.) you request

		this.timeout_id = s3torrent.utils.setTimeout(function() { _this.connect_close(false) }, 10000);
		this.request_count++;
		this.piece_download[result.piece_id + '-' + result.chunk_offset] = result;
		xhr.send(null);
	},
	//-----------------------------------------------------------------------------
	on_response: function(payload, piece_id, chunk_offset) {
		s3torrent.utils.clearTimeout( this.timeout_id );
	        var data = new Uint8Array(payload);
		var is_done = false;

		var result = this.piece_download[piece_id + '-' + chunk_offset];

		if ((result && result.chunk_size == data.byteLength)) {
			result.end_time = new Date().getTime();
			var download_time = result.end_time - result.start_time;
			[ this.download_speed, this.download_speed_data ] = s3torrent.utils.calculate_speed(this.download_speed_data, result);
			is_done = true;
		} else {
			data = null;
			_this.connect_close(false);
			return;
		}
		this.protocol.set_piece_request(this.torrent, result, is_done, data);
		payload = null;
		data = null;

		this.request_count--;
		if (this.request_count < 0) {
			this.request_count = 0;
		}

		this.piece_download[result.piece_id + '-' + result.chunk_offset] = null;
		delete this.piece_download[result.piece_id + '-' + result.chunk_offset];

		this.request();
	}
}
//---------------------------------------------------------------------------------
