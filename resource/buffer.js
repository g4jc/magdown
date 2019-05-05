this.EXPORTED_SYMBOLS = [ "Buffer" ];

var s3torrent = {};

//-----------------------------------------------------------------------------------
s3torrent.Buffer = function() {
	this.max_buffer_size = 80000;
	this.buffer_data = [];
	this.buffer_is_work = false;
}

this.Buffer = s3torrent.Buffer;

//-----------------------------------------------------------------------------------
s3torrent.Buffer.prototype = {
	clear: function() {
		this.buffer_data = [];
	},
	add: function(data) {
		this.buffer_data.push(data);
	},
	get: function(is_force) {
		if (this.buffer_is_work && (! is_force)) { return null; }
		if (this.buffer_data.length == 0) { return null; }
		this.buffer_is_work = true;
		var return_result = null;

		//----------------------------------------------------------------------------
		var data = this.buffer_data.shift();
		var data_size = null;
		try {
			data_size = new DataView(data, 0, 4).getUint32(0) + 4;
		} catch(e) {
			return return_result;
		}

/*
var length = 10; // data.byteLength;//arr.length - startOffset;
for (var i=0; i<length; i++) {
s3torrent.utils.console_log('onRead=55-1 -' + i + '= ' + new Uint8Array(data)[i]);
}
*/
		//----------------------------------------------------------------------------
		if (data.byteLength > this.max_buffer_size) {
			return_result = this.get(true);
		}
		//----------------------------------------------------------------------------
		else if (data_size == data.byteLength) {
			return_result = data;
		}
		//----------------------------------------------------------------------------
		else if (data_size < data.byteLength) {
			var tmp = new Uint8Array(data.slice(0, data_size));
			var tmp2 = new Uint8Array(data.slice(data_size));

			this.buffer_data.unshift(tmp2.buffer);
			return_result = tmp.buffer;
		}
		//----------------------------------------------------------------------------
		else if (data_size > data.byteLength) {
			if (this.buffer_data.length > 0) {
				var data2 = this.buffer_data.shift();
				var tmp = new Uint8Array(data.byteLength + data2.byteLength);
				tmp.set( new Uint8Array( data ), 0 );
				tmp.set( new Uint8Array( data2 ), data.byteLength );
				this.buffer_data.unshift(tmp.buffer);

				return_result = this.get(true);
			} else {
				this.buffer_data.unshift(data);
				return_result = null;
			}
		}

		this.buffer_is_work = false;
		return return_result;
	}
}
