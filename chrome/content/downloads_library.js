
var s3torrent = {};
Components.utils.import("resource://s3torrent/utils.js", s3torrent);

s3torrent.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.s3torrent.");
s3torrent.prefs_global = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
s3torrent.draw_box = { start_x:0, start_y:0, start_draw: false };
s3torrent.sort_handler = null;
s3torrent.sort_handler_count = 0;
s3torrent.new_items_list = [];
s3torrent.new_items_list_handler = null;
s3torrent.remove_items_list = [];
s3torrent.remove_items_list_handler = null;

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
s3torrent.init = function() {
	var S3TorrentTornado_class = Components.classes["@s3torrent.com/tornado;1"];
	var S3TorrentTornado = S3TorrentTornado_class.getService().wrappedJSObject;
	s3torrent.torrent = S3TorrentTornado.torrent;

	setTimeout(function(){ s3torrent.init_run(); } , 100);
}
//------------------------------------------------------------------------------
s3torrent.close = function() {
	s3torrent.unregister();
}
//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
s3torrent.observe = function(subject, topic, s3torrent_id) {
	if (topic == "s3torrent-change") {
		var torrent = s3torrent.torrent.doCommand(s3torrent_id, 'get_torrent_data');
		if (torrent) {
			s3torrent.event_changed(torrent.metadata);
		}
	}
	else if (topic == "s3torrent-remove") {
		s3torrent.remove_items_list.push(s3torrent_id);
		if (s3torrent.remove_items_list_handler != null) {
			clearTimeout(s3torrent.remove_items_list_handler);
		}
		s3torrent.remove_items_list_handler = setTimeout(function(){ s3torrent.event_removed(); } , 100);
	}
}
//------------------------------------------------------------------------------
s3torrent.register = function() { 
	var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
	observerService.addObserver(s3torrent, "s3torrent-change", false);
	observerService.addObserver(s3torrent, "s3torrent-remove", false);
}
//------------------------------------------------------------------------------
s3torrent.unregister = function() {
	try {
		var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
		observerService.removeObserver(s3torrent, "s3torrent-change");
		observerService.removeObserver(s3torrent, "s3torrent-remove");
	} catch(e) {
	}
}
//------------------------------------------------------------------------------
s3torrent.init_run = function() {
	s3torrent.tree = document.getElementById('s3torrent_tree');
	s3torrent.tree.view = s3torrent.treeView;
	//------------------------------------------------------------------------
	var pref_branch = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.s3torrent.");

	//------------------------------------------------------------------------
	document.getElementById('s3torrent_button_add_torrent').hidden = ! pref_branch.getBoolPref('DL.showAddNewTorrent');
	document.getElementById('s3torrent_button_pause_all').hidden = ! pref_branch.getBoolPref('DL.showPauseButton');
	document.getElementById('s3torrent_button_resume_all').hidden = ! pref_branch.getBoolPref('DL.showResumeButton');
	document.getElementById('s3torrent_button_cancel_all').hidden = ! pref_branch.getBoolPref('DL.showCancelButton');
	document.getElementById('s3torrent_button_remove_all').hidden = ! pref_branch.getBoolPref('DL.showRemoveButton');

	//------------------------------------------------------------------------
	s3torrent.dateTime_format = pref_branch.getCharPref('DL.dateTimeFormat');

	//------------------------------------------------------------------------
	s3torrent.count_summary();
	s3torrent.register();


	var torrent_id_list = s3torrent.torrent.doCommand('all', 'get_torrent_id_list');
	//------------------------------------------------------------------------
	for(var s3torrent_id in torrent_id_list) {
		var torrent = s3torrent.torrent.doCommand(s3torrent_id, 'get_torrent_data');
		s3torrent.new_items_list.push(torrent.metadata);
		if (s3torrent.new_items_list_handler != null) {
			clearTimeout(s3torrent.new_items_list_handler);
		}
		s3torrent.new_items_list_handler = setTimeout(function(){ s3torrent.event_added(); } , 100);
	}

	//------------------------------------------------------------------------
	var treecols = s3torrent.tree.getElementsByTagName("treecol");
	for (var treecol of treecols) {
		if (treecol.getAttribute("sortActive")) {
			s3torrent.treeView.sortName = treecol.id;
			s3torrent.treeView.sortDirection = treecol.getAttribute("sortDirection");
		}
	}
}
//------------------------------------------------------------------------------
s3torrent.event_added = function() {
	var count_new = 0;
	var new_items = [];
	while (s3torrent.new_items_list.length > 0) {
		var metadata = s3torrent.new_items_list.shift();
		var aDownload = s3torrent.create_aDownload(metadata);
		var res = s3torrent.get_row_download(aDownload.s3id);
		if (res.row < 0) {
			new_items.push(aDownload);
			if (aDownload.isView) {
				count_new++;
			}
		}
	}
	s3torrent.treeView.download_list = s3torrent.treeView.download_list.concat(new_items);
	if (count_new > 0) {
		s3torrent.treeView.tree.rowCountChanged(0, count_new);
		s3torrent.treeView.rowCount += count_new;
		s3torrent.treeView.sortElements();

		if (! document.getElementById('s3torrent_info').current_torrent_id) {
			s3torrent.treeView.selection.currentIndex = 0;
			s3torrent.torrent_info_show(s3torrent.get_download(0), true);
		}
	}
}
//------------------------------------------------------------------------------
s3torrent.event_removed = function() {
	var count_remove = 0;
	while (s3torrent.remove_items_list.length > 0) {
		var s3id = s3torrent.remove_items_list.shift();
		s3torrent.torrent_info_remove(s3id);
		var res = s3torrent.get_row_download(s3id);
		if (res.row >= 0) {
			if (res.row_tree >= 0) {
				count_remove++;
			}
			s3torrent.treeView.download_list.splice(res.row, 1);
		}
	}
	if (count_remove > 0) {
		s3torrent.treeView.tree.rowCountChanged(s3torrent.treeView.rowCount, count_remove * (-1));
		s3torrent.treeView.rowCount -= count_remove;
		s3torrent.treeView.sortElements();
	}
}
//------------------------------------------------------------------------------
s3torrent.event_changed = function(metadata) {
	var aDownload = s3torrent.create_aDownload(metadata);
	s3torrent.torrent_info_show(aDownload);
	var res = s3torrent.get_row_download(aDownload.s3id);
	if (res.row >= 0) {
		s3torrent.treeView.download_list.splice(res.row, 1, aDownload);
		s3torrent.treeView.change_data(res.row_tree);
	} else {
		s3torrent.treeView.insert_data(aDownload);
	}
}
//------------------------------------------------------------------------------
s3torrent.create_aDownload = function(metadata) {
	var s3torrent_id = metadata.s3torrent_id;
	var total_size = s3torrent.torrent.doCommand(s3torrent_id, 'get_total_size');
	var downloaded_size = s3torrent.torrent.doCommand(s3torrent_id, 'get_downloaded_size');

	// --------------------------
	var aDownload = {
		s3id : s3torrent_id,
		s3_metaData : {
			displayName : metadata.info.name,
			downloadUri : metadata.torrent_url || s3torrent.torrent.doCommand(s3torrent_id, 'get_magnet_link'),
			referrerUri : metadata.referrer_url,
			magnetUri : s3torrent.torrent.doCommand(s3torrent_id, 'get_magnet_link'),
			percentComplete : (total_size > 0) ? Math.ceil(downloaded_size * 100 / total_size) : 100,
			timeRemaining : 0,
			timeRemainingText : '--.--',
			done : metadata.is_completed,
			speed : metadata.download_speed,
			fileSize : total_size,
			curSize : downloaded_size,
			saveDir : metadata.save_dir,
			torrentName : metadata.info.name,
			inProgress : ! metadata.is_completed,
			error : metadata.is_error,
			paused : (metadata.is_completed) ? false : metadata.is_stopped,
			endTime : metadata.end_time
		},
		doCommand : function(cmd, params) {
			return s3torrent.torrent.doCommand(s3torrent_id, cmd, params);
		}
	}

	// --------------------------
	aDownload.s3_metaData.speed = (aDownload.s3_metaData.paused || ! aDownload.s3_metaData.inProgress) ? 0 : aDownload.s3_metaData.speed;
	if (aDownload.s3_metaData.speed > 0) {
		aDownload.s3_metaData.timeRemaining = (1 / aDownload.s3_metaData.speed) * (aDownload.s3_metaData.fileSize - aDownload.s3_metaData.curSize);
		aDownload.s3_metaData.timeRemainingText = s3torrent.utils.format_seconds(aDownload.s3_metaData.timeRemaining);
	}
	// --------------------------
	aDownload.isView = s3torrent.check_download_filter(aDownload, s3torrent.treeView.filterText);
	aDownload.s3_metaData.curSizeString = s3torrent.utils.get_strings_to_KB_MB_GB(aDownload.s3_metaData.curSize);
	aDownload.s3_metaData.fileSizeString = s3torrent.utils.get_strings_to_KB_MB_GB(aDownload.s3_metaData.fileSize);

	//-----------------------------------------------------------------------
	aDownload.s3_metaData.speedText = '';
	aDownload.s3_metaData.speedText = s3torrent.utils.get_strings_to_KB_MB_GB(aDownload.s3_metaData.speed, true);

	//-----------------------------------------------------------------------
	[aDownload.s3_metaData.peerCountAll, aDownload.s3_metaData.peerCountWork] = s3torrent.torrent.doCommand(s3torrent_id, 'get_peer_count');


	return aDownload;
}
//------------------------------------------------------------------------------
s3torrent.get_row_download = function(s3id) {
	var row_tree = -1;
	var result = { 'row': -1, 'row_tree': -1 };
	//-----------------------------------------------------------------------
	for (var row in s3torrent.treeView.download_list) {
		var d = s3torrent.treeView.download_list[row];
		if (d.isView) {
			row_tree++;
		}
		if (d.s3id == s3id) {
			result = { 'row': row, 'row_tree': row_tree };
			return result;
		}
	}
	return result;
}
//------------------------------------------------------------------------------
s3torrent.get_download_metaData = function(row) {
	var search_row = -1;
	for (var d of s3torrent.treeView.download_list) {
		if (d.isView) {
			search_row++;
		}
		if (search_row == row) {
			return d.s3_metaData;
		}
	}
	return false;
}
//------------------------------------------------------------------------------
s3torrent.get_download = function(row) {
	var search_row = -1;
	for (var d of s3torrent.treeView.download_list) {
		if (d.isView) {
			search_row++;
		}
		if (search_row == row) {
			return d;
		}
	}
	return false;
}
//------------------------------------------------------------------------------
s3torrent.get_download_by_s3id = function(s3id) {
	for (var d of s3torrent.treeView.download_list) {
		if (d.s3id == s3id) {
			return d;
		}
	}
	return false;
}
//------------------------------------------------------------------------------
s3torrent.check_download_filter = function(aDownload, filter_text) {
	var result = false;

	if (aDownload.s3_metaData.displayName.toLowerCase().indexOf(filter_text) >= 0) { result = true; }

	return result;
}
//------------------------------------------------------------------------------
s3torrent.count_summary = function() {
	var progress_count = 0;
	var downloads_all = 0;
	var percentComplete = 0;
	var timeRemaining = 0;
	var speedMax = 0;
	var speedCount = 0;
	var cancel_count = 0;
	var pause_count = 0;

	//-----------------------------------------------------------------------
	for (var aDownload of s3torrent.treeView.download_list) {
		if (aDownload.isView) {
			downloads_all++;
			if (! aDownload.s3_metaData.done) {
				progress_count++;
				if (! aDownload.s3_metaData.inProgress) {
					cancel_count++;
				} else {
					if (aDownload.s3_metaData.paused) {
						pause_count++;
					}
					percentComplete += aDownload.s3_metaData.percentComplete;
				}
				if (aDownload.s3_metaData.speed > 0) {
					var timeR = (1 / aDownload.s3_metaData.speed) * (aDownload.s3_metaData.fileSize - aDownload.s3_metaData.curSize);
					timeRemaining = (timeR > timeRemaining) ? timeR : timeRemaining;
					speedMax += aDownload.s3_metaData.speed;
					speedCount++;
				}
			}
		}
	}

	//-----------------------------------------------------------------------
	var done_count = downloads_all - progress_count;
	//-----------------------------------------------------------------------
	percentComplete = ((progress_count-cancel_count) > 0) ? Math.ceil(percentComplete / (progress_count-cancel_count)) : 0;
	document.getElementById('s3torrent_summary_text').value = progress_count + '/' + done_count;
	document.getElementById('s3torrent_summary_progress').value = Math.ceil(percentComplete);

	//-----------------------------------------------------------------------
	if ((percentComplete == 0) && ((progress_count-cancel_count) <= 0)) {
		percentComplete = 100;
	}
	var timeRemainingText = (timeRemaining > 0) ? ' :: ' + s3torrent.utils.format_seconds(timeRemaining) : '';
	//-----------------------------------------------------------------------
	var speedText = ' :: ' + s3torrent.utils.get_strings_to_KB_MB_GB(speedMax, true);
	document.getElementById('s3torrent_summary_progress_text').value = percentComplete + '%' + timeRemainingText + speedText;

	//-----------------------------------------------------------------------
	var s3torrent_button_pause_all = document.getElementById('s3torrent_button_pause_all');
	s3torrent_button_pause_all.disabled = (progress_count - (pause_count+cancel_count)) > 0 ? false : true;
	s3torrent_button_pause_all.label = s3torrent_button_pause_all.getAttribute("label_pre") + ((progress_count - (pause_count+cancel_count)) > 0 ? ' (' + (progress_count - (pause_count+cancel_count)) + ')' : '');

	var s3torrent_button_resume_all = document.getElementById('s3torrent_button_resume_all');
	s3torrent_button_resume_all.disabled = ((pause_count + cancel_count) > 0) ? false : true;
	s3torrent_button_resume_all.label = s3torrent_button_resume_all.getAttribute("label_pre") + (((pause_count + cancel_count) > 0) ? ' (' + (pause_count + cancel_count) + ')' : '');

	var s3torrent_button_cancel_all = document.getElementById('s3torrent_button_cancel_all');
	s3torrent_button_cancel_all.disabled = ((progress_count - cancel_count) > 0) ? false : true;
	s3torrent_button_cancel_all.label = s3torrent_button_cancel_all.getAttribute("label_pre") + (((progress_count-cancel_count)>0) ? ' (' + (progress_count-cancel_count) + ')' : '');

	var s3torrent_button_remove_all = document.getElementById('s3torrent_button_remove_all');
	s3torrent_button_remove_all.disabled = (done_count > 0) ? false : true;
	s3torrent_button_remove_all.label = s3torrent_button_remove_all.getAttribute("label_pre") + ((done_count>0) ? ' (' + done_count + ')' : '');
}
//------------------------------------------------------------------------------
s3torrent.check_menupopup = function(event) {
	if (event.explicitOriginalTarget._lastSelectedRow < 0) {
		s3torrent.treeView.selection.clearSelection();
		return false;
	}

	//-----------------------------------------------------------------------
	var select_count = 0;
	var progress_count = 0;
	var done_count = 0;
	var pause_count = 0;
	var fileSizeMax = -1;
	var fileSizeCount = 0;
	var cancel_count = 0;
	var referrerUri_count = 0;
	var selectionHash = s3torrent.treeView.selectionGet();
	var downloads_count = 0;
	//-----------------------------------------------------------------------
	for (var s3id in selectionHash) {
		select_count++;
		var aDownload = selectionHash[s3id];
		//-----------------------------------------------------------------
		if (aDownload.s3_metaData.done) {
			done_count++;
			fileSizeMax = (aDownload.s3_metaData.fileSize > fileSizeMax) ? aDownload.s3_metaData.fileSize : fileSizeMax;
			if (aDownload.s3_metaData.fileSize >= 0) {
				fileSizeCount++;
			}
		} else {
			if (aDownload.s3_metaData.paused) {
				pause_count++;
			}
			if (! aDownload.s3_metaData.inProgress) {
				cancel_count++;
			}
			progress_count++;
		}
		//-----------------------------------------------------------------
		if (aDownload.s3_metaData.referrerUri != '') {
			referrerUri_count++;
		}
	}
	//-----------------------------------------------------------------------
	for (var aDownload of s3torrent.treeView.download_list) {
		if (aDownload.isView && (aDownload.s3_metaData.done || (! aDownload.s3_metaData.inProgress))) {
			downloads_count++;
		}
	}

	//-----------------------------------------------------------------------
	if (select_count == 0) {
		return false;
	}
	//-----------------------------------------------------------------------
	var s3torrent_pause = document.getElementById('s3torrent_pause');
	s3torrent_pause.hidden = (progress_count > 0) ? false : true;
	s3torrent_pause.disabled = ((pause_count+cancel_count) == progress_count) ? true : false;
	s3torrent_pause.label = s3torrent_pause.getAttribute("label_pre") + (((progress_count - (pause_count+cancel_count))>1) || (select_count > 1) ? ' (' + (progress_count - (pause_count+cancel_count)) + ')' : '');
	//-----------------------------------------------------------------------
	var s3torrent_resume = document.getElementById('s3torrent_resume');
	s3torrent_resume.hidden = (progress_count > 0) ? false : true;
	s3torrent_resume.disabled = ((pause_count + cancel_count) > 0) ? false : true;
	s3torrent_resume.label = s3torrent_resume.getAttribute("label_pre") + (((pause_count + cancel_count) > 1) || (select_count > 1) ? ' (' + (pause_count + cancel_count) + ')' : '');
	//-----------------------------------------------------------------------
	var s3torrent_cancel = document.getElementById('s3torrent_cancel');
	s3torrent_cancel.hidden = (progress_count > 0) ? false : true;
	s3torrent_cancel.disabled = (cancel_count > 0) ? true : false;
	s3torrent_cancel.label = s3torrent_cancel.getAttribute("label_pre") + (((progress_count-cancel_count)>1) || (select_count > 1) ? ' (' + (progress_count-cancel_count) + ')' : '');
	//-----------------------------------------------------------------------
	var s3torrent_retry = document.getElementById('s3torrent_retry');
	s3torrent_retry.hidden = ((done_count + pause_count + cancel_count) > 0) ? false : true;
	s3torrent_retry.disabled = ((done_count + pause_count + cancel_count) > 0) ? false : true;
	s3torrent_retry.label = s3torrent_retry.getAttribute("label_pre") + (((done_count + pause_count + cancel_count) > 1) || (select_count > 1) ? ' (' + (done_count + pause_count + cancel_count) + ')' : '');
	//-----------------------------------------------------------------------
	var s3torrent_trackers = document.getElementById('s3torrent_trackers');
	s3torrent_trackers.hidden = (select_count == 1) ? false : true;
	s3torrent_trackers.disabled = ((done_count + pause_count + cancel_count) > 0) ? false : true;
	//-----------------------------------------------------------------------
	var s3torrent_copy_link = document.getElementById('s3torrent_copy_link');
	s3torrent_copy_link.label = s3torrent_copy_link.getAttribute("label_pre") + (select_count>1 ? ' (' + select_count + ')' : '');
	//-----------------------------------------------------------------------
	var s3torrent_download_page = document.getElementById('s3torrent_download_page');
	s3torrent_download_page.disabled = (referrerUri_count > 0) ? false : true;
	s3torrent_download_page.label = s3torrent_download_page.getAttribute("label_pre") + (select_count>1 ? ' (' + referrerUri_count + ')' : '');
	//-----------------------------------------------------------------------
	var s3torrent_remove_history = document.getElementById('s3torrent_remove_history');
	s3torrent_remove_history.hidden = ((done_count+cancel_count) > 0) ? false : true;
	s3torrent_remove_history.label = s3torrent_remove_history.getAttribute("label_pre") + (((done_count+cancel_count)>1) || (select_count > 1) ? ' (' + (done_count+cancel_count) + ')' : '');
	//-----------------------------------------------------------------------
	var s3torrent_delete_file = document.getElementById('s3torrent_delete_file');
	s3torrent_delete_file.hidden = (done_count > 0) ? false : true;
	s3torrent_delete_file.label = s3torrent_delete_file.getAttribute("label_pre") + ((done_count>1) || (select_count > 1) ? ' (' + fileSizeCount + ')' : '');
	s3torrent_delete_file.disabled = (fileSizeMax >= 0) ? false : true;
	//-----------------------------------------------------------------------
	var s3torrent_open_file = document.getElementById('s3torrent_open_file');
	s3torrent_open_file.hidden = ((select_count == 1) && done_count > 0) ? false : true;
	s3torrent_open_file.disabled = (fileSizeMax >= 0) ? false : true;
	//-----------------------------------------------------------------------
	var s3torrent_show_dir = document.getElementById('s3torrent_show_dir');
//	s3torrent_show_dir.hidden = ((select_count == 1) && done_count > 0) ? false : true;
//	s3torrent_show_dir.disabled = (fileSizeMax >= 0) ? false : true;
	s3torrent_show_dir.hidden = (select_count == 1)  ? false : true;
	s3torrent_show_dir.disabled = false;

	//-----------------------------------------------------------------------
	var s3torrent_save_metadata = document.getElementById('s3torrent_save_metadata');
	s3torrent_save_metadata.label = s3torrent_save_metadata.getAttribute("label_pre") + (select_count>1 ? ' (' + select_count + ')' : '');

	//-----------------------------------------------------------------------
	document.getElementById('s3torrent_menuseparator_1').hidden = (s3torrent_pause.hidden && s3torrent_resume.hidden && s3torrent_cancel.hidden && s3torrent_retry.hidden && s3torrent_trackers.hidden) ? true : false;
	document.getElementById('s3torrent_menuseparator_2').hidden = (s3torrent_remove_history.hidden && s3torrent_delete_file.hidden) ? true : false;
	document.getElementById('s3torrent_menuseparator_3').hidden = (s3torrent_open_file.hidden && s3torrent_show_dir.hidden) ? true : false;
}
//------------------------------------------------------------------------------
s3torrent.action = function(action) {
	var selectionHash = s3torrent.treeView.selectionGet();
	//-----------------------------------------------------------------------
	if (action == 'pause') {
		for (var s3id in selectionHash) {
			if (! selectionHash[s3id].s3_metaData.done && ! selectionHash[s3id].s3_metaData.paused) {
				selectionHash[s3id].doCommand("downloadsCmd_pauseResume");
			}
		}
	}
	//-----------------------------------------------------------------------
	else if (action == 'resume') {
		for (var s3id in selectionHash) {
			if (! selectionHash[s3id].s3_metaData.done && (selectionHash[s3id].s3_metaData.paused || ! selectionHash[s3id].s3_metaData.inProgress)) {
				selectionHash[s3id].doCommand("downloadsCmd_pauseResume");
			}
		}
	}
	//-----------------------------------------------------------------------
	else if (action == 'cancel') {
		//----------------------------------------------------------------
		var count = 0;
		for (var s3id in selectionHash) {
			if (! selectionHash[s3id].s3_metaData.done) {
				count++;
			}
		}
		//----------------------------------------------------------------
		if (count == 0) { return false; }
		//----------------------------------------------------------------
		var s3torrent_cancel = document.getElementById('s3torrent_cancel');
		var message = s3torrent_cancel.getAttribute("label_pre") + ' (' + count + ')';
		//----------------------------------------------------------------
		var s3torrent_confirmMsg = s3torrent.utils.get_string("areYouSureConfirm");
		if (! s3torrent.utils.confirm(message + "\n" + s3torrent_confirmMsg)) {
			return;
		}
		//----------------------------------------------------------------
		for (var s3id in selectionHash) {
			if (! selectionHash[s3id].s3_metaData.done) {
				selectionHash[s3id].doCommand("downloadsCmd_cancel");
			}
		}
	}
	//-----------------------------------------------------------------------
	else if (action == 'retry') {
		//----------------------------------------------------------------
		var s3torrent_confirmMsg = s3torrent.utils.get_string("areYouSureConfirm");
		if (! s3torrent.utils.confirm(s3torrent_confirmMsg)) {
			return;
		}
		//----------------------------------------------------------------
		var selection_count = s3torrent.treeView.selection.count;
		for (var s3id in selectionHash) {
			var aDownload = selectionHash[s3id];
			if (aDownload.s3_metaData.done || aDownload.s3_metaData.paused) {
				var file_path = aDownload.s3_metaData.saveDir;
				var run_process = true;
				var is_promt = (selection_count > 1) ? false : true;
				var localDir = s3torrent.utils.get_localFile_dir(file_path);
				if (! localDir) {
					is_promt = true;
				}
				//----------------------------------------------------
				if (is_promt) {
					var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
					fp.init(window, '', Components.interfaces.nsIFilePicker.modeGetFolder);

					//-------------------------------------------------
					if (! localDir) {
						localDir = s3torrent.utils.get_default_save_dir();
					}
					//-------------------------------------------------
					if (localDir) {
						fp.displayDirectory = localDir;
					}
					//-------------------------------------------------
					var result = fp.show();
					//-------------------------------------------------
					if (result == fp.returnOK || result == fp.returnReplace) {
						file_path = fp.file.path;
					} else {
						run_process = false;
					}
				}

				//----------------------------------------------------
				if (run_process) {
					selectionHash[s3id].doCommand("downloadsCmd_retry", { 'save_dir' : file_path });
				}
			}
		}
	}
	//-----------------------------------------------------------------------
	else if (action == 'trackers') {
		var aDownload = s3torrent.get_download(s3torrent.treeView.selection.currentIndex);
		var tracker_list = aDownload.doCommand('get_tracker_list');
		var winD = window.openDialog('chrome://s3torrent/content/change_tracker.xul', 's3torrent_change_tracker', 'chrome,modal,centerscreen,toolbar', tracker_list);
		if (winD.result && winD.result.is_ok) {
			aDownload.doCommand('set_tracker_list', { 'tracker_list' : winD.result.tracker_list });
		}
	}
	//-----------------------------------------------------------------------
	else if (action == 'copy_link') {
		var copy_link = [];
		var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);
		for (var s3id in selectionHash) {
			copy_link.push(selectionHash[s3id].s3_metaData.downloadUri);
		}
		var string = copy_link.join("\n") + (copy_link.length>1 ? "\n" : '');
		clipboard.copyString(string);
	}
	//-----------------------------------------------------------------------
	else if (action == 'download_page') {
		for (var s3id in selectionHash) {
			if (selectionHash[s3id].s3_metaData.referrerUri != '') {
				openURL(selectionHash[s3id].s3_metaData.referrerUri);
			}
		}
	}
	//-----------------------------------------------------------------------
	else if ((action == 'remove_history') || (action == 'remove_history_all_done')) {
		//----------------------------------------------------------------
		var count = 0;
		for (var s3id in selectionHash) {
			if (selectionHash[s3id].s3_metaData.done) {
				count++;
			} else if ((action == 'remove_history') && ! selectionHash[s3id].s3_metaData.inProgress) {
				count++;
			}
		}
		//----------------------------------------------------------------
		if (count == 0) { return false; }
		//----------------------------------------------------------------
		var s3torrent_remove_history = document.getElementById('s3torrent_remove_history');
		var message = s3torrent_remove_history.getAttribute("label_pre") + ' (' + count + ')';
		//----------------------------------------------------------------
		var s3torrent_confirmMsg = s3torrent.utils.get_string("areYouSureConfirm");
		if (! s3torrent.utils.confirm(message + "\n" + s3torrent_confirmMsg)) {
			return;
		}
		//----------------------------------------------------------------
		for (var s3id in selectionHash) {
			if (selectionHash[s3id].s3_metaData.done) {
				selectionHash[s3id].doCommand("cmd_delete");
			} else if ((action == 'remove_history') && ! selectionHash[s3id].s3_metaData.inProgress) {
				selectionHash[s3id].doCommand("cmd_delete");
			}
		}
	}
	//-----------------------------------------------------------------------
	else if (action == 'delete_file') {
		//----------------------------------------------------------------
		var count = 0;
		for (var s3id in selectionHash) {
			if (selectionHash[s3id].s3_metaData.done && (selectionHash[s3id].s3_metaData.fileSize >= 0)) {
				count++;
			}
		}
		//----------------------------------------------------------------
		if (count == 0) { return false; }
		//----------------------------------------------------------------
		var s3torrent_delete_file = document.getElementById('s3torrent_delete_file');
		var message = s3torrent_delete_file.getAttribute("label_pre") + ' (' + count + ')';
		//----------------------------------------------------------------
		var s3torrent_confirmMsg = s3torrent.utils.get_string("areYouSureConfirm");
		if (! s3torrent.utils.confirm(message + "\n" + s3torrent_confirmMsg)) {
			return;
		}
		//----------------------------------------------------------------
		for (var s3id in selectionHash) {
			if (selectionHash[s3id].s3_metaData.done) {
				selectionHash[s3id].doCommand("cmd_delete_files");
			}
		}
	}
	//-----------------------------------------------------------------------
	else if (action == 'open_file') {
		var aDownload = s3torrent.get_download(s3torrent.treeView.selection.currentIndex);
		aDownload.doCommand("downloadsCmd_open");
	}
	//-----------------------------------------------------------------------
	else if (action == 'show_dir') {
		var aDownload = s3torrent.get_download(s3torrent.treeView.selection.currentIndex);
		aDownload.doCommand("downloadsCmd_show");
	}
	//-----------------------------------------------------------------------
	else if (action == 'select_all') {
		s3torrent.treeView.selection.selectAll();
	}
	//-----------------------------------------------------------------------
	else if (action == 'save_metadata') {
		for (var s3id in selectionHash) {
			selectionHash[s3id].doCommand("cmd_save_metadata");
		}
	}
	//-----------------------------------------------------------------------
}
//------------------------------------------------------------------------------
s3torrent.action_click = function(event) {
	document.getElementById("s3torrent_context").hidePopup();
	if (event.explicitOriginalTarget._lastSelectedRow < 0) {
		s3torrent.treeView.selection.clearSelection();
//		s3torrent.torrent_info_hide();
		return false;
	}
	//-----------------------------------------------------------------------
	var aDownload = s3torrent.get_download(s3torrent.treeView.selection.currentIndex);
	s3torrent.torrent_info_show(aDownload, true);
}
//------------------------------------------------------------------------------
s3torrent.action_select = function(event) {
	if (s3torrent.draw_box.start_draw) {
		return false; 
	}
	s3torrent.action_click(event);
}
//------------------------------------------------------------------------------
s3torrent.action_click_dbl = function(event) {
	if (event.explicitOriginalTarget._lastSelectedRow < 0) {
		s3torrent.treeView.selection.clearSelection();
		return false;
	}
	//-----------------------------------------------------------------------
	if (event.button != 0) {  // left click
		return false;
	}
	//-----------------------------------------------------------------------
	var aDownload = s3torrent.get_download(s3torrent.treeView.selection.currentIndex);
	if (aDownload.s3_metaData.done) {
		s3torrent.action('open_file');
	} else if (aDownload.s3_metaData.paused || ! aDownload.s3_metaData.inProgress) {
		s3torrent.action('resume');
	} else if (! aDownload.s3_metaData.paused) {
		s3torrent.action('pause');
	}
}
//------------------------------------------------------------------------------
s3torrent.torrent_info_show = function(aDownload, is_create) {
	var s3torrent_info = document.getElementById('s3torrent_info');
	if ((s3torrent_info.current_torrent_id != aDownload.s3id) && (! is_create)) {
		return;
	}
	//------------------------------------------------------------------------
	if (! aDownload) {
		s3torrent.torrent_info_hide();
		return;
	}
	var is_update = (s3torrent_info.current_torrent_id == aDownload.s3id);

//	if ((s3torrent_info.current_torrent_id != aDownload.s3id) && (is_create)) {
//		s3torrent_info.selectedIndex = 0;
//	}

	//------------------------------------------------------------------------
	document.getElementById('s3torrent_splitter').hidden = false;
	s3torrent_info.hidden = false;
	s3torrent_info.current_torrent_id = aDownload.s3id;

	//------------------------------------------------------------------------
	// tab Info
	//------------------------------------------------------------------------
	var info_list = aDownload.doCommand('get_torrent_info_list');
	for (var info_key in info_list) {
		var el = document.getElementById('s3torrent_info_' + info_key);
		el.setAttribute('label', info_list[info_key]);
		var is_link = false;

		if (el.hasAttribute('is_link')) {
			is_link = true;
		} else if (el.hasAttribute('is_link_maybe')) {
			if (/^(https?|magnet|ftps?)\:\/\/.+/.test(info_list[info_key])) {
				is_link = true;
			}
		}
		if (is_link) {
			el.className = 's3torrent_text_link';
			el.parentNode.className = 's3torrent_text_link_cursor';
			el.parentNode.addEventListener('dblclick', s3torrent.torrent_info_open_link);
		} else {
			el.className = '';
			el.parentNode.className = '';
			el.parentNode.removeEventListener('dblclick', s3torrent.torrent_info_open_link);
		}
	}
	//------------------------------------------------------------------------
	// tab Files
	//------------------------------------------------------------------------
	var file_list = aDownload.doCommand('get_file_list');
	var file_list_box = document.getElementById('s3torrent_info_file_list');
	//------------------------------------------------------------------------
	if (! is_update) {
		while(file_list_box.getRowCount() > 0) {
			file_list_box.removeItemAt(0);
		}
	}

//	var file_total_size = aDownload.s3_metaData.curSize;
	//------------------------------------------------------------------------
	for (var file of file_list) {
		file.file_size = s3torrent.utils.get_strings_to_KB_MB_GB(file.length);
/*
		//-----------------------------------------------------------------
		if (file.status && (file.status == 'skip')) {
			file.file_cur_size = 0;
			file.file_percent = 0;
		} else {
			file.file_cur_size = (file_total_size >= file.length) ? file.length : file_total_size;
			file.file_percent = (file.length > 0) ? Math.ceil(file.file_cur_size * 100 / file.length) : 100;
			file_total_size -= file.length;
			file_total_size = (file_total_size > 0) ? file_total_size : 0;
		}
		//-----------------------------------------------------------------
		file.file_cur_size = s3torrent.utils.get_strings_to_KB_MB_GB(file.file_cur_size);
*/
		file.file_percent = (file.length > 0) ? Math.ceil(file.downloaded * 100 / file.length) : 100;
		file.file_cur_size = s3torrent.utils.get_strings_to_KB_MB_GB(file.downloaded);
	}
	//------------------------------------------------------------------------
	for (var file of file_list.sort( function(a,b) {
		var file_a = ['/'];
		var file_b = ['/'];
		file_a = file_a.concat(a.path);
		file_b = file_b.concat(b.path);

		var a1 = file_a.pop();
		var b1 = file_b.pop();
		if (file_a.join('') == file_b.join('')) {
			return a1 > b1;
		} else {
			return file_a.join('') > file_b.join('');
		}
	})) {
		//-------------------------------------------------------------------
		if (is_update) {
			document.getElementById(aDownload.s3id + '_file_id_' + file.file_id + '_size').setAttribute('label', (file.file_percent == 100) ? file.file_size : file.file_cur_size + ' / ' + file.file_size);
			document.getElementById(aDownload.s3id + '_file_id_' + file.file_id + '_percent').setAttribute('label', file.file_percent + '%');
			document.getElementById(aDownload.s3id + '_file_id_' + file.file_id + '_row').file_downloaded = file.downloaded;
		}
		//-------------------------------------------------------------------
		else {
			var file_is_process = (file.status == 'skip') ? false : true;
			//-------------------------------------------------------------
			var row = document.createElement('listitem');
			row.setAttribute('type', 'checkbox');
			row.id = aDownload.s3id + '_file_id_' + file.file_id + '_row';

			var cell1 = document.createElement('listcell');
			cell1.setAttribute('type', 'checkbox');
			cell1.setAttribute("checked", file_is_process);
			cell1.setAttribute('label', file.path.join('\\'));
			row.appendChild(cell1);
			cell1.className = 'listcell-iconic';
			cell1.setAttribute('image', "moz-icon://" + file.path[file.path.length-1] + "?size=16");

			var cell2 = document.createElement('listcell');
			cell2.setAttribute('label', (file.file_percent == 100) ? file.file_size : file.file_cur_size + ' / ' + file.file_size);
			cell2.style.textAlign = 'right';
			row.appendChild(cell2);
			cell2.id = aDownload.s3id + '_file_id_' + file.file_id + '_size';

			var cell3 = document.createElement('listcell');
			cell3.setAttribute('label', file.file_percent + '%');
			cell3.style.textAlign = 'right';
			row.appendChild(cell3);
			cell3.id = aDownload.s3id + '_file_id_' + file.file_id + '_percent';

			var cell4 = document.createElement('listcell');
			cell4.setAttribute('label', 	'');
			cell4.style.textAlign = 'right';
			row.appendChild(cell4);

			file_list_box.appendChild(row);
			row.s3id = aDownload.s3id;
			row.file_id = file.file_id;
			row.file_length = file.length;
			row.file_downloaded = file.downloaded;
			row.addEventListener('dblclick', s3torrent.torrent_info_dbl_click);

			if (! file_is_process) {
				cell1.setAttribute('disabled', true);
				cell2.setAttribute('disabled', true);
				cell3.setAttribute('disabled', true);
			}
		}
	}
	//------------------------------------------------------------------------
	s3torrent.torrent_info_select_file_list_check_total();

	//------------------------------------------------------------------------
	// tab Trackers
	//------------------------------------------------------------------------
	var tracker_list = aDownload.doCommand('get_tracker_list');
	var tracker_list_box = document.getElementById('s3torrent_info_tracker_list');
	//------------------------------------------------------------------------
	while(tracker_list_box.getRowCount() > 0) {
		tracker_list_box.removeItemAt(0);
	}
	//------------------------------------------------------------------------
	for (var tracker of tracker_list) {
		var row = document.createElement('listitem');

		var cell = document.createElement('listcell');
		cell.setAttribute('flex', 1);
		cell.setAttribute('label', tracker.url);
		row.appendChild(cell);

		cell = document.createElement('listcell');
		cell.setAttribute('label', tracker.peer_count);
		cell.style.textAlign = 'right';
		row.appendChild(cell);

		cell = document.createElement('listcell');
		if (tracker.is_error) {
			cell.setAttribute('label', 	s3torrent.utils.get_string('error.torrent_not_found'));
		} else {
			cell.setAttribute('label', 	'');
		}
		cell.style.color = '#990000';
		row.appendChild(cell);

		tracker_list_box.appendChild(row);
	}

	//------------------------------------------------------------------------
	// tab Peer
	//------------------------------------------------------------------------
	var httpseed_list = aDownload.doCommand('get_httpseed_list');
	var peer_list = aDownload.doCommand('get_peer_list');
	peer_list = httpseed_list.concat(peer_list);

	var peer_list_box = document.getElementById('s3torrent_info_peer_list');
	//------------------------------------------------------------------------
	while(peer_list_box.getRowCount() > 0) {
		peer_list_box.removeItemAt(0);
	}
	//------------------------------------------------------------------------
	for (var peer of peer_list) {
		var row = document.createElement('listitem');

		var cell = document.createElement('listcell');
		cell.setAttribute('label', peer.peer_ip_port);
		row.appendChild(cell);

		cell = document.createElement('listcell');
		cell.setAttribute('label', peer.peer_client_name);
		row.appendChild(cell);

		cell = document.createElement('listcell');
		cell.setAttribute('label', peer.peer_percent);
		cell.style.textAlign = 'right';
		row.appendChild(cell);

		cell = document.createElement('listcell');
		cell.setAttribute('label', 	s3torrent.utils.get_strings_to_KB_MB_GB(peer.peer_speed, true));
		cell.style.textAlign = 'right';
		row.appendChild(cell);

		cell = document.createElement('listcell');
		cell.setAttribute('label', 	'');
		cell.style.textAlign = 'right';
		row.appendChild(cell);

		peer_list_box.appendChild(row);
	}
}
//------------------------------------------------------------------------------
s3torrent.torrent_info_remove = function(torrent_id) {
	var s3torrent_info = document.getElementById('s3torrent_info');
	if (s3torrent_info.current_torrent_id == torrent_id) {
		s3torrent.torrent_info_hide();
	}
}
//------------------------------------------------------------------------------
s3torrent.torrent_info_hide = function() {
	document.getElementById('s3torrent_splitter').hidden = true;
	document.getElementById('s3torrent_info').hidden = true;
	document.getElementById('s3torrent_info').current_torrent_id = 0;
}
//------------------------------------------------------------------------------
s3torrent.torrent_info_dbl_click = function(event) {
	var s3id = event.target.s3id;
	var file_id = event.target.file_id;
	var aDownload = s3torrent.get_download_by_s3id(s3id);
	if (! aDownload) { return; }
	//-----------------------------------------------------------------------
	var file_list = aDownload.doCommand('get_file_list');
	//-----------------------------------------------------------------------
	if (file_list[file_id].status == 'done') {
		s3torrent.torrent_info_open_file(aDownload, file_id);
	} else {
		var is_checked = event.target.firstChild.getAttribute("checked");
		is_checked = (String(is_checked) == 'true');
		s3torrent.torrent_info_select_file_list(aDownload, file_list, event.target, ! is_checked, false);
	}
}
//------------------------------------------------------------------------------
s3torrent.torrent_info_keyup = function(event) {
	var is_run = false;
	if (event.charCode && ((event.charCode == Components.interfaces.nsIDOMKeyEvent.DOM_VK_SPACE) || (event.charCode == Components.interfaces.nsIDOMKeyEvent.DOM_VK_ENTER))) {
		is_run = true;
	} else if (event.keyCode && ((event.keyCode == 32) || (event.keyCode == 13))) {
		is_run = true;
	}
	if (is_run) {
		s3torrent.torrent_info_dbl_click({ 'target' : event.target.selectedItem });
	}
}
//------------------------------------------------------------------------------
s3torrent.torrent_info_open_file = function(aDownload, file_id) {
	if (aDownload) {
		aDownload.doCommand("downloadsCmd_open", { 'file_id' : file_id });
	}
}
//------------------------------------------------------------------------------
s3torrent.torrent_info_select_file_list = function(aDownload, file_list, row, is_checked, is_all) {
	//-----------------------------------------------------------------------
	var file_id = row.file_id;
	if (file_list[file_id].status == 'done') { return; }

	//-----------------------------------------------------------------------
	row.firstChild.setAttribute("checked", is_checked);
	if (is_checked) {
		row.firstChild.removeAttribute('disabled');
		row.firstChild.nextSibling.removeAttribute('disabled');
		row.firstChild.nextSibling.nextSibling.removeAttribute('disabled');
	} else {
		row.firstChild.setAttribute('disabled', true);
		row.firstChild.nextSibling.setAttribute('disabled', true);
		row.firstChild.nextSibling.nextSibling.setAttribute('disabled', true);
	}
	//-----------------------------------------------------------------------
	aDownload.doCommand('set_file_status', { 'file_id': file_id, 'is_process' : is_checked, 'is_all' : is_all });
	if (! is_all) {
		s3torrent.torrent_info_select_file_list_check_total();
	}
}
//------------------------------------------------------------------------------
s3torrent.torrent_info_select_file_list_all = function(checked) {
	var file_list_box = document.getElementById('s3torrent_info_file_list');
	var s3torrent_info = document.getElementById('s3torrent_info');
	var aDownload = s3torrent.get_download_by_s3id(s3torrent_info.current_torrent_id);
	if (! aDownload) { return; }
	var file_list = aDownload.doCommand('get_file_list');
	
	for (var i=0; i<file_list_box.itemCount; i++) {
		s3torrent.torrent_info_select_file_list(aDownload, file_list, file_list_box.getItemAtIndex( i ), checked, true);
	}
	aDownload.doCommand('set_file_status_all');
	s3torrent.torrent_info_select_file_list_check_total();
}
//------------------------------------------------------------------------------
s3torrent.torrent_info_select_file_list_check_total = function() {
	var file_list_box = document.getElementById('s3torrent_info_file_list');
	var total = 0;
	var downloaded = 0;
	var file_count = 0;

	for (var i=0; i<file_list_box.itemCount; i++) {
		var el = file_list_box.getItemAtIndex( i );
		var is_checked = (String(el.firstChild.getAttribute("checked")) == 'true');
		if (is_checked) {
			total += el.file_length;
			downloaded += el.file_downloaded;
			file_count += 1;
		}
	}
	var percent = (total > 0) ? Math.ceil(downloaded * 100 / total) : 100;
	document.getElementById('s3torrent_info_file_list_total_size').value = file_count + ' / ' + s3torrent.utils.get_strings_to_KB_MB_GB(downloaded) + ' / ' + s3torrent.utils.get_strings_to_KB_MB_GB(total) + ' / ' + percent + '%';
}
//------------------------------------------------------------------------------
s3torrent.torrent_info_copy = function(event) {
	var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);

	var popupAnchor = document.popupNode;
	var popupElem = event.target;
	if (popupAnchor == null) {
		while(popupElem.localName != "menuPopup") {
			popupElem = popupElem.parentNode;
		}
		popupAnchor = popupElem.triggerNode;
	}
		
	while(popupAnchor.nodeName != 'listitem') {
		popupAnchor = popupAnchor.parentNode;
	}
	if (! popupAnchor) { return; }

	var listcell_list = popupAnchor.getElementsByTagName('listcell');
	for (var listcell of listcell_list) {
		if (listcell.id.substring(0, 14) == 's3torrent_info') {
			var value = listcell.getAttribute('label');
			if (value) {
				clipboard.copyString(value);
			}
		}
	}
}
//------------------------------------------------------------------------------
s3torrent.torrent_info_open_link = function(event) {
	var listcell_list = event.target.getElementsByTagName('listcell');
	for (var listcell of listcell_list) {
		if (listcell.id.substring(0, 14) == 's3torrent_info') {
			var value = listcell.getAttribute('label');
			if (value) {
				if (/^magnet\:/.test(value)) {
					s3torrent.utils.add_new_torrent({ 'data' : value, 'is_url' : true, 'referrer_url' : '' });
				} else {
					openURL(value);
				}
			}
		}
	}
}
//------------------------------------------------------------------------------
s3torrent.context_change_tracker_check = function(event) {
	var aDownload = s3torrent.get_download(s3torrent.treeView.selection.currentIndex);
	var s3torrent_trackers = document.getElementById('s3torrent_context_trackers');
	if (aDownload.s3_metaData.paused || ! aDownload.s3_metaData.inProgress) {
		s3torrent_trackers.disabled = false;
	} else {
		s3torrent_trackers.disabled = true;
	}
}
//------------------------------------------------------------------------------
s3torrent.action_all = function(action) {
	s3torrent.treeView.selection.selectAll();
	s3torrent.action(action);
	s3torrent.treeView.selection.clearSelection();
}
//------------------------------------------------------------------------------
s3torrent.action_draw_begin = function(event) {
	if (event.button != 0) {
		return s3torrent.action_draw_end(event);
	}
	if (event.ctrlKey) {
		return s3torrent.action_draw_end(event);
	}
	if (event.target.tagName != 'treechildren') {
		return s3torrent.action_draw_end(event);
	}
	//------------------------------------------------------------------------
	var box = document.getElementById("s3torrent_draw_box");
	var hbox = document.getElementById("s3torrent_draw_box_hbox");

	//------------------------------------------------------------------------
	s3torrent.draw_box.start_x = event.pageX;
	s3torrent.draw_box.start_y = event.pageY;

	//------------------------------------------------------------------------
	box.style.left = event.pageX + "px";
	box.style.top = event.pageY + "px";
	hbox.height = 0;
	hbox.width = 0;
	s3torrent.draw_box.start_draw = true;
}
//------------------------------------------------------------------------------
s3torrent.action_draw_move = function(event) {
	//------------------------------------------------------------------------
	if (! s3torrent.draw_box.start_draw) {
		return;
	}
	//------------------------------------------------------------------------
	var box = document.getElementById("s3torrent_draw_box");
	var hbox = document.getElementById("s3torrent_draw_box_hbox");
	//------------------------------------------------------------------------
	var mouseX = event.pageX;
	var mouseY = event.pageY;
	//------------------------------------------------------------------------
	var left = mouseX < s3torrent.draw_box.start_x ? mouseX : s3torrent.draw_box.start_x;
	var top = mouseY < s3torrent.draw_box.start_y ? mouseY : s3torrent.draw_box.start_y;
	//------------------------------------------------------------------------
	var width = Math.abs(mouseX - s3torrent.draw_box.start_x);
	var height = Math.abs(mouseY - s3torrent.draw_box.start_y);

	//------------------------------------------------------------------------
	box.hidden = false;
	box.style.left = left + "px";
	box.style.top = top + "px";
	//------------------------------------------------------------------------
	hbox.width = width;
	hbox.height = height;

	//------------------------------------------------------------------------
	s3torrent.treeView.selection.clearSelection();
	for (var sel_y = top; sel_y < (top+height); sel_y++) {
		var row = s3torrent.treeView.tree.getRowAt(event.clientX, sel_y);
		if (row > -1) {
			s3torrent.treeView.selection.rangedSelect(row, row, true);
		}
	}
}
//------------------------------------------------------------------------------
s3torrent.action_draw_end = function(event) {
	document.getElementById("s3torrent_draw_box").hidden = true;
	if (s3torrent.draw_box.start_draw) {
		if (s3torrent.treeView.selection.count > 1) {
			document.getElementById("s3torrent_context").openPopupAtScreen(event.screenX, event.screenY, true);
		}
	}
	s3torrent.draw_box.start_draw = false;
}
//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
s3torrent.treeView = {};
s3torrent.treeView.rowCount = 0;
s3torrent.treeView.selection = null;
s3torrent.treeView.download_list = [];
s3torrent.treeView.tree = null;
s3torrent.treeView.sortName = 'DateTime';
s3torrent.treeView.sortDirection = 'descending';
s3torrent.treeView.filterText = '';

