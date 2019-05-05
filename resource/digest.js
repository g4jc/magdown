this.EXPORTED_SYMBOLS = [ "digest" ];

var magdown = {};
magdown.digest = {};
magdown.digest.ch = Components.classes["@mozilla.org/security/hash;1"].createInstance(Components.interfaces.nsICryptoHash);
Components.utils.import("resource://magdown/utils.js", magdown);

this.digest = magdown.digest;
//-----------------------------------------------------------------------------------
magdown.digest.checksum_buffer = function(data_list, algorithm) {
	magdown.digest.ch.init(magdown.digest.ch[algorithm]);
	for (var data of data_list) {
		magdown.digest.ch.update(data, data.length);
	}
	var hash = magdown.digest.ch.finish(false);

//	var result_bytes = [hash.charCodeAt(i) for (i in hash)];
	var result_bytes = [];
	for (var i in hash) {
		result_bytes.push(hash.charCodeAt(i));
	}
	var result_text = magdown.utils.bytes_to_hex_string(hash);
	return { 'hash': hash, bytes: result_bytes, text: result_text };
}
//-----------------------------------------------------------------------------------
