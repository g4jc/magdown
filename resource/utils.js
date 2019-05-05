this.EXPORTED_SYMBOLS = [ "utils" ];

//-----------------------------------------------------------------------------------
var magdown = {};
magdown.utils = {};
magdown.utils.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.magdown.");
magdown.utils.prefs_global = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
magdown.utils.stringbundle = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService).createBundle("chrome://magdown/locale/magdown.properties");

//------------------------------------------------------------------------------
Components.utils.import("resource://gre/modules/Timer.jsm", magdown.utils);
Components.utils.import("resource://magdown/peer_name_list.js", magdown.utils);

this.utils = magdown.utils;
//------------------------------------------------------------------------------
magdown.utils.console_log = function(msg) {
	var acs = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
	acs.logStringMessage(msg);
}
//------------------------------------------------------------------------------
magdown.utils.var_dump = function(arg) {
	var text = '';
	for (var i in arg) {
		try {
			if (! /^function/.test(arg[i])) {
				text += i + ':' + arg[i] + "\n";
			} else {
//				text += i + ': is function' + "\n";
			}
		} catch(e) {
		}
	}
	return text;
}
//------------------------------------------------------------------------------
magdown.utils.console_log_dump = function(arg) {
	magdown.utils.console_log(magdown.utils.var_dump(arg));
}
//------------------------------------------------------------------------------
magdown.utils.ui82str = function(arr, startOffset) {
	if (! startOffset) { startOffset = 0 }
	var length = arr.length - startOffset; // XXX a few random exceptions here
	var str = "";
	for (var i=0; i<length; i++) {
		str += String.fromCharCode(arr[i + startOffset]);
	}
	return str;
}
//------------------------------------------------------------------------------
magdown.utils.ui82arr = function(arr, startOffset) {
	if (! startOffset) { startOffset = 0 }
	var length = 10;//arr.length - startOffset;
	var outarr = [];
	for (var i=0; i<length; i++) {
		outarr.push(arr[i + startOffset]);
	}
	return outarr;
}
//------------------------------------------------------------------------------
magdown.utils.base32tohex = function(base32) {
	var base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
	var bits = "";
	var hex = "";
	
	for (var i = 0; i < base32.length; i++) {
		var val = base32chars.indexOf(base32.charAt(i).toUpperCase());
		bits += magdown.utils.pad(val.toString(2), '0', 5);
	}
	
	for (var i = 0; i + 4 <= bits.length; i += 4) {
		var chunk = bits.substr(i, 4);
		hex = hex + parseInt(chunk, 2).toString(16);
	}
	return hex.toLowerCase();
}
//------------------------------------------------------------------------------
magdown.utils.get_peerid_bytes = function() {
	//-----------------------------------------------------------------------------
	if (magdown.utils.peeridbytes) {
		return magdown.utils.peeridbytes;
	}
	//-----------------------------------------------------------------------------
	var peeridbytes = '-BC0137-'.split('').map(function(v){return v.charCodeAt(0)});
	        
	for (var i=peeridbytes.length; i<20; i++) {
		var val = Math.floor(Math.random() * 256);
		peeridbytes.push( val );
        }
	magdown.utils.peeridbytes = peeridbytes;
	return peeridbytes;
}
//------------------------------------------------------------------------------
magdown.utils.parse_uri = function(str) {
	var parseUriRE = {
		uri: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
	};

	var parser = parseUriRE.uri;
	var parserKeys = ["source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor"];
	var m = parser.exec(str || '');
	var parts = {};

	parserKeys.forEach(function(key, i) {
		parts[key] = m[i] || '';
	});
	return parts;
}
//------------------------------------------------------------------------------
magdown.utils.urlparse = function(str) {
	var arr = str.split('#');
 	var result = {};
	var part = arr[0];
	var qindex = part.indexOf('?');
	if( qindex==-1 ) {
		return result;
	}
	var args = part.substring(qindex+1);
	args = args.split('&');
	for ( val of args ) {
		if (val) {
			var keyval = val.split('=');
			if (keyval && keyval[0] && keyval[1]) {
				keyval[0] = decodeURIComponent(keyval[0].replace(/\+/g, ' ')).replace(/\%21/g, '!').replace(/\%27/g, "'").replace(/\%28/g, '(').replace(/\%29/g, ')').replace(/\%2A/g, '*');
				keyval[1] = decodeURIComponent(keyval[1].replace(/\+/g, ' ')).replace(/\%21/g, '!').replace(/\%27/g, "'").replace(/\%28/g, '(').replace(/\%29/g, ')').replace(/\%2A/g, '*');
				if (! result[keyval[0]]) {
					result[keyval[0]] = [];
				}
				result[keyval[0]].push(keyval[1]);
			}
		}
	}
	return result;
}
//------------------------------------------------------------------------------
magdown.utils.urlencode = function(str) {
	str = (str == undefined) ? '' : str;
	str = (str + '').toString();

	var res = ''
	for (var i=0; i<str.length; i++) {
		if (encodeURIComponent(str[i]) == str[i]) {
			res += str[i];
		} else {
			res += '%' + magdown.utils.pad( str.charCodeAt(i).toString(16), '0', 2);
		}
	}
	return res;
}
//------------------------------------------------------------------------------
magdown.utils.pad = function(s, padwith, len) {
	// pad the string s with padwith to length upto
	while (true) {
		if (s.length == len) {
			return s;
		} else if (s.length < len) {
			s = padwith + s;
		} else if (s.length > len) {
	            return;
		}
	}
}
//------------------------------------------------------------------------------
magdown.utils.string_to_uint8Array = function(string) {
	var buffer = new ArrayBuffer(string.length);
	var view = new Uint8Array(buffer);
	for(var i = 0; i < string.length; i++) {
		view[i] = string.charCodeAt(i);
	}
	return view;
}
//------------------------------------------------------------------------------
magdown.utils.bytes_to_hex_string = function(hash) {
//	var result_text = [magdown.utils.to_hex_string(hash.charCodeAt(i)) for (i in hash)].join("");
	var result_text = '';
	for (var i in hash) {
		result_text += magdown.utils.to_hex_string(hash.charCodeAt(i));
	}
	return result_text;
}
//------------------------------------------------------------------------------
magdown.utils.to_hex_string = function(charCode) {
	return ("0" + charCode.toString(16)).slice(-2);
}
//------------------------------------------------------------------------------
magdown.utils.calculate_percent = function(data) {
	var length = 0;
	var count_true = 0;
	for (var i in data) {
		length++;
		if (data[i] == 1) {
			count_true++;
		}
	}

	var percent = count_true * 100 / length;
//	return percent.toFixed(2);
	return Math.ceil(percent);
}
//------------------------------------------------------------------------------
magdown.utils.get_strings_to_KB_MB_GB = function(size, is_speed) {
	if (size > (1024*1024*1024)) {
		size = size/(1024*1024*1024);
		size = size.toFixed(2) + " " + magdown.utils.get_string("giga_bytes_abbr" + (is_speed ? '_speed' : ''));
	}
	else if (size > (1024*1024)) {
		size = size/(1024*1024);
		size = size.toFixed(2) + " " + magdown.utils.get_string("mega_bytes_abbr" + (is_speed ? '_speed' : ''));
	}
	else if (size > (1024)) {
		size = size/(1024);
		size = size.toFixed(2) + " " + magdown.utils.get_string("kilo_bytes_abbr" + (is_speed ? '_speed' : ''));
	}
	else {
		size = size + " " + magdown.utils.get_string("bytes_abbr" + (is_speed ? '_speed' : ''));
	}
	return size;
}
//------------------------------------------------------------------------------
// Round the number of seconds to remove fractions.
//------------------------------------------------------------------------------
magdown.utils.format_seconds = function(secs) {
	if (secs < 0) {
		secs = 0;
	}
	secs = parseInt( secs + .5 );
	var hours = parseInt( secs/3600 );
	secs -= hours*3600;
	var mins = parseInt( secs/60 );
	secs -= mins*60;

	var result = '';
	if ( mins < 10 ) { mins = "0" + mins; }
	if ( secs < 10 ) { secs = "0" + secs; }
	if (hours) {
		if ( hours < 10 ) { hours = "0" + hours;}
		result = hours + ":" + mins + ":" + secs;
	} else {
		result = mins + ":" + secs;
	}

	return result;
}
//------------------------------------------------------------------------------
magdown.utils.get_string = function(name, params) {
	var result = '';
	if (! params) { params = [] }

	try {
		result = magdown.utils.stringbundle.formatStringFromName(name, params, params.length);
		result = result.replace(/\\n/g, "\n");
	} catch(e) {
		result = name + e;
	}
	return result;
}
//------------------------------------------------------------------------------
magdown.utils.alert = function(text, title) {
	if (! title) {
		title = magdown.utils.get_string('extensions.magdown@tornado.name');
	}

	var wm_window = magdown.utils.get_window();
	var promptSer = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
	promptSer.alert(wm_window, title, text);
}
//------------------------------------------------------------------------------
magdown.utils.confirm = function(text, title, window) {
	if (! title) {
		title = magdown.utils.get_string('extensions.magdown@tornado.name');
	}

	var wm_window = magdown.utils.get_window(window);
	var promptSer = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
	return promptSer.confirm(wm_window, title, text);
}
//------------------------------------------------------------------------------
magdown.utils.notification_box = function(msg, title) {
	if (magdown.utils.prefs.getBoolPref('disable_notifications')) {
		return;
	}
	if (! magdown.utils.notification_list) {
		magdown.utils.notification_list = [];
	}
	magdown.utils.notification_list.push({ 'msg' : msg, 'title' : title });
	magdown.utils.setTimeout(function() { magdown.utils.notification_run(); }, 100);
}
//------------------------------------------------------------------------------
magdown.utils.notification_run = function() {
	if (magdown.utils.notification_is_run) { return; }
	magdown.utils.notification_is_run = true;

	var notify = magdown.utils.notification_list.shift();
	if (notify) {
		var alertsService =Components.classes["@mozilla.org/alerts-service;1"].getService(Components.interfaces.nsIAlertsService);
		var addon_name = magdown.utils.get_string('extensions.magdown@tornado.name');
		if (! notify.title) {
			notify.title = addon_name;
		}
		try {
			alertsService.showAlertNotification("chrome://magdown/skin/magdown48.png", notify.title, notify.msg, false, "", null, addon_name + " notification." + Math.random());
		} catch(e) {
		}
		magdown.utils.setTimeout(function() { magdown.utils.notification_is_run = false; magdown.utils.notification_run(); }, 100);
		return;
	}
	magdown.utils.notification_is_run = false;
}
//------------------------------------------------------------------------------
magdown.utils.get_peerclient_name = function(str) {
	var client_name = 'Client Unknown';
	if (magdown.utils.peer_name_map_list) {
		var res_list = /^\-(..)([^\-]+)/i.exec(str);
		if (res_list != null) {
			if (magdown.utils.peer_name_map_list[res_list[1]]) {
				client_name = magdown.utils.peer_name_map_list[res_list[1]] + ' (' + res_list[2] + ')';
			} else {
				client_name = res_list[1] + ' (' + res_list[2] + ')';
			}
		}
	}
	return client_name;
}
//------------------------------------------------------------------------------
magdown.utils.notify_observers = function(subject, topic, torrent_id) {
	subject = (subject) ? subject : {};
	magdown.utils.setTimeout(function(){ magdown.utils.notify_observers_run(subject, topic, torrent_id); }, 100);
}
//------------------------------------------------------------------------------
magdown.utils.notify_observers_run = function(subject, topic, torrent_id) {
	var observe = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
	observe.notifyObservers(subject, topic, torrent_id);
}
//------------------------------------------------------------------------------
magdown.utils.get_LocalFile_from_native_path_or_url = function(aPathOrUrl) {
	if (aPathOrUrl.substring(0,7) == "file://") {
		// if this is a URL, get the file from that
		var ioSvc = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
		// XXX it's possible that using a null char-set here is bad
		const fileUrl = ioSvc.newURI(aPathOrUrl, null, null).QueryInterface(Components.interfaces.nsIFileURL);
		return fileUrl.file.clone().QueryInterface(Components.interfaces.nsILocalFile);
	} else {
		// if it's a pathname, create the nsILocalFile directly
		var f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		f.initWithPath(aPathOrUrl);
		return f;
	}
}
//------------------------------------------------------------------------------
magdown.utils.get_localFile_dir = function(path) {
	var localDir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	try {
		var file = magdown.utils.get_LocalFile_from_native_path_or_url(path);
		if (file.isFile()) {
			file = file.parent;
		}
		if (file.exists()) {
			localDir.initWithPath(file.path);
		} else {
			localDir = false;
		}
	} catch(e) {
		localDir = false;
	}
	return localDir;
}
//------------------------------------------------------------------------------
magdown.utils.get_default_save_dir = function() {
	var supportsString = Components.interfaces.nsISupportsString;
	//-------------------------------------------------
	var default_dir = magdown.utils.get_localFile_dir(magdown.utils.prefs.getComplexValue('torrent.default_save_dir', supportsString).data);
	if (! default_dir) {
		try {
			default_dir = magdown.utils.get_localFile_dir(magdown.utils.prefs_global.getComplexValue('browser.download.dir', supportsString).data);
		} catch(e) {
		}
	}
	if (! default_dir) {
		try {
			default_dir = magdown.utils.get_localFile_dir(magdown.utils.prefs_global.getComplexValue('browser.download.lastDir', supportsString).data);
		} catch(e) {
		}
	}
	if (! default_dir) {
		try {
			default_dir = magdown.utils.get_localFile_dir(magdown.utils.prefs_global.getComplexValue('browser.download.downloadDir', supportsString).data);
		} catch(e) {
		}
	}
	return default_dir;
}
//------------------------------------------------------------------------------
magdown.utils.set_default_save_dir = function(path) {
	var supportsString = Components.interfaces.nsISupportsString;
	var pref_unichar = Components.classes["@mozilla.org/supports-string;1"].createInstance(supportsString);
	pref_unichar.data = path;
	magdown.utils.prefs.setComplexValue("torrent.default_save_dir", supportsString, pref_unichar);
}
//------------------------------------------------------------------------------
magdown.utils.get_window = function(window) {
	if (window) {
		return window;
	}
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
	var wm_window = wm.getMostRecentWindow('navigator:browser');
	return wm_window;
}
//------------------------------------------------------------------------------
magdown.utils.add_new_torrent = function(params) {
	var data = params || {};
	data.wrappedJSObject = data;
	magdown.utils.notify_observers(data, 'magdown-add-new-torrent', null);
}
//------------------------------------------------------------------------------
magdown.utils.add_new_torrent_run = function(params) {
	var wm_window = magdown.utils.get_window();
	var gBrowser = wm_window.gBrowser;
	if (params && params.is_url && (params.referrer_url == '')) {
		if (/^(https?)|(ftps?)\:\/\/.+/i.test(gBrowser.selectedTab.linkedBrowser.currentURI.spec)) {
			params.referrer_url = gBrowser.selectedTab.linkedBrowser.currentURI.spec;
		}
	}
	var winD = wm_window.openDialog('chrome://magdown/content/add_new_torrent.xul', 'magdown_new_torrent', 'chrome,modal,centerscreen,toolbar,resizable', params);
	winD.focus();
}
//------------------------------------------------------------------------------
magdown.utils.calculate_speed = function(download_speed_data, piece_download) {
	var download_speed_data_tmp = [];

	if (piece_download) {
		download_speed_data.push({ 'bytes' : piece_download.chunk_size, 'start_time' : piece_download.start_time, 'end_time' : piece_download.end_time });
	}

	var current_time = new Date().getTime();
	var calc_time_start_high = 0;
	var calc_time_end_high = 0;
	var calc_bytes_high = 0;

	var calc_time_start_low = 0;
	var calc_time_end_low = 0;
	var calc_bytes_low = 0;

	var download_speed = 0;

	for (var data of download_speed_data.reverse()) {
		var elapsed_time_high = current_time - data.start_time;
		var elapsed_time_low = current_time - data.end_time;
		if (elapsed_time_high < 2000) {
			calc_time_start_high = ((calc_time_start_high == 0) || (data.start_time < calc_time_start_high)) ? data.start_time : calc_time_start_high;
			calc_time_end_high = (data.end_time > calc_time_end_high) ? data.end_time : calc_time_end_high;
			calc_bytes_high += data.bytes;
			download_speed_data_tmp.push(data);
		}
		else if (elapsed_time_low < 2000) {
			calc_time_start_low = ((calc_time_start_low == 0) || (data.start_time < calc_time_start_low)) ? data.start_time : calc_time_start_low;
			calc_time_end_low = (data.end_time > calc_time_end_low) ? data.end_time : calc_time_end_low;
			calc_bytes_low += data.bytes;
			download_speed_data_tmp.push(data);
		}
	}

	if (calc_bytes_high > 0) {
		var download_time = calc_time_end_high - calc_time_start_high;
		download_speed = Math.ceil(calc_bytes_high / (download_time/1000));
	}
	if (calc_bytes_low > 0) {
		var download_time = calc_time_end_low - calc_time_start_low;
		download_speed += Math.ceil(calc_bytes_low / (download_time/1000));
	}
	return [download_speed, download_speed_data_tmp];
}
//------------------------------------------------------------------------------
magdown.utils.numeral3 = function(num) {
	num = parseInt(num);
	if (! num) { num = 0; }
	num = (num + '').toString();
	while (/\d{4}/.test(num)) {
		num = num.replace(/(\d+)(\d\d\d)/g, '$1 $2');
	}
	return num;
}
//------------------------------------------------------------------------------