//------------------------------------------------------------------------------
s3torrent.treeView.insert_data = function(aDownload)  {
	s3torrent.treeView.download_list.push(aDownload);
	if (aDownload.isView) {
		s3torrent.treeView.tree.rowCountChanged(0, 1);
		s3torrent.treeView.rowCount++;
		s3torrent.treeView.sortElements();
	}
};
//------------------------------------------------------------------------------
s3torrent.treeView.change_data = function(row_tree)  {
	if (s3torrent.treeView.tree != null) {
		s3torrent.treeView.tree.invalidateRow(row_tree);
		s3torrent.treeView.sortElements();
	}
};
//------------------------------------------------------------------------------
s3torrent.treeView.getCellText = function(row, aColumn) {
	var d = s3torrent.get_download_metaData(row);
	if (! d) { return; }

	if (aColumn.id == "TorrentName") {
		return d.displayName;
	}
	else if (aColumn.id == "SaveDir") {
		return d.saveDir;
	}
	else if (aColumn.id == "DateTime") {
		var date = new Date(d.endTime);
		return date.toLocaleFormat(s3torrent.dateTime_format);
	}
	else if (aColumn.id == "FileSize") {
		if (d.done) {
			return d.fileSizeString;
		} else {
			if (d.fileSize < 0) {
				d.fileSizeString = d.curSizeString;
			}
			return d.curSizeString + ' / ' + d.fileSizeString;
		}
	}
	else if (aColumn.id == "ProgressPercent") {
		return d.percentComplete + '%';
	}
	else if (aColumn.id == "Speed") {
		return d.speedText;
	}
	else if (aColumn.id == "Progress") {
		if (d.done) {
			return d.percentComplete + '%';
		} else {
			return d.percentComplete;
		}
	}
	else if (aColumn.id == "TimeRemaining") {
		return d.timeRemainingText;
	}
	else if (aColumn.id == "Peer") {
		return d.peerCountWork + '/' + d.peerCountAll;
	}
}
//------------------------------------------------------------------------------
s3torrent.treeView.getCellValue = function(row, aColumn) {
	var d = s3torrent.get_download_metaData(row);
	if (! d) { return; };

	if (aColumn.id == "Progress") {
		return d.percentComplete;
	}
}
//------------------------------------------------------------------------------
s3torrent.treeView.getProgressMode = function(row, aColumn) {
	var d = s3torrent.get_download_metaData(row);
	if (! d) { return; };

	var nsITreeView = Components.interfaces.nsITreeView;
	if (aColumn.id == "Progress") {
		if (! d.done) {
			return (d.fileSize >= 0) ? nsITreeView.PROGRESS_NORMAL : nsITreeView.PROGRESS_UNDETERMINED;
		}
	}
	return nsITreeView.PROGRESS_NONE;
 }
