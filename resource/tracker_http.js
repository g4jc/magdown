this.EXPORTED_SYMBOLS = [ "HTTPTracker" ];

var s3torrent = {};
Components.utils.import("resource://s3torrent/utils.js", s3torrent);
Components.utils.import("resource://s3torrent/bencode.js", s3torrent);

//-----------------------------------------------------------------------------------
s3torrent.HTTPTracker = function(torrent, url) {
	this.url = url;
	this.parsedUrl = s3torrent.utils.parse_uri(this.url);
	this.host = this.parsedUrl.host;
	this.port = parseInt(this.parsedUrl.port) || 80;
	this.torrent = torrent;
	this.timeout_id = null;
	this.callback = null;
	this.transaction_id = Math.floor(Math.random() * Math.pow(2,32));
	this.connection_id = null;
	this.req_interval = 60;
	this.leechers = 0;
	this.seeders = 0;
	this.peer_list = [];
	this.event = 'started';
}

this.HTTPTracker = s3torrent.HTTPTracker;

//-----------------------------------------------------------------------------------
s3torrent.HTTPTracker.prototype = {
	//-----------------------------------------------------------------------------
	on_timeout : function() {
		if (this.callback) { this.callback(false, this, this.torrent); }
	},
	//-----------------------------------------------------------------------------
	announce: function(event, callback) {
		this.event = event || 'started';
		this.callback = callback;
		var peeridbytes = s3torrent.utils.get_peerid_bytes();
		var _this = this;

		var data = {
			event: event,
			downloaded: this.torrent.metadata.downloaded,
			uploaded: this.torrent.metadata.uploaded,
			compact: 1,
			peer_id: s3torrent.utils.ui82str(peeridbytes),
			port: 6889, // some trackers complain when we send 0 and dont give a response
			left: this.torrent.metadata.total_size - this.torrent.metadata.downloaded,
			numwant: 200,
			no_peer_id: 1
		}
		var data_sort = ['peer_id', 'port', 'uploaded', 'downloaded', 'left', 'numwant', 'compact', 'no_peer_id', 'event'];

//		var xhr = new XMLHttpRequest;
		var xhr = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Components.interfaces.nsIXMLHttpRequest);
		xhr.mozBackgroundRequest = true;

		var url = this.url;
		url += (url.indexOf('?') == -1) ? '?' : '&';
		url = url + 'info_hash=' + s3torrent.utils.urlencode(s3torrent.utils.ui82str(this.torrent.metadata.hashbytes));

		for (var key of data_sort) {
			url = url + '&' + key + '=' + s3torrent.utils.urlencode(data[key]);
		}
		try {
			xhr.open("GET", url, true);
		} catch(e) {
			if (_this.callback) { _this.callback(false, _this, _this.torrent); }
			return;
		}
		xhr.timeout = 10000;
		xhr.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
		xhr.responseType = "arraybuffer";
		xhr.onload = function(evt) {
			s3torrent.utils.clearTimeout( _this.timeout_id );
			_this.on_announce_response(evt.target.response);
		}
		xhr.onerror = function(evt) {
			s3torrent.utils.clearTimeout( _this.timeout_id );
			if (_this.callback) { _this.callback(false, _this, _this.torrent); }
		};

		xhr.setRequestHeader('User-Agent', 'BitComet/1.37.12.31');
		this.timeout_id = s3torrent.utils.setTimeout(function() { _this.on_timeout(); }, 10000);
		xhr.send(null);
	},
	//-----------------------------------------------------------------------------
	on_announce_response: function(resp) {
		s3torrent.utils.clearTimeout( this.timeout_id );
		try {
			var data = s3torrent.bencode.decode(s3torrent.utils.ui82str(new Uint8Array(resp)));
			this.req_interval = data['min interval'] || data['interval'] || 60;
			var peer_list = [];
			if (data.peers && typeof data.peers == 'object') {
				peer_list = this.addNonCompactPeerBuffer(data.peers);
			} else if (data.peers) {
				peer_list = this.addCompactPeerBuffer(data.peers);
			} else {
				if (data['failure reason']) {
	//				app.createNotification({details:"HTTP Tracker error, reason given: \"" + data['failure reason'] + '\". If this is a private torrent, please contact the site administrator and ask them if they can unblock s3torrent',
	//					priority:2})
				}
				if (this.callback) { this.callback(false, this, this.torrent); }
				return;
			}
			if (peer_list.length > 0) {
				this.peer_list = peer_list;
			}
			if (this.callback) { this.callback(true, this, this.torrent); }
		} catch(e) {
			if (this.callback) { this.callback(false, this, this.torrent); }
		}
	},
	//-----------------------------------------------------------------------------
	addNonCompactPeerBuffer: function(added) {
		var peer_list = [];
		for (var i=0; i<added.length; i++) {
			var ip = added[i].ip;
			var port = added[i].port;
			peer_list.push({ 'ip' : ip, 'port' : port });
		}
		return peer_list;
        },
	//-----------------------------------------------------------------------------
	addCompactPeerBuffer: function(added) {
		var numPeers = added.length/6;
		var peer_list = [];
		for (var i=0; i<numPeers; i++) {
			var idx = 6*i;
			var ip = [added.charCodeAt( idx ),
				added.charCodeAt( idx+1 ),
				added.charCodeAt( idx+2 ),
				added.charCodeAt( idx+3 )].join('.');
			var port = added.charCodeAt( idx+4 ) * 256 + added.charCodeAt( idx+5 );
			peer_list.push({ 'ip' : ip, 'port' : port });
		}
		return peer_list;
	}
}
//---------------------------------------------------------------------------------
