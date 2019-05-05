this.EXPORTED_SYMBOLS = [ "UDPTracker" ];

var s3torrent = {};
Components.utils.import("resource://s3torrent/utils.js", s3torrent);

//-----------------------------------------------------------------------------------
s3torrent.UDPTracker = function(torrent, url) {
	this.url = url;
	this.parsedUrl = s3torrent.utils.parse_uri(this.url);
	this.host = this.parsedUrl.host;
	this.port = parseInt(this.parsedUrl.port) || 80;
	this.torrent = torrent;
	this.timeout_id = null;
	this.udpSocket = null;
	this.callback = null;
	this.transaction_id = Math.floor(Math.random() * Math.pow(2,32));
	this.connection_id = null;
	this.req_interval = 60;
	this.leechers = 0;
	this.seeders = 0;
	this.peer_list = [];
	this.event = 'started';
}

this.UDPTracker = s3torrent.UDPTracker;

//-----------------------------------------------------------------------------------
s3torrent.UDPTracker.prototype = {
	//-----------------------------------------------------------------------------
	udp_server_callback : function() {
	},
	//-----------------------------------------------------------------------------
	on_timeout : function() {
		if (this.udpSocket != null) {
			this.udpSocket.close();
		}
		if (this.callback) { this.callback(false, this, this.torrent); }
	},
	//-----------------------------------------------------------------------------
	announce: function(event, callback) {
		this.event = event || 'started';
		this.callback = callback;
		this.udpSocket = Components.classes["@mozilla.org/network/udp-socket;1"].createInstance(Components.interfaces.nsIUDPSocket);
		try {
			this.udpSocket.init(-1, false);
		} catch(e) {
			this.udpSocket.init(-1, false, null);
		}
		var _this = this;
		var udp_server_listen = {
			onPacketReceived : function(aSocket, aMessage) {
				_this.udp_server_callback(aSocket, aMessage);
			},
			onStopListening : function(aSocket, aStatus) {
			}
		};
		this.udpSocket.asyncListen(udp_server_listen);

		var connRequest = this.get_connection_data();
		this.udp_server_callback = function(aSocket, aMessage) {
			var rawData = (aMessage.rawData) ? aMessage.rawData : s3torrent.utils.string_to_uint8Array(aMessage.data);
			var resp = new DataView( rawData.buffer );
			var respAction = resp.getUint32(0);
			var respTransactionId = resp.getUint32(4);
			this.connection_id = [resp.getUint32(8), resp.getUint32(12)];
			this.on_announce_connect();
		}
		this.timeout_id = s3torrent.utils.setTimeout(function() { _this.on_timeout(); }, 10000);
		this.udpSocket.send( this.host, this.port, connRequest, connRequest.byteLength);
	},
	//-----------------------------------------------------------------------------
	get_connection_data: function() {
		// bittorrent udp protocol connection header info
		var payload = new Uint8Array([
			0, 0, 4, 23, 39, 16, 25, 128, /* hard coded protocol id */
			0,0,0,0, /* action */
			0,0,0,0 /* transaction id */
		]);
		var action = 0;
		var v = new DataView(payload.buffer);
		v.setUint32(8, action);
		v.setUint32(12, this.transaction_id);
		return payload;
	},
	//-----------------------------------------------------------------------------
	on_announce_connect: function() {
		s3torrent.utils.clearTimeout( this.timeout_id );
		var _this = this;
		var announceRequest = this.get_announce_payload();
		this.udp_server_callback = function(aSocket, aMessage) {
			this.on_announce_response(aSocket, aMessage);
		};
		this.timeout_id = s3torrent.utils.setTimeout(function() { _this.on_timeout(); }, 10000);
		this.udpSocket.send(this.host, this.port, announceRequest, announceRequest.byteLength);
	},
	//-----------------------------------------------------------------------------
	get_announce_payload: function() {
		var payload = new Uint8Array([
			0,0,0,0, 0,0,0,0, /* connection id */
			0,0,0,1, /* action */
			0,0,0,0, /* transaction id */
			0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0, /* infohash */
			0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0, /* peer id */
			0,0,0,0,0,0,0,0, /* downloaded */
			0,0,0,0,0,0,0,0, /* left */
			0,0,0,0,0,0,0,0, /* uploaded */
			0,0,0,0, /* event */
			0,0,0,0, /* ip */
			0,0,0,0, /* key */
			255,255,255,255, /* numwant */
			2,0, /* port, sending something random cuz we dont even listen yet */
			0,0, /* extensions */
		]);

		var v = new DataView( payload.buffer );
		v.setUint32( 0, this.connection_id[0] );
		v.setUint32( 4, this.connection_id[1] );
		v.setUint32( 12, this.transaction_id );
		for (var i=0; i<20; i++) {
			v.setInt8(16+i, this.torrent.metadata.hashbytes[i])
		}
		var peeridbytes = s3torrent.utils.get_peerid_bytes();
		for (var i=0; i<20; i++) {
			v.setInt8(36+i, peeridbytes[i]);
		}

		v.setUint32(56, this.torrent.metadata.downloaded);
		v.setUint32(56+4, this.torrent.metadata.total_size - this.torrent.metadata.downloaded);
		v.setUint32(56+4*2, this.torrent.metadata.uploaded);
		var eventmap = { 'started': 2, 'completed': 1, 'stopped': 3, 'none': 0 };
		if (eventmap[this.event]) {
			v.setUint32(56+4*3, eventmap[this.event]);
		}

		return payload;
	},
	//-----------------------------------------------------------------------------
	on_announce_response: function(aSocks, aMessage) {
		s3torrent.utils.clearTimeout( this.timeout_id );
		var rawData = (aMessage.rawData) ? aMessage.rawData : s3torrent.utils.string_to_uint8Array(aMessage.data);
		var readResponse = rawData.buffer;

		if (readResponse.byteLength <= 20) {
			this.on_timeout();
			return;
		}

		var v = new DataView(readResponse);
		var resp = v.getUint32(4*0)
		var respTransactionId = v.getUint32(4*1);
		this.req_interval = v.getUint32(4*2);
		this.leechers = v.getUint32(4*3);
		this.seeders = v.getUint32(4*4);
		var countPeers = (readResponse.byteLength - 20)/6;

		var peer_list = [];
		for (var i=0; i<countPeers; i++) {
			try {
				var ipbytes = [v.getUint8( 20 + (i*6) ),
						  v.getUint8( 20 + (i*6) + 1),
						  v.getUint8( 20 + (i*6) + 2),
						  v.getUint8( 20 + (i*6) + 3)];
				var port = v.getUint16( 20 + (i*6) + 4 );
				var ip = ipbytes.join('.');
				peer_list.push({ 'ip' : ip, 'port' : port });
			} catch(e) {
			}
		}
		if (peer_list.length > 0) {
			this.peer_list = peer_list;
		}
		this.udpSocket.close();
		if (this.callback) { this.callback(true, this, this.torrent); }
	}
}
//---------------------------------------------------------------------------------
