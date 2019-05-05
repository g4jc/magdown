this.EXPORTED_SYMBOLS = [ "history" ];


var magdown = {};
magdown.history = {};
Components.utils.import("resource://gre/modules/osfile.jsm");

this.history = magdown.history;

//------------------------------------------------------------------------------
magdown.history.load_history_list = function() {
	var result = [];
	var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
	file.append("magdown");
	if (! file.exists()) {
		return result;
	}
	var entries = file.directoryEntries;

	while (entries.hasMoreElements()) {
		try {
			var entry = entries.getNext();
			entry.QueryInterface(Components.interfaces.nsIFile);
			if (entry.isFile()) {
				var name = OS.Path.basename(entry.path);
				name = name.replace(/\.json$/, '');
	
				var download = magdown.history.get_history(name);
				if (download) {
					result.push(download);
				}
			}
		} catch(e) {
		}
	}

	return result;
}
//------------------------------------------------------------------------------
magdown.history.open_file = function(s3id) {
	var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
	file.append("magdown");
	file.append(s3id + ".json");
	if (file.exists()) {
		return file;
	} else {
		return false;
	}
}
//------------------------------------------------------------------------------
magdown.history.create_file = function(s3id) {
	var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
	file.append("magdown");
	file.append(s3id + ".json");
	try {
		if (file.exists()) {
			return magdown.history.open_file(s3id);
		}
		file.create( Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0664);
	} catch(e) {
		file = false;
	}
	return file;
}
//------------------------------------------------------------------------------
magdown.history.read_file = function(file) {
	var fileInputStream = Components.classes['@mozilla.org/network/file-input-stream;1'].createInstance(Components.interfaces.nsIFileInputStream);
	var scriptableInputStream = Components.classes['@mozilla.org/scriptableinputstream;1'].createInstance(Components.interfaces.nsIScriptableInputStream);
	var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
	converter.charset = "UTF-8";
	var json_data = '';

	try {
		fileInputStream.init(file, 1, 0, 0);
		scriptableInputStream.init(fileInputStream);
		json_data = scriptableInputStream.read(-1);
		json_data = converter.ConvertToUnicode(json_data);
	} catch(e) {
		return false;
	}

	//-------------------------------------------------------------------------
	scriptableInputStream.close();
        fileInputStream.close();

	var is_ok = true;
	//-------------------------------------------------------------------------
	try {
		json_data = JSON.parse(json_data);
	} catch(e) {
		is_ok = false;
	}
	//-------------------------------------------------------------------------
	if (is_ok) {
		return json_data;
	}
	//-------------------------------------------------------------------------
	else {
		try {
			file.remove(false);
		} catch(e) {
		}
		return false;
	}
}
//------------------------------------------------------------------------------
magdown.history.write_file = function(file, json_data) {
	var fileOutputStream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
	var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
	converter.charset = "UTF-8";

	try {
		var json_str = converter.ConvertFromUnicode(JSON.stringify(json_data));
		fileOutputStream.init(file, 0x02 | 0x08 | 0x20, 0644, 0);
		fileOutputStream.write(json_str, json_str.length);
	}
	catch(e) {
		return false;
	}

	fileOutputStream.close();
	return true;
}
//------------------------------------------------------------------------------
magdown.history.set_history = function(s3id, json_data) {
	var history_file = magdown.history.create_file(s3id);
	if (history_file) {
		magdown.history.write_file(history_file, json_data);
	}
}
//------------------------------------------------------------------------------
magdown.history.get_history = function(s3id) {
	var history_file = magdown.history.open_file(s3id);
	if (history_file) {
		return magdown.history.read_file(history_file);
	}
	return false;
}
//------------------------------------------------------------------------------
magdown.history.remove_history = function(s3id) {
	var history_file = magdown.history.open_file(s3id);
	if (history_file) {
		history_file.remove(false);
	}
}
//------------------------------------------------------------------------------
