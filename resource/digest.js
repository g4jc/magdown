this.EXPORTED_SYMBOLS = [ "digest" ];

var s3torrent = {};
s3torrent.digest = {};
s3torrent.digest.ch = Components.classes["@mozilla.org/security/hash;1"].createInstance(Components.interfaces.nsICryptoHash);
Components.utils.import("resource://s3torrent/utils.js", s3torrent);

this.digest = s3torrent.digest;
//-----------------------------------------------------------------------------------
s3torrent.digest.checksum_buffer = function(data_list, algorithm) {
	s3torrent.digest.ch.init(s3torrent.digest.ch[algorithm]);
	for (var data of data_list) {
		s3torrent.digest.ch.update(data, data.length);
	}
	var hash = s3torrent.digest.ch.finish(false);

//	var result_bytes = [hash.charCodeAt(i) for (i in hash)];
	var result_bytes = [];
	for (var i in hash) {
		result_bytes.push(hash.charCodeAt(i));
	}
	var result_text = s3torrent.utils.bytes_to_hex_string(hash);
	return { 'hash': hash, bytes: result_bytes, text: result_text };
}
//-----------------------------------------------------------------------------------