//------------------------------------------------------------------------------
s3torrent.treeView.getRowProperties = function(row) {
	var d = s3torrent.get_download_metaData(row);
	if (! d) { return; };

	if (d.error) {
		return 'error';
	}
	else if (d.inProgress && ! d.paused) {
		return 'progress';
	}
	else if (! d.done && ! d.inProgress) {
		return 'cancel';
	}
	else if (d.paused) {
		return 'pause';
	}
}
//------------------------------------------------------------------------------
s3torrent.treeView.getCellProperties = function(row, aColumn) {
	return s3torrent.treeView.getRowProperties(row);
}
//------------------------------------------------------------------------------
s3torrent.treeView.setTree = function(aTree) {
	s3torrent.treeView.tree = aTree;
}
//------------------------------------------------------------------------------
s3torrent.treeView.cycleHeader = function(aColumn) {
	var elem = document.getElementById(aColumn.id);
	s3torrent.treeView.sortName = elem.id;
	s3torrent.treeView.sortDirection = elem.getAttribute('sortDirection');
	s3torrent.treeView.sortDirection = (s3torrent.treeView.sortDirection == 'ascending') ? 'descending' : 'ascending';
	s3torrent.treeView.sortElements();
}
//------------------------------------------------------------------------------
s3torrent.treeView.sortElements = function() {
	s3torrent.sort_handler_count++;

	if (s3torrent.sort_handler_count > 100) {
		if (s3torrent.sort_handler != null) {
			clearTimeout(s3torrent.sort_handler);
		}
		if (s3torrent.sort_handler_count > 1000) {
			s3torrent.treeView.sortElements_count_clear();
		} else {
			s3torrent.sort_handler = setTimeout(function(){ s3torrent.treeView.sortElements_count_clear(); } , 50);
		}
	} else {
		s3torrent.treeView.sortElements_run();
	}
}
//------------------------------------------------------------------------------
s3torrent.treeView.sortElements_count_clear = function() {
	s3torrent.sort_handler_count = 0;
	s3torrent.sort_handler = null;
	s3torrent.treeView.sortElements_run();
}
//------------------------------------------------------------------------------
s3torrent.treeView.sortElements_run = function() {
	//------------------------------------------------------------------------
	var sortName = s3torrent.treeView.sortName;
	var sortDirection = s3torrent.treeView.sortDirection;
	var selectionHash = s3torrent.treeView.selectionGet();
	//------------------------------------------------------------------------
	var cols = s3torrent.tree.getElementsByTagName("treecol");
	for (var i = 0; i < cols.length; i++) {
		cols[i].removeAttribute("sortActive");
		cols[i].removeAttribute("sortDirection");
	}

	//------------------------------------------------------------------------
	var elem = document.getElementById(sortName);
	elem.setAttribute('sortActive', true);
	elem.setAttribute('sortDirection', s3torrent.treeView.sortDirection);

	//------------------------------------------------------------------------
	var func_sort = function(a1, b1) {
		var field = 'endTime'; 
		var field_type = 'number';

		if (sortName == "TorrentName") { field = 'displayName'; field_type = 'string'; }
		else if (sortName == "SaveDir") { field = 'saveDir'; field_type = 'string'; }
		else if (sortName == "DateTime") { field = 'endTime'; field_type = 'number'; }
		else if (sortName == "FileSize") { field = 'fileSize'; field_type = 'number'; }
		else if (sortName == "ProgressPercent") { field = 'percentComplete'; field_type = 'number'; }
		else if (sortName == "Speed") { field = 'speed'; field_type = 'number'; }
		else if (sortName == "Progress") { field = 'percentComplete'; field_type = 'number'; }
		else if (sortName == "TimeRemaining") { field = 'timeRemaining'; field_type = 'number'; }
		else if (sortName == "Peer") { field = 'peerCountAll'; field_type = 'number'; }

		var a = a1.s3_metaData[field];
		var b = b1.s3_metaData[field];

		if (field_type == 'string') {
			a = a.toLowerCase();
			b = b.toLowerCase();
			if (/^[^0-9a-z]/.test(a)) { a = 'z' + a; }
			if (/^[^0-9a-z]/.test(b)) { b = 'z' + b; }
		}
		if (a > b) { return (sortDirection == 'ascending') ? 1 : -1; }
		else if (a < b) { return (sortDirection == 'ascending') ? -1 : 1; }
		else { return 0; }
	};
	//------------------------------------------------------------------------
	s3torrent.treeView.download_list = s3torrent.treeView.download_list.sort(func_sort);
	s3torrent.treeView.tree.invalidate();
	s3torrent.treeView.selectionRestore(selectionHash);
	s3torrent.count_summary();
}
//------------------------------------------------------------------------------
s3torrent.treeView.search = function(text) {
	s3torrent.treeView.filterText = text;
	var row = -1;
	for (var d of s3torrent.treeView.download_list) {
		if (d.isView) { row++; }

		if (s3torrent.check_download_filter(d, s3torrent.treeView.filterText)) {
			if (d.isView == false) {
				d.isView = true;
				s3torrent.treeView.tree.rowCountChanged(row, 1);
				s3torrent.treeView.rowCount++;
				row++;
			}
		} else if (d.isView) {
			s3torrent.treeView.tree.rowCountChanged(row, -1);
			s3torrent.treeView.rowCount--;
			row--;
			d.isView = false;
		}
	}
	s3torrent.treeView.sortElements();
}
//------------------------------------------------------------------------------
s3torrent.treeView.isContainer = function(aRow) { return false; }
s3torrent.treeView.isContainerOpen = function(aRow) { return false; }
s3torrent.treeView.isContainerEmpty = function(aRow) { return false; }
s3torrent.treeView.isSeparator = function(aRow) { return false; }
s3torrent.treeView.isSorted = function() { return false; }
s3torrent.treeView.canDrop = function(aIdx, aOrientation) { return false; }
s3torrent.treeView.drop = function(aIdx, aOrientation) { }
s3torrent.treeView.getParentIndex = function(aRow) { return -1; }
s3torrent.treeView.hasNextSibling = function(aRow, aAfterIdx) { return false; }
s3torrent.treeView.getLevel = function(aRow) { return 0; }

