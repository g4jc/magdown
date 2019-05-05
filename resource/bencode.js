this.EXPORTED_SYMBOLS = [ "bencode" ];

var magdown = {};
magdown.bencode = {};
this.bencode = magdown.bencode;

// simple but inefficient utf8 trickery from stack overflow
// seems to not work very well?
magdown.bencode.td = new TextDecoder('utf-8');
magdown.bencode.te = new TextEncoder('utf-8');
magdown.bencode.utf8 = {};
//-----------------------------------------------------------------------------------
magdown.bencode.init = function() {
	magdown.bencode.encode_func = {};
	magdown.bencode.encode_func['integer'] = magdown.bencode.encode_int;
	magdown.bencode.encode_func['string'] = magdown.bencode.encode_string;
	magdown.bencode.encode_func['array'] = magdown.bencode.encode_array;
	magdown.bencode.encode_func['object'] = magdown.bencode.encode_object;
	
	magdown.bencode.decode_func = {};
	magdown.bencode.decode_func['l'] = magdown.bencode.decode_list;
	magdown.bencode.decode_func['d'] = magdown.bencode.decode_dict;
	magdown.bencode.decode_func['i'] = magdown.bencode.decode_int;
	for (var i=0; i<10; i++) {
		magdown.bencode.decode_func[i.toString()] = magdown.bencode.decode_string;
	}
}
//-----------------------------------------------------------------------------------
magdown.bencode.encode = function(x, stack_callback, opts) {
	opts = opts || {utf8:true};
	var r = [];
	var stack = [];
	magdown.bencode.encode_func[magdown.bencode.gettype(x)](x ,r, stack, stack_callback, opts);
	return r;
}
//-----------------------------------------------------------------------------------
magdown.bencode.decode = function(x, opts) {
	var data = magdown.bencode.decode_func[x[0]](x, 0, opts); /// maybe have this check if decode_func[x[0]] exists? // most of the time object has no method "<" (html tag?)
	var r = data[0];
	var l = data[1];
	return r;
}
//-----------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------
magdown.bencode.utf8.toByteArray = function(str) {
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
magdown.bencode.utf8.parse = function(byteArray) {
	var str = '';
	for (var i = 0; i < byteArray.length; i++) {
		str +=  byteArray[i] <= 0x7F ? byteArray[i] === 0x25 ? "%25" : String.fromCharCode(byteArray[i]) : "%" + byteArray[i].toString(16).toUpperCase();
	}
	return decodeURIComponent(str);
}
//-----------------------------------------------------------------------------------
// bencoding functions translated from original Bram's bencode.py
//-----------------------------------------------------------------------------------
magdown.bencode.python_int = function(s) {
	var n = parseInt(s,10);
	if (isNaN(n)) { throw Error('ValueError'); }
	return n;
}
//-----------------------------------------------------------------------------------
magdown.bencode.decode_int = function(x,f) {
	f++;

	var newf = x.indexOf('e',f);
	var n = magdown.bencode.python_int(x.slice(f,newf));

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
magdown.bencode.decode_string = function(x,f, opts, key) {
	var colon = x.indexOf(':',f);
	var n = magdown.bencode.python_int(x.slice(f,colon));
	if (x[f] == '0' && colon != f+1) {
		throw Error('ValueError');
	}
	colon++;
	var raw = x.slice(colon,colon+n);
	var decoded;
	if (opts && opts.utf8 && (! magdown.bencode.check_not_standart_field(key))) {
		decoded = magdown.bencode.td.decode(magdown.bencode.stringToUint8ArrayWS(raw));
	} else {
		decoded = raw;
	}

	return [decoded, colon+n];
}
//-----------------------------------------------------------------------------------
magdown.bencode.decode_list = function(x,f, opts) {
	var data;
	var v;
	var r = [];
	f++;
	while (x[f] != 'e') {
		data = magdown.bencode.decode_func[x[f]](x,f, opts);
		v = data[0];
		f = data[1];
		r.push(v);
	}
	return [r, f+1];
}
//-----------------------------------------------------------------------------------
magdown.bencode.decode_dict = function(x, f, opts) {
	var data;
	var data2;
	var k;

	var r = {};
	f++;
	while (x[f] != 'e') {
		data = magdown.bencode.decode_string(x, f, opts);
		k = data[0];
		f = data[1];

		data2 = magdown.bencode.decode_func[ x[f] ](x,f, opts, k)
		r[k] = data2[0];
		f = data2[1];
	}
	return [r, f+1];
}
//-----------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------
magdown.bencode.isArray = function(obj) {
	return Object.prototype.toString.call(obj) === '[object Array]';
}
//-----------------------------------------------------------------------------------
magdown.bencode.gettype = function(val) {
	if (typeof val == 'number' && val.toString() == parseInt(val.toString(),10)) {
		return 'integer';
	} else if (magdown.bencode.isArray(val)) {
		return 'array';
	} else {
		return typeof val;
	}
}
//-----------------------------------------------------------------------------------
magdown.bencode.encode_int = function(x, r) {
	r.push('i'.charCodeAt(0));
	var s = x.toString();
	for (var i=0; i<s.length; i++) {
		r.push( s[i].charCodeAt(0) ); 
	}
	r.push('e'.charCodeAt(0));
}
//-----------------------------------------------------------------------------------
magdown.bencode.encode_string = function(x, r, stack, cb, opts) {
	var is_not_standart = false;
	if (stack && stack.length > 0) {
		is_not_standart = magdown.bencode.check_not_standart_field(stack[stack.length-1]);
	}
	if (opts && opts.utf8 && ! (is_not_standart) ) {
		var bytes = magdown.bencode.te.encode(x);
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
magdown.bencode.encode_array = function(x, r, stack, cb, opts) {
	r.push( 'l'.charCodeAt(0) );
	for (var i=0; i<x.length; i++) {
		magdown.bencode.encode_func[magdown.bencode.gettype(x[i])](x[i], r, stack, cb, opts);
	}
	r.push('e'.charCodeAt(0));
}
//-----------------------------------------------------------------------------------
magdown.bencode.encode_object = function(x ,r, stack, stack_callback, opts) {
	r.push('d'.charCodeAt(0));
	var keys = [];
	for (var key in x) {
		keys.push(key);
	}
	keys.sort();
	for (var j=0; j<keys.length; j++) {
		var key = keys[j];
		var bytes = magdown.bencode.utf8.toByteArray(key);
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
		magdown.bencode.encode_func[magdown.bencode.gettype(x[key])]( x[key], r, stack, stack_callback, opts );
		stack.pop();
	}
	r.push('e'.charCodeAt(0));
}
//------------------------------------------------------------------------------
magdown.bencode.stringToUint8ArrayWS = function(string) {
	var buffer = new ArrayBuffer(string.length);
	var view = new Uint8Array(buffer);
	for(var i = 0; i < string.length; i++) {
		view[i] = string.charCodeAt(i);
	}
	return view;
}
//-----------------------------------------------------------------------------------
magdown.bencode.check_not_standart_field = function(key) {
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

magdown.bencode.init();
