this.EXPORTED_SYMBOLS = [ "file" ];

var magdown = {};
magdown.file = {};
this.file = magdown.file;

//-----------------------------------------------------------------------------------
magdown.file.load_data = function(torrent) {
	var set_calc = true;
	var length_data = 0;

	for (var file of torrent.metadata.file_list) {
		if (file.status && (file.status == 'skip')) {
		} else {
			file.status = 'process';
		}
		//----------------------------------------------------------------------
		var file_size = magdown.file.get_file_size(torrent, file);
		file.downloaded = file_size;
		if (file_size < 0) {
			length_data = -1;
			break;
		}
		else if (file.status && (file.status == 'skip')) {
		}
		else if (file_size == file.length) {
			file.status = 'done';
			if (set_calc) {
				length_data += file_size;
			}
		}
		else if (file_size < file.length) {
			if (set_calc) {
				length_data += file_size;
			}
			set_calc = false;
		} else if (file_size > file.length) {
			length_data = -1;
			break;
		}
	}
	return length_data;
}
//-----------------------------------------------------------------------------------
magdown.file.save_data = function(torrent, piece_data) {
	var piece_id = piece_data.piece_id;
	var length_piece = piece_data.data.byteLength;
	var length_ofset_piece = piece_id * torrent.metadata.piece_length;
	var length_ofset_file = 0;
	var file_count = 0;

	for (var file of torrent.metadata.file_list) {
		if (length_piece <= 0) {
			break;
		}
//		if (file.length == 0) {
//			file.status = 'done';
//		}
		if (((file.length + length_ofset_file) > length_ofset_piece) && (length_piece > 0)) {
			var result = magdown.file.save_file(torrent, file, piece_data, length_ofset_piece, length_ofset_file);
			length_ofset_piece += length_piece - result.length;
			length_piece = result.length;
			piece_data.data = result.data;
			file_count++;
			if (result.file_is_done) {
				file.status = 'done';
			}
		}
		length_ofset_file += file.length;
	}
	return (length_piece >= 0) ? file_count : length_piece;
}
//-----------------------------------------------------------------------------------
magdown.file.delete_data = function(torrent, force) {
	for (var file of torrent.metadata.file_list) {
		if (force || (file.status == 'process')) {
			magdown.file.delete_file(torrent, file);
		}
	}
	return true;
}
//------------------------------------------------------------------------------
magdown.file.save_file = function(torrent, file_data, piece_data, length_ofset_piece, length_ofset_file) {
	var save_dir = torrent.metadata.save_dir;
	//-----------------------------------------------------------------------
	if (file_data.status && ((file_data.status == 'skip') || (file_data.status == 'done'))) {
		var length_ofset_f_data = length_ofset_file + file_data.length;
		var length_ofset_p_data = (piece_data.piece_id+1) * torrent.metadata.piece_length;
		if (length_ofset_p_data <= length_ofset_f_data) {
			return { 'length': 0, 'data': new Uint8Array(0) };
		}

		var data_size = length_ofset_f_data - length_ofset_piece;
		if (data_size >= piece_data.data.byteLength) {
			data_size = piece_data.data.byteLength;
		}
		var data_save = new Uint8Array(piece_data.data.buffer.slice(0, data_size));
		piece_data.data = new Uint8Array(piece_data.data.buffer.slice(data_size));
		return { 'length': piece_data.data.byteLength, 'data': piece_data.data };
	}

	//-----------------------------------------------------------------------
	var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	//-----------------------------------------------------------------------
	try {
		file.initWithPath(save_dir);
		if (file_data.parent_dir != '') {
			file.append(file_data.parent_dir);
		}

		for (var file_path of file_data.path) {
			if (file_path != '') {
				file.append(file_path);
			}
		}
	} catch(e) {
		magdown.file.download_error(torrent, 'error.make_file_path', file.path);
		return { 'length': -1, 'data': piece_data.data };
	}

	//-----------------------------------------------------------------------
	if (! file.exists()) {
		file.create( Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0664);
	}

	//-----------------------------------------------------------------------
	if ((length_ofset_piece - length_ofset_file) != file.fileSize) {
		if ((length_ofset_piece - length_ofset_file) == 0) {
			var data_size = file.fileSize;
			if (data_size >= piece_data.data.byteLength) {
				data_size = piece_data.data.byteLength;
			}
			var data_save = new Uint8Array(piece_data.data.buffer.slice(0, data_size));
			piece_data.data = new Uint8Array(piece_data.data.buffer.slice(data_size));
			return { 'length': piece_data.data.byteLength, 'data': piece_data.data };
		} else {
			magdown.file.download_error(torrent, 'error.incorrect_file_size', file.path);
			return { 'length': -1, 'data': piece_data.data };
		}
	}
	//-----------------------------------------------------------------------
	if (piece_data.data.byteLength > file.diskSpaceAvailable) {
		magdown.file.download_error(torrent, 'error.out_of_disk_space');
		return { 'length': -1, 'data': piece_data.data };
	}

	var data_size = file_data.length - file.fileSize;
	if (data_size >= piece_data.data.byteLength) {
		data_size = piece_data.data.byteLength;
	}

	var data_save = new Uint8Array(piece_data.data.buffer.slice(0, data_size));
	piece_data.data = new Uint8Array(piece_data.data.buffer.slice(data_size));
	var file_is_done = (file_data.length == (file.fileSize + data_size)) ? true : false;

	//-----------------------------------------------------------------------
	try {
		var fileOutputStream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
		fileOutputStream.init(file, 0x02 | 0x08 | 0x10, 0644, 0);

		var binaryStream = Components.classes["@mozilla.org/binaryoutputstream;1"].createInstance(Components.interfaces.nsIBinaryOutputStream);
		binaryStream.setOutputStream(fileOutputStream);
		binaryStream.writeByteArray(data_save, data_save.byteLength);

//		fileOutputStream.flush();
		fileOutputStream.close();
	}
	catch(e) {
		file_is_done = false;
		magdown.file.download_error(torrent, 'error.file_write', file.path);
		return { 'length': -1, 'data': piece_data.data };
	}

	return { 'length': piece_data.data.byteLength, 'data': piece_data.data, 'file_is_done': file_is_done };
}
//------------------------------------------------------------------------------
magdown.file.get_file_size = function(torrent, file_data) {
	var save_dir = torrent.metadata.save_dir;

	var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	//-----------------------------------------------------------------------
	try {
		file.initWithPath(save_dir);
		if (file_data.parent_dir != '') {
			file.append(file_data.parent_dir);
		}

		for (var file_path of file_data.path) {
			if (file_path != '') {
				file.append(file_path);
			}
		}
	} catch(e) {
		return -1;
	}

	//-----------------------------------------------------------------------
	if (! file.exists()) {
		return 0;
	} else {
		return file.fileSize;
	}
}
//------------------------------------------------------------------------------
magdown.file.delete_file = function(torrent, file_data) {
	var save_dir = torrent.metadata.save_dir;

	var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	var parent_dir = '';

	//-----------------------------------------------------------------------
	try {
		file.initWithPath(save_dir);
		if (file_data.parent_dir != '') {
			file.append(file_data.parent_dir);
			parent_dir = file.path;
		}
		for (var file_path of file_data.path) {
			if (file_path != '') {
				file.append(file_path);
			}
		}
		if (file.exists()) {
			file.remove(false);
		}
		//----------------------------------------------------------------
		if (file_data.parent_dir != '') {
			var is_remove_dir = true;
			while (is_remove_dir) {
				try {
					//-------------------------------------------
					if (! file.parent) {
						is_remove_dir = false;
						break;
					}
					//-------------------------------------------
					file = file.parent;
					if (file.isDirectory()) {
						var entries = file.directoryEntries;
						if (! entries.hasMoreElements()) {
							file.remove(false);
						} else {
							is_remove_dir = false;
						}
					} else {
						is_remove_dir = false;
					}
					//-------------------------------------------
					if (file.path == parent_dir) {
						is_remove_dir = false;
					}
				} catch(e) {
					is_remove_dir = false;
				}
			}
		}
	} catch(e) {
		return -1;
	}
}
//------------------------------------------------------------------------------
magdown.file.open_file = function(torrent, file_id) {
	var save_dir = torrent.metadata.save_dir;
	var file_data = torrent.metadata.file_list[file_id];

	var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);

	//-----------------------------------------------------------------------
	file.initWithPath(save_dir);
	if (file_data.parent_dir != '') {
		file.append(file_data.parent_dir);
	}
	for (var file_path of file_data.path) {
		if (file_path != '') {
			file.append(file_path);
		}
	}
	
	if (file.exists()) {
		try {
			file.launch();
		} catch (ex) {
			var uri = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService).newFileURI(file);
			var protocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].getService(Components.interfaces.nsIExternalProtocolService);
			protocolSvc.loadUrl(uri);
		}
		return true;
	}
	return false;
}
//------------------------------------------------------------------------------
magdown.file.save_metadata = function(win, torrent, data_save) {
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fp.init(win, null, Components.interfaces.nsIFilePicker.modeSave);
	fp.defaultString = torrent.metadata.info.name + '.torrent';
	fp.appendFilter("Torrent", "*.torrent");
	fp.defaultExtension = 'torrent';
	var result = fp.show();
	var file = null;
	//-----------------------------------------------------------------------
	if (result == fp.returnOK || result == fp.returnReplace) {
		file = fp.file;
	} else {
		return false;
	}
	//-----------------------------------------------------------------------
	var file_ext_required = false;
	if (! (/\.torrent$/.test(fp.file.path))) {
		file_ext_required = true;
	}
	if (file_ext_required) {
		file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		try {
			file.initWithPath(fp.file.path + '.torrent');
			if (file.exists()) {
				file.remove(false);
			}
			file.create( Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0664);
		} catch(e) {
			return false;
		}
	}

	//-----------------------------------------------------------------------
	try {
		var fileOutputStream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
		fileOutputStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0);

		var binaryStream = Components.classes["@mozilla.org/binaryoutputstream;1"].createInstance(Components.interfaces.nsIBinaryOutputStream);
		binaryStream.setOutputStream(fileOutputStream);
		binaryStream.writeByteArray(data_save, data_save.byteLength);
		fileOutputStream.close();

		return true;
	} catch (e) {
	}

	return false;
}
//------------------------------------------------------------------------------
magdown.file.download_error = function() {
}
//------------------------------------------------------------------------------