//------------------------------------------------------------------------------
s3torrent.treeView.selectionGet = function() {
	var result = {};
	if (s3torrent.treeView.selection) {
		var selectionCount = s3torrent.treeView.selection.count;
		if (selectionCount) {
			let start = {};
			let end = {};
			let numRanges = s3torrent.treeView.selection.getRangeCount();
			for (let rg = 0; rg < numRanges; rg++) {
				s3torrent.treeView.selection.getRangeAt(rg, start, end);
				for (var row = start.value; row <= end.value; row++) {
					var aDownload = s3torrent.get_download(row);
					if (aDownload) {
						result[aDownload.s3id] = aDownload;
					}
				}
			}
		}
	}
	return result;
}
//------------------------------------------------------------------------------
s3torrent.treeView.selectionRestore = function(selectionHash) {
	s3torrent.treeView.selection.clearSelection();
	for (var s3id in selectionHash) {
		var res = s3torrent.get_row_download(s3id);
		if (res.row_tree >= 0) {
			s3torrent.treeView.selection.rangedSelect(res.row_tree, res.row_tree, true);
		}
	}
}
//------------------------------------------------------------------------------
s3torrent.settings = function() {
	var winD = window.openDialog('chrome://s3torrent/content/settings.xul', 's3torrent_prefs', 'chrome,modal,centerscreen,toolbar');
	winD.focus();
}
//------------------------------------------------------------------------------
