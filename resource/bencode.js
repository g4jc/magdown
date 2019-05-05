this.EXPORTED_SYMBOLS = [ "bencode" ];

var s3torrent = {};
s3torrent.bencode = {};
this.bencode = s3torrent.bencode;

// simple but inefficient utf8 trickery from stack overflow
// seems to not work very well?
s3torrent.bencode.td = new TextDecoder('utf-8');
s3torrent.bencode.te = new TextEncoder('utf-8');
s3torrent.bencode.utf8 = {};
//-----------------------------------------------------------------------------------
s3torrent.bencode.init = function() {
	s3torrent.bencode.encode_func = {};
	s3torrent.bencode.encode_func['integer'] = s3torrent.bencode.encode_int;
	s3torrent.bencode.encode_func['string'] = s3torrent.bencode.encode_string;
	s3torrent.bencode.encode_func['array'] = s3torrent.bencode.encode_array;
	s3torrent.bencode.encode_func['object'] = s3torrent.bencode.encode_object;
	
	s3torrent.bencode.decode_func = {};
	s3torrent.bencode.decode_func['l'] = s3torrent.bencode.decode_list;
	s3torrent.bencode.decode_func['d'] = s3torrent.bencode.decode_dict;
	s3torrent.bencode.decode_func['i'] = s3torrent.bencode.decode_int;
	for (var i=0; i<10; i++) {
		s3torrent.bencode.decode_func[i.toString()] = s3torrent.bencode.decode_string;
	}
}
//-----------------------------------------------------------------------------------
s3torrent.bencode.encode = function(x, stack_callback, opts) {
	opts = opts || {utf8:true};
	var r = [];
	var stack = [];
	s3torrent.bencode.encode_func[s3torrent.bencode.gettype(x)](x ,r, stack, stack_callback, opts);
	return r;
}
//-----------------------------------------------------------------------------------
s3torrent.bencode.decode = function(x, opts) {
	var data = s3torrent.bencode.decode_func[x[0]](x, 0, opts); /// maybe have this check if decode_func[x[0]] exists? // most of the time object has no method "<" (html tag?)
	var r = data[0];
	var l = data[1];
	return r;
}
//-----------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------
s3torrent.bencode.utf8.toByteArray = function(str) {
	var byteArray = [];
	for (var i = 0; i < str.length; i++) {
		if (str.charCodeAt(i) <= 0x7F) {
			byteArray.push(str.charCodeAt(i));
		} else {
			var h = encodeURIComponent(str.charAt(i)).substr(1).split('%');
			for (var j = 0; j < h.length; j++) {
				byteArray.push(parseInt(h[j], 16));
			}
		}
	}
	return byteArray;
}
//-----------------------------------------------------------------------------------
s3torrent.bencode.utf8.parse = function(byteArray) {
	var str = '';
	for (var i = 0; i < byteArray.length; i++) {
		str +=  byteArray[i] <= 0x7F ? byteArray[i] === 0x25 ? "%25" : String.fromCharCode(byteArray[i]) : "%" + byteArray[i].toString(16).toUpperCase();
	}
	return decodeURIComponent(str);
}
//-----------------------------------------------------------------------------------
// bencoding functions translated from original Bram's bencode.py
//-----------------------------------------------------------------------------------
s3torrent.bencode.python_int = function(s) {
	var n = parseInt(s,10);
	if (isNaN(n)) { throw Error('ValueError'); }
	return n;
}
//-----------------------------------------------------------------------------------
s3torrent.bencode.decode_int = function(x,f) {
	f++;

	var newf = x.indexOf('e',f);
	var n = s3torrent.bencode.python_int(x.slice(f,newf));

	if (x[f] == '-') {
		if (x[f+1] == '0') {
			throw Error('ValueError');
		}
	} else if (x[f] == '0' && newf != f+1) {
		throw Error('ValueError');
	}
	return [n, newf+1];
}
//-----------------------------------------------------------------------------------
s3torrent.bencode.decode_string = function(x,f, opts, key) {
	var colon = x.indexOf(':',f);
	var n = s3torrent.bencode.python_int(x.slice(f,colon));
	if (x[f] == '0' && colon != f+1) {
		throw Error('ValueError');
	}
	colon++;
	var raw = x.slice(colon,colon+n);
	var decoded;
	if (opts && opts.utf8 && (! s3torrent.bencode.check_not_standart_field(key))) {
		decoded = s3torrent.bencode.td.decode(s3torrent.bencode.stringToUint8ArrayWS(raw));
	} else {
		decoded = raw;
	}

	return [decoded, colon+n];
}
//-----------------------------------------------------------------------------------
s3torrent.bencode.decode_list = function(x,f, opts) {
	var data;
	var v;
	var r = [];
	f++;
	while (x[f] != 'e') {
		data = s3torrent.bencode.decode_func[x[f]](x,f, opts);
		v = data[0];
		f = data[1];
		r.push(v);
	}
	return [r, f+1];
}
//-----------------------------------------------------------------------------------
s3torrent.bencode.decode_dict = function(x, f, opts) {
	var data;
	var data2;
	var k;

	var r = {};
	f++;
	while (x[f] != 'e') {
		data = s3torrent.bencode.decode_string(x, f, opts);
		k = data[0];
		f = data[1];

		data2 = s3torrent.bencode.decode_func[ x[f] ](x,f, opts, k)
		r[k] = data2[0];
		f = data2[1];
	}
	return [r, f+1];
}
//-----------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------
s3torrent.bencode.isArray = function(obj) {
	return Object.prototype.toString.call(obj) === '[object Array]';
}
//-----------------------------------------------------------------------------------
s3torrent.bencode.gettype = function(val) {
	if (typeof val == 'number' && val.toString() == parseInt(val.toString(),10)) {
		return 'integer';
	} else if (s3torrent.bencode.isArray(val)) {
		return 'array';
	} else {
		return typeof val;
	}
}
//-----------------------------------------------------------------------------------
s3torrent.bencode.encode_int = function(x, r) {
	r.push('i'.charCodeAt(0));
	var s = x.toString();
	for (var i=0; i<s.length; i++) {
		r.push( s[i].charCodeAt(0) ); 
	}
	r.push('e'.charCodeAt(0));
}
//-----------------------------------------------------------------------------------
s3torrent.bencode.encode_string = function(x, r, stack, cb, opts) {
	var is_not_standart = false;
	if (stack && stack.length > 0) {
		is_not_standart = s3torrent.bencode.check_not_standart_field(stack[stack.length-1]);
	}
	if (opts && opts.utf8 && ! (is_not_standart) ) {
		var bytes = s3torrent.bencode.te.encode(x);
	} else {
		var bytes = [];
		for (var i=0; i<x.length; i++) {
			bytes.push(x.charCodeAt(i));
		}
	}

	var s = bytes.length.toString();
	for (var i=0; i<s.length; i++) {
		r.push( s[i].charCodeAt(0) );
	}
	r.push(':'.charCodeAt(0))
	for (var i=0; i<bytes.length; i++) {
		r.push(bytes[i]);
	}
}
//-----------------------------------------------------------------------------------
s3torrent.bencode.encode_array = function(x, r, stack, cb, opts) {
	r.push( 'l'.charCodeAt(0) );
	for (var i=0; i<x.length; i++) {
		s3torrent.bencode.encode_func[s3torrent.bencode.gettype(x[i])](x[i], r, stack, cb, opts);
	}
	r.push('e'.charCodeAt(0));
}
//-----------------------------------------------------------------------------------
s3torrent.bencode.encode_object = function(x ,r, stack, stack_callback, opts) {
	r.push('d'.charCodeAt(0));
	var keys = [];
	for (var key in x) {
		keys.push(key);
	}
	keys.sort();
	for (var j=0; j<keys.length; j++) {
		var key = keys[j];
		var bytes = s3torrent.bencode.utf8.toByteArray(key);
		var s = bytes.length.toString();

		for (var i=0; i<s.length; i++) {
			r.push( s[i].charCodeAt(0) );
		}
		r.push(':'.charCodeAt(0));
		for (var i=0; i<bytes.length; i++) {
			r.push( bytes[i] );
		}
		stack.push(key);
		if (stack_callback) { stack_callback(stack, r); }
		s3torrent.bencode.encode_func[s3torrent.bencode.gettype(x[key])]( x[key], r, stack, stack_callback, opts );
		stack.pop();
	}
	r.push('e'.charCodeAt(0));
}
//------------------------------------------------------------------------------
s3torrent.bencode.stringToUint8ArrayWS = function(string) {
	var buffer = new ArrayBuffer(string.length);
	var view = new Uint8Array(buffer);
	for(var i = 0; i < string.length; i++) {
		view[i] = string.charCodeAt(i);
	}
	return view;
}
//-----------------------------------------------------------------------------------
s3torrent.bencode.check_not_standart_field = function(key) {
	var standart_map = {
		'files' : 1,
		'length' : 1,
		'path' : 1,
		'name' : 1,
		'piece length' : 1,
		'md5sum' : 1,
		'v' : 1,
		'created by' : 1,
		'creation date' : 1,
		'encoding' : 1,
		'announce' : 1,
		'comment' : 1,
		'publisher' : 1,
		'publisher-url' : 1
	};
	return  (key && (! standart_map[key])) ? true : false;
}
//-----------------------------------------------------------------------------------

s3torrent.bencode.init();
