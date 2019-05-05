
var magdown = {};
Components.utils.import("resource://magdown/utils.js", magdown);

magdown.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.magdown.");
magdown.prefs_global = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
magdown.draw_box = { start_x:0, start_y:0, start_draw: false };
magdown.sort_handler = null;
magdown.sort_handler_count = 0;
magdown.new_items_list = [];
magdown.new_items_list_handler = null;
magdown.remove_items_list = [];
magdown.remove_items_list_handler = null;

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
magdown.init = function() {
	var S3TorrentTornado_class = Components.classes["@magdown.com/tornado;1"];
	var S3TorrentTornado = S3TorrentTornado_class.getService().wrappedJSObject;
	magdown.torrent = S3TorrentTornado.torrent;

	setTimeout(function(){ magdown.init_run(); } , 100);
}
//------------------------------------------------------------------------------
magdown.close = function() {
	magdown.unregister();
}
//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
magdown.observe = function(subject, topic, magdown_id) {
	if (topic == "magdown-change") {
		var torrent = magdown.torrent.doCommand(magdown_id, 'get_torrent_data');
		if (torrent) {
			magdown.event_changed(torrent.metadata);
		}
	}
	else if (topic == "magdown-remove") {
		magdown.remove_items_list.push(magdown_id);
		if (magdown.remove_items_list_handler != null) {
			clearTimeout(magdown.remove_items_list_handler);
		}
		magdown.remove_items_list_handler = setTimeout(function(){ magdown.event_removed(); } , 100);
	}
}
//------------------------------------------------------------------------------
magdown.register = function() { 
	var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
	observerService.addObserver(magdown, "magdown-change", false);
	observerService.addObserver(magdown, "magdown-remove", false);
}
//------------------------------------------------------------------------------
magdown.unregister = function() {
	try {
		var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
		observerService.removeObserver(magdown, "magdown-change");
		observerService.removeObserver(magdown, "magdown-remove");
	} catch(e) {
	}
}
//------------------------------------------------------------------------------
magdown.init_run = function() {
	magdown.tree = document.getElementById('magdown_tree');
	magdown.tree.view = magdown.treeView;
	//------------------------------------------------------------------------
	var pref_branch = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.magdown.");

	//------------------------------------------------------------------------
	document.getElementById('magdown_button_add_torrent').hidden = ! pref_branch.getBoolPref('DL.showAddNewTorrent');
	document.getElementById('magdown_button_pause_all').hidden = ! pref_branch.getBoolPref('DL.showPauseButton');
	document.getElementById('magdown_button_resume_all').hidden = ! pref_branch.getBoolPref('DL.showResumeButton');
	document.getElementById('magdown_button_cancel_all').hidden = ! pref_branch.getBoolPref('DL.showCancelButton');
	document.getElementById('magdown_button_remove_all').hidden = ! pref_branch.getBoolPref('DL.showRemoveButton');

	//------------------------------------------------------------------------
	magdown.dateTime_format = pref_branch.getCharPref('DL.dateTimeFormat');

	//------------------------------------------------------------------------
	magdown.count_summary();
	magdown.register();


	var torrent_id_list = magdown.torrent.doCommand('all', 'get_torrent_id_list');
	//------------------------------------------------------------------------
	for(var magdown_id in torrent_id_list) {
		var torrent = magdown.torrent.doCommand(magdown_id, 'get_torrent_data');
		magdown.new_items_list.push(torrent.metadata);
		if (magdown.new_items_list_handler != null) {
			clearTimeout(magdown.new_items_list_handler);
		}
		magdown.new_items_list_handler = setTimeout(function(){ magdown.event_added(); } , 100);
	}

	//------------------------------------------------------------------------
	var treecols = magdown.tree.getElementsByTagName("treecol");
	for (var treecol of treecols) {
		if (treecol.getAttribute("sortActive")) {
			magdown.treeView.sortName = treecol.id;
			magdown.treeView.sortDirection = treecol.getAttribute("sortDirection");
		}
	}
}
//------------------------------------------------------------------------------
magdown.event_added = function() {
	var count_new = 0;
	var new_items = [];
	while (magdown.new_items_list.length > 0) {
		var metadata = magdown.new_items_list.shift();
		var aDownload = magdown.create_aDownload(metadata);
		var res = magdown.get_row_download(aDownload.s3id);
		if (res.row < 0) {
			new_items.push(aDownload);
			if (aDownload.isView) {
				count_new++;
			}
		}
	}
	magdown.treeView.download_list = magdown.treeView.download_list.concat(new_items);
	if (count_new > 0) {
		magdown.treeView.tree.rowCountChanged(0, count_new);
		magdown.treeView.rowCount += count_new;
		magdown.treeView.sortElements();

		if (! document.getElementById('magdown_info').current_torrent_id) {
			magdown.treeView.selection.currentIndex = 0;
			magdown.torrent_info_show(magdown.get_download(0), true);
		}
	}
}
//------------------------------------------------------------------------------
magdown.event_removed = function() {
	var count_remove = 0;
	while (magdown.remove_items_list.length > 0) {
		var s3id = magdown.remove_items_list.shift();
		magdown.torrent_info_remove(s3id);
		var res = magdown.get_row_download(s3id);
		if (res.row >= 0) {
			if (res.row_tree >= 0) {
				count_remove++;
			}
			magdown.treeView.download_list.splice(res.row, 1);
		}
	}
	if (count_remove > 0) {
		magdown.treeView.tree.rowCountChanged(magdown.treeView.rowCount, count_remove * (-1));
		magdown.treeView.rowCount -= count_remove;
		magdown.treeView.sortElements();
	}
}
//------------------------------------------------------------------------------
magdown.event_changed = function(metadata) {
	var aDownload = magdown.create_aDownload(metadata);
	magdown.torrent_info_show(aDownload);
	var res = magdown.get_row_download(aDownload.s3id);
	if (res.row >= 0) {
		magdown.treeView.download_list.splice(res.row, 1, aDownload);
		magdown.treeView.change_data(res.row_tree);
	} else {
		magdown.treeView.insert_data(aDownload);
	}
}
//------------------------------------------------------------------------------
magdown.create_aDownload = function(metadata) {
	var magdown_id = metadata.magdown_id;
	var total_size = magdown.torrent.doCommand(magdown_id, 'get_total_size');
	var downloaded_size = magdown.torrent.doCommand(magdown_id, 'get_downloaded_size');

	// --------------------------
	var aDownload = {
		s3id : magdown_id,
		s3_metaData : {
			displayName : metadata.info.name,
			downloadUri : metadata.torrent_url || magdown.torrent.doCommand(magdown_id, 'get_magnet_link'),
			referrerUri : metadata.referrer_url,
			magnetUri : magdown.torrent.doCommand(magdown_id, 'get_magnet_link'),
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
			return magdown.torrent.doCommand(magdown_id, cmd, params);
		}
	}

	// --------------------------
	aDownload.s3_metaData.speed = (aDownload.s3_metaData.paused || ! aDownload.s3_metaData.inProgress) ? 0 : aDownload.s3_metaData.speed;
	if (aDownload.s3_metaData.speed > 0) {
		aDownload.s3_metaData.timeRemaining = (1 / aDownload.s3_metaData.speed) * (aDownload.s3_metaData.fileSize - aDownload.s3_metaData.curSize);
		aDownload.s3_metaData.timeRemainingText = magdown.utils.format_seconds(aDownload.s3_metaData.timeRemaining);
	}
	// --------------------------
	aDownload.isView = magdown.check_download_filter(aDownload, magdown.treeView.filterText);
	aDownload.s3_metaData.curSizeString = magdown.utils.get_strings_to_KB_MB_GB(aDownload.s3_metaData.curSize);
	aDownload.s3_metaData.fileSizeString = magdown.utils.get_strings_to_KB_MB_GB(aDownload.s3_metaData.fileSize);

	//-----------------------------------------------------------------------
	aDownload.s3_metaData.speedText = '';
	aDownload.s3_metaData.speedText = magdown.utils.get_strings_to_KB_MB_GB(aDownload.s3_metaData.speed, true);

	//-----------------------------------------------------------------------
	[aDownload.s3_metaData.peerCountAll, aDownload.s3_metaData.peerCountWork] = magdown.torrent.doCommand(magdown_id, 'get_peer_count');


	return aDownload;
}
//------------------------------------------------------------------------------
magdown.get_row_download = function(s3id) {
	var row_tree = -1;
	var result = { 'row': -1, 'row_tree': -1 };
	//-----------------------------------------------------------------------
	for (var row in magdown.treeView.download_list) {
		var d = magdown.treeView.download_list[row];
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
magdown.get_download_metaData = function(row) {
	var search_row = -1;
	for (var d of magdown.treeView.download_list) {
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
magdown.get_download = function(row) {
	var search_row = -1;
	for (var d of magdown.treeView.download_list) {
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
magdown.get_download_by_s3id = function(s3id) {
	for (var d of magdown.treeView.download_list) {
		if (d.s3id == s3id) {
			return d;
		}
	}
	return false;
}
//------------------------------------------------------------------------------
magdown.check_download_filter = function(aDownload, filter_text) {
	var result = false;

	if (aDownload.s3_metaData.displayName.toLowerCase().indexOf(filter_text) >= 0) { result = true; }

	return result;
}
//------------------------------------------------------------------------------
magdown.count_summary = function() {
	var progress_count = 0;
	var downloads_all = 0;
	var percentComplete = 0;
	var timeRemaining = 0;
	var speedMax = 0;
	var speedCount = 0;
	var cancel_count = 0;
	var pause_count = 0;

	//-----------------------------------------------------------------------
	for (var aDownload of magdown.treeView.download_list) {
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
	document.getElementById('magdown_summary_text').value = progress_count + '/' + done_count;
	document.getElementById('magdown_summary_progress').value = Math.ceil(percentComplete);

	//-----------------------------------------------------------------------
	if ((percentComplete == 0) && ((progress_count-cancel_count) <= 0)) {
		percentComplete = 100;
	}
	var timeRemainingText = (timeRemaining > 0) ? ' :: ' + magdown.utils.format_seconds(timeRemaining) : '';
	//-----------------------------------------------------------------------
	var speedText = ' :: ' + magdown.utils.get_strings_to_KB_MB_GB(speedMax, true);
	document.getElementById('magdown_summary_progress_text').value = percentComplete + '%' + timeRemainingText + speedText;

	//-----------------------------------------------------------------------
	var magdown_button_pause_all = document.getElementById('magdown_button_pause_all');
	magdown_button_pause_all.disabled = (progress_count - (pause_count+cancel_count)) > 0 ? false : true;
	magdown_button_pause_all.label = magdown_button_pause_all.getAttribute("label_pre") + ((progress_count - (pause_count+cancel_count)) > 0 ? ' (' + (progress_count - (pause_count+cancel_count)) + ')' : '');

	var magdown_button_resume_all = document.getElementById('magdown_button_resume_all');
	magdown_button_resume_all.disabled = ((pause_count + cancel_count) > 0) ? false : true;
	magdown_button_resume_all.label = magdown_button_resume_all.getAttribute("label_pre") + (((pause_count + cancel_count) > 0) ? ' (' + (pause_count + cancel_count) + ')' : '');

	var magdown_button_cancel_all = document.getElementById('magdown_button_cancel_all');
	magdown_button_cancel_all.disabled = ((progress_count - cancel_count) > 0) ? false : true;
	magdown_button_cancel_all.label = magdown_button_cancel_all.getAttribute("label_pre") + (((progress_count-cancel_count)>0) ? ' (' + (progress_count-cancel_count) + ')' : '');

	var magdown_button_remove_all = document.getElementById('magdown_button_remove_all');
	magdown_button_remove_all.disabled = (done_count > 0) ? false : true;
	magdown_button_remove_all.label = magdown_button_remove_all.getAttribute("label_pre") + ((done_count>0) ? ' (' + done_count + ')' : '');
}
//------------------------------------------------------------------------------
magdown.check_menupopup = function(event) {
	if (event.explicitOriginalTarget._lastSelectedRow < 0) {
		magdown.treeView.selection.clearSelection();
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
	var selectionHash = magdown.treeView.selectionGet();
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
	for (var aDownload of magdown.treeView.download_list) {
		if (aDownload.isView && (aDownload.s3_metaData.done || (! aDownload.s3_metaData.inProgress))) {
			downloads_count++;
		}
	}

	//-----------------------------------------------------------------------
	if (select_count == 0) {
		return false;
	}
	//-----------------------------------------------------------------------
	var magdown_pause = document.getElementById('magdown_pause');
	magdown_pause.hidden = (progress_count > 0) ? false : true;
	magdown_pause.disabled = ((pause_count+cancel_count) == progress_count) ? true : false;
	magdown_pause.label = magdown_pause.getAttribute("label_pre") + (((progress_count - (pause_count+cancel_count))>1) || (select_count > 1) ? ' (' + (progress_count - (pause_count+cancel_count)) + ')' : '');
	//-----------------------------------------------------------------------
	var magdown_resume = document.getElementById('magdown_resume');
	magdown_resume.hidden = (progress_count > 0) ? false : true;
	magdown_resume.disabled = ((pause_count + cancel_count) > 0) ? false : true;
	magdown_resume.label = magdown_resume.getAttribute("label_pre") + (((pause_count + cancel_count) > 1) || (select_count > 1) ? ' (' + (pause_count + cancel_count) + ')' : '');
	//-----------------------------------------------------------------------
	var magdown_cancel = document.getElementById('magdown_cancel');
	magdown_cancel.hidden = (progress_count > 0) ? false : true;
	magdown_cancel.disabled = (cancel_count > 0) ? true : false;
	magdown_cancel.label = magdown_cancel.getAttribute("label_pre") + (((progress_count-cancel_count)>1) || (select_count > 1) ? ' (' + (progress_count-cancel_count) + ')' : '');
	//-----------------------------------------------------------------------
	var magdown_retry = document.getElementById('magdown_retry');
	magdown_retry.hidden = ((done_count + pause_count + cancel_count) > 0) ? false : true;
	magdown_retry.disabled = ((done_count + pause_count + cancel_count) > 0) ? false : true;
	magdown_retry.label = magdown_retry.getAttribute("label_pre") + (((done_count + pause_count + cancel_count) > 1) || (select_count > 1) ? ' (' + (done_count + pause_count + cancel_count) + ')' : '');
	//-----------------------------------------------------------------------
	var magdown_trackers = document.getElementById('magdown_trackers');
	magdown_trackers.hidden = (select_count == 1) ? false : true;
	magdown_trackers.disabled = ((done_count + pause_count + cancel_count) > 0) ? false : true;
	//-----------------------------------------------------------------------
	var magdown_copy_link = document.getElementById('magdown_copy_link');
	magdown_copy_link.label = magdown_copy_link.getAttribute("label_pre") + (select_count>1 ? ' (' + select_count + ')' : '');
	//-----------------------------------------------------------------------
	var magdown_download_page = document.getElementById('magdown_download_page');
	magdown_download_page.disabled = (referrerUri_count > 0) ? false : true;
	magdown_download_page.label = magdown_download_page.getAttribute("label_pre") + (select_count>1 ? ' (' + referrerUri_count + ')' : '');
	//-----------------------------------------------------------------------
	var magdown_remove_history = document.getElementById('magdown_remove_history');
	magdown_remove_history.hidden = ((done_count+cancel_count) > 0) ? false : true;
	magdown_remove_history.label = magdown_remove_history.getAttribute("label_pre") + (((done_count+cancel_count)>1) || (select_count > 1) ? ' (' + (done_count+cancel_count) + ')' : '');
	//-----------------------------------------------------------------------
	var magdown_delete_file = document.getElementById('magdown_delete_file');
	magdown_delete_file.hidden = (done_count > 0) ? false : true;
	magdown_delete_file.label = magdown_delete_file.getAttribute("label_pre") + ((done_count>1) || (select_count > 1) ? ' (' + fileSizeCount + ')' : '');
	magdown_delete_file.disabled = (fileSizeMax >= 0) ? false : true;
	//-----------------------------------------------------------------------
	var magdown_open_file = document.getElementById('magdown_open_file');
	magdown_open_file.hidden = ((select_count == 1) && done_count > 0) ? false : true;
	magdown_open_file.disabled = (fileSizeMax >= 0) ? false : true;
	//-----------------------------------------------------------------------
	var magdown_show_dir = document.getElementById('magdown_show_dir');
//	magdown_show_dir.hidden = ((select_count == 1) && done_count > 0) ? false : true;
//	magdown_show_dir.disabled = (fileSizeMax >= 0) ? false : true;
	magdown_show_dir.hidden = (select_count == 1)  ? false : true;
	magdown_show_dir.disabled = false;

	//-----------------------------------------------------------------------
	var magdown_save_metadata = document.getElementById('magdown_save_metadata');
	magdown_save_metadata.label = magdown_save_metadata.getAttribute("label_pre") + (select_count>1 ? ' (' + select_count + ')' : '');

	//-----------------------------------------------------------------------
	document.getElementById('magdown_menuseparator_1').hidden = (magdown_pause.hidden && magdown_resume.hidden && magdown_cancel.hidden && magdown_retry.hidden && magdown_trackers.hidden) ? true : false;
	document.getElementById('magdown_menuseparator_2').hidden = (magdown_remove_history.hidden && magdown_delete_file.hidden) ? true : false;
	document.getElementById('magdown_menuseparator_3').hidden = (magdown_open_file.hidden && magdown_show_dir.hidden) ? true : false;
}
//------------------------------------------------------------------------------
magdown.action = function(action) {
	var selectionHash = magdown.treeView.selectionGet();
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
		var magdown_cancel = document.getElementById('magdown_cancel');
		var message = magdown_cancel.getAttribute("label_pre") + ' (' + count + ')';
		//----------------------------------------------------------------
		var magdown_confirmMsg = magdown.utils.get_string("areYouSureConfirm");
		if (! magdown.utils.confirm(message + "\n" + magdown_confirmMsg)) {
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
		var magdown_confirmMsg = magdown.utils.get_string("areYouSureConfirm");
		if (! magdown.utils.confirm(magdown_confirmMsg)) {
			return;
		}
		//----------------------------------------------------------------
		var selection_count = magdown.treeView.selection.count;
		for (var s3id in selectionHash) {
			var aDownload = selectionHash[s3id];
			if (aDownload.s3_metaData.done || aDownload.s3_metaData.paused) {
				var file_path = aDownload.s3_metaData.saveDir;
				var run_process = true;
				var is_promt = (selection_count > 1) ? false : true;
				var localDir = magdown.utils.get_localFile_dir(file_path);
				if (! localDir) {
					is_promt = true;
				}
				//----------------------------------------------------
				if (is_promt) {
					var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
					fp.init(window, '', Components.interfaces.nsIFilePicker.modeGetFolder);

					//-------------------------------------------------
					if (! localDir) {
						localDir = magdown.utils.get_default_save_dir();
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
		var aDownload = magdown.get_download(magdown.treeView.selection.currentIndex);
		var tracker_list = aDownload.doCommand('get_tracker_list');
		var winD = window.openDialog('chrome://magdown/content/change_tracker.xul', 'magdown_change_tracker', 'chrome,modal,centerscreen,toolbar', tracker_list);
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
		var magdown_remove_history = document.getElementById('magdown_remove_history');
		var message = magdown_remove_history.getAttribute("label_pre") + ' (' + count + ')';
		//----------------------------------------------------------------
		var magdown_confirmMsg = magdown.utils.get_string("areYouSureConfirm");
		if (! magdown.utils.confirm(message + "\n" + magdown_confirmMsg)) {
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
		var magdown_delete_file = document.getElementById('magdown_delete_file');
		var message = magdown_delete_file.getAttribute("label_pre") + ' (' + count + ')';
		//----------------------------------------------------------------
		var magdown_confirmMsg = magdown.utils.get_string("areYouSureConfirm");
		if (! magdown.utils.confirm(message + "\n" + magdown_confirmMsg)) {
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
		var aDownload = magdown.get_download(magdown.treeView.selection.currentIndex);
		aDownload.doCommand("downloadsCmd_open");
	}
	//-----------------------------------------------------------------------
	else if (action == 'show_dir') {
		var aDownload = magdown.get_download(magdown.treeView.selection.currentIndex);
		aDownload.doCommand("downloadsCmd_show");
	}
	//-----------------------------------------------------------------------
	else if (action == 'select_all') {
		magdown.treeView.selection.selectAll();
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
magdown.action_click = function(event) {
	document.getElementById("magdown_context").hidePopup();
	if (event.explicitOriginalTarget._lastSelectedRow < 0) {
		magdown.treeView.selection.clearSelection();
//		magdown.torrent_info_hide();
		return false;
	}
	//-----------------------------------------------------------------------
	var aDownload = magdown.get_download(magdown.treeView.selection.currentIndex);
	magdown.torrent_info_show(aDownload, true);
}
//------------------------------------------------------------------------------
magdown.action_select = function(event) {
	if (magdown.draw_box.start_draw) {
		return false; 
	}
	magdown.action_click(event);
}
//------------------------------------------------------------------------------
magdown.action_click_dbl = function(event) {
	if (event.explicitOriginalTarget._lastSelectedRow < 0) {
		magdown.treeView.selection.clearSelection();
		return false;
	}
	//-----------------------------------------------------------------------
	if (event.button != 0) {  // left click
		return false;
	}
	//-----------------------------------------------------------------------
	var aDownload = magdown.get_download(magdown.treeView.selection.currentIndex);
	if (aDownload.s3_metaData.done) {
		magdown.action('open_file');
	} else if (aDownload.s3_metaData.paused || ! aDownload.s3_metaData.inProgress) {
		magdown.action('resume');
	} else if (! aDownload.s3_metaData.paused) {
		magdown.action('pause');
	}
}
//------------------------------------------------------------------------------
magdown.torrent_info_show = function(aDownload, is_create) {
	var magdown_info = document.getElementById('magdown_info');
	if ((magdown_info.current_torrent_id != aDownload.s3id) && (! is_create)) {
		return;
	}
	//------------------------------------------------------------------------
	if (! aDownload) {
		magdown.torrent_info_hide();
		return;
	}
	var is_update = (magdown_info.current_torrent_id == aDownload.s3id);

//	if ((magdown_info.current_torrent_id != aDownload.s3id) && (is_create)) {
//		magdown_info.selectedIndex = 0;
//	}

	//------------------------------------------------------------------------
	document.getElementById('magdown_splitter').hidden = false;
	magdown_info.hidden = false;
	magdown_info.current_torrent_id = aDownload.s3id;

	//------------------------------------------------------------------------
	// tab Info
	//------------------------------------------------------------------------
	var info_list = aDownload.doCommand('get_torrent_info_list');
	for (var info_key in info_list) {
		var el = document.getElementById('magdown_info_' + info_key);
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
			el.className = 'magdown_text_link';
			el.parentNode.className = 'magdown_text_link_cursor';
			el.parentNode.addEventListener('dblclick', magdown.torrent_info_open_link);
		} else {
			el.className = '';
			el.parentNode.className = '';
			el.parentNode.removeEventListener('dblclick', magdown.torrent_info_open_link);
		}
	}
	//------------------------------------------------------------------------
	// tab Files
	//------------------------------------------------------------------------
	var file_list = aDownload.doCommand('get_file_list');
	var file_list_box = document.getElementById('magdown_info_file_list');
	//------------------------------------------------------------------------
	if (! is_update) {
		while(file_list_box.getRowCount() > 0) {
			file_list_box.removeItemAt(0);
		}
	}

//	var file_total_size = aDownload.s3_metaData.curSize;
	//------------------------------------------------------------------------
	for (var file of file_list) {
		file.file_size = magdown.utils.get_strings_to_KB_MB_GB(file.length);
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
		file.file_cur_size = magdown.utils.get_strings_to_KB_MB_GB(file.file_cur_size);
*/
		file.file_percent = (file.length > 0) ? Math.ceil(file.downloaded * 100 / file.length) : 100;
		file.file_cur_size = magdown.utils.get_strings_to_KB_MB_GB(file.downloaded);
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
			row.addEventListener('dblclick', magdown.torrent_info_dbl_click);

			if (! file_is_process) {
				cell1.setAttribute('disabled', true);
				cell2.setAttribute('disabled', true);
				cell3.setAttribute('disabled', true);
			}
		}
	}
	//------------------------------------------------------------------------
	magdown.torrent_info_select_file_list_check_total();

	//------------------------------------------------------------------------
	// tab Trackers
	//------------------------------------------------------------------------
	var tracker_list = aDownload.doCommand('get_tracker_list');
	var tracker_list_box = document.getElementById('magdown_info_tracker_list');
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
			cell.setAttribute('label', 	magdown.utils.get_string('error.torrent_not_found'));
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

	var peer_list_box = document.getElementById('magdown_info_peer_list');
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
		cell.setAttribute('label', 	magdown.utils.get_strings_to_KB_MB_GB(peer.peer_speed, true));
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
magdown.torrent_info_remove = function(torrent_id) {
	var magdown_info = document.getElementById('magdown_info');
	if (magdown_info.current_torrent_id == torrent_id) {
		magdown.torrent_info_hide();
	}
}
//------------------------------------------------------------------------------
magdown.torrent_info_hide = function() {
	document.getElementById('magdown_splitter').hidden = true;
	document.getElementById('magdown_info').hidden = true;
	document.getElementById('magdown_info').current_torrent_id = 0;
}
//------------------------------------------------------------------------------
magdown.torrent_info_dbl_click = function(event) {
	var s3id = event.target.s3id;
	var file_id = event.target.file_id;
	var aDownload = magdown.get_download_by_s3id(s3id);
	if (! aDownload) { return; }
	//-----------------------------------------------------------------------
	var file_list = aDownload.doCommand('get_file_list');
	//-----------------------------------------------------------------------
	if (file_list[file_id].status == 'done') {
		magdown.torrent_info_open_file(aDownload, file_id);
	} else {
		var is_checked = event.target.firstChild.getAttribute("checked");
		is_checked = (String(is_checked) == 'true');
		magdown.torrent_info_select_file_list(aDownload, file_list, event.target, ! is_checked, false);
	}
}
//------------------------------------------------------------------------------
magdown.torrent_info_keyup = function(event) {
	var is_run = false;
	if (event.charCode && ((event.charCode == Components.interfaces.nsIDOMKeyEvent.DOM_VK_SPACE) || (event.charCode == Components.interfaces.nsIDOMKeyEvent.DOM_VK_ENTER))) {
		is_run = true;
	} else if (event.keyCode && ((event.keyCode == 32) || (event.keyCode == 13))) {
		is_run = true;
	}
	if (is_run) {
		magdown.torrent_info_dbl_click({ 'target' : event.target.selectedItem });
	}
}
//------------------------------------------------------------------------------
magdown.torrent_info_open_file = function(aDownload, file_id) {
	if (aDownload) {
		aDownload.doCommand("downloadsCmd_open", { 'file_id' : file_id });
	}
}
//------------------------------------------------------------------------------
magdown.torrent_info_select_file_list = function(aDownload, file_list, row, is_checked, is_all) {
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
		magdown.torrent_info_select_file_list_check_total();
	}
}
//------------------------------------------------------------------------------
magdown.torrent_info_select_file_list_all = function(checked) {
	var file_list_box = document.getElementById('magdown_info_file_list');
	var magdown_info = document.getElementById('magdown_info');
	var aDownload = magdown.get_download_by_s3id(magdown_info.current_torrent_id);
	if (! aDownload) { return; }
	var file_list = aDownload.doCommand('get_file_list');
	
	for (var i=0; i<file_list_box.itemCount; i++) {
		magdown.torrent_info_select_file_list(aDownload, file_list, file_list_box.getItemAtIndex( i ), checked, true);
	}
	aDownload.doCommand('set_file_status_all');
	magdown.torrent_info_select_file_list_check_total();
}
//------------------------------------------------------------------------------
magdown.torrent_info_select_file_list_check_total = function() {
	var file_list_box = document.getElementById('magdown_info_file_list');
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
	document.getElementById('magdown_info_file_list_total_size').value = file_count + ' / ' + magdown.utils.get_strings_to_KB_MB_GB(downloaded) + ' / ' + magdown.utils.get_strings_to_KB_MB_GB(total) + ' / ' + percent + '%';
}
//------------------------------------------------------------------------------
magdown.torrent_info_copy = function(event) {
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
		if (listcell.id.substring(0, 14) == 'magdown_info') {
			var value = listcell.getAttribute('label');
			if (value) {
				clipboard.copyString(value);
			}
		}
	}
}
//------------------------------------------------------------------------------
magdown.torrent_info_open_link = function(event) {
	var listcell_list = event.target.getElementsByTagName('listcell');
	for (var listcell of listcell_list) {
		if (listcell.id.substring(0, 14) == 'magdown_info') {
			var value = listcell.getAttribute('label');
			if (value) {
				if (/^magnet\:/.test(value)) {
					magdown.utils.add_new_torrent({ 'data' : value, 'is_url' : true, 'referrer_url' : '' });
				} else {
					openURL(value);
				}
			}
		}
	}
}
//------------------------------------------------------------------------------
magdown.context_change_tracker_check = function(event) {
	var aDownload = magdown.get_download(magdown.treeView.selection.currentIndex);
	var magdown_trackers = document.getElementById('magdown_context_trackers');
	if (aDownload.s3_metaData.paused || ! aDownload.s3_metaData.inProgress) {
		magdown_trackers.disabled = false;
	} else {
		magdown_trackers.disabled = true;
	}
}
//------------------------------------------------------------------------------
magdown.action_all = function(action) {
	magdown.treeView.selection.selectAll();
	magdown.action(action);
	magdown.treeView.selection.clearSelection();
}
//------------------------------------------------------------------------------
magdown.action_draw_begin = function(event) {
	if (event.button != 0) {
		return magdown.action_draw_end(event);
	}
	if (event.ctrlKey) {
		return magdown.action_draw_end(event);
	}
	if (event.target.tagName != 'treechildren') {
		return magdown.action_draw_end(event);
	}
	//------------------------------------------------------------------------
	var box = document.getElementById("magdown_draw_box");
	var hbox = document.getElementById("magdown_draw_box_hbox");

	//------------------------------------------------------------------------
	magdown.draw_box.start_x = event.pageX;
	magdown.draw_box.start_y = event.pageY;

	//------------------------------------------------------------------------
	box.style.left = event.pageX + "px";
	box.style.top = event.pageY + "px";
	hbox.height = 0;
	hbox.width = 0;
	magdown.draw_box.start_draw = true;
}
//------------------------------------------------------------------------------
magdown.action_draw_move = function(event) {
	//------------------------------------------------------------------------
	if (! magdown.draw_box.start_draw) {
		return;
	}
	//------------------------------------------------------------------------
	var box = document.getElementById("magdown_draw_box");
	var hbox = document.getElementById("magdown_draw_box_hbox");
	//------------------------------------------------------------------------
	var mouseX = event.pageX;
	var mouseY = event.pageY;
	//------------------------------------------------------------------------
	var left = mouseX < magdown.draw_box.start_x ? mouseX : magdown.draw_box.start_x;
	var top = mouseY < magdown.draw_box.start_y ? mouseY : magdown.draw_box.start_y;
	//------------------------------------------------------------------------
	var width = Math.abs(mouseX - magdown.draw_box.start_x);
	var height = Math.abs(mouseY - magdown.draw_box.start_y);

	//------------------------------------------------------------------------
	box.hidden = false;
	box.style.left = left + "px";
	box.style.top = top + "px";
	//------------------------------------------------------------------------
	hbox.width = width;
	hbox.height = height;

	//------------------------------------------------------------------------
	magdown.treeView.selection.clearSelection();
	for (var sel_y = top; sel_y < (top+height); sel_y++) {
		var row = magdown.treeView.tree.getRowAt(event.clientX, sel_y);
		if (row > -1) {
			magdown.treeView.selection.rangedSelect(row, row, true);
		}
	}
}
//------------------------------------------------------------------------------
magdown.action_draw_end = function(event) {
	document.getElementById("magdown_draw_box").hidden = true;
	if (magdown.draw_box.start_draw) {
		if (magdown.treeView.selection.count > 1) {
			document.getElementById("magdown_context").openPopupAtScreen(event.screenX, event.screenY, true);
		}
	}
	magdown.draw_box.start_draw = false;
}
//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
magdown.treeView = {};
magdown.treeView.rowCount = 0;
magdown.treeView.selection = null;
magdown.treeView.download_list = [];
magdown.treeView.tree = null;
magdown.treeView.sortName = 'DateTime';
magdown.treeView.sortDirection = 'descending';
magdown.treeView.filterText = '';

//------------------------------------------------------------------------------
magdown.treeView.insert_data = function(aDownload)  {
	magdown.treeView.download_list.push(aDownload);
	if (aDownload.isView) {
		magdown.treeView.tree.rowCountChanged(0, 1);
		magdown.treeView.rowCount++;
		magdown.treeView.sortElements();
	}
};
//------------------------------------------------------------------------------
magdown.treeView.change_data = function(row_tree)  {
	if (magdown.treeView.tree != null) {
		magdown.treeView.tree.invalidateRow(row_tree);
		magdown.treeView.sortElements();
	}
};
//------------------------------------------------------------------------------
magdown.treeView.getCellText = function(row, aColumn) {
	var d = magdown.get_download_metaData(row);
	if (! d) { return; }

	if (aColumn.id == "TorrentName") {
		return d.displayName;
	}
	else if (aColumn.id == "SaveDir") {
		return d.saveDir;
	}
	else if (aColumn.id == "DateTime") {
		var date = new Date(d.endTime);
		return date.toLocaleFormat(magdown.dateTime_format);
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
magdown.treeView.getCellValue = function(row, aColumn) {
	var d = magdown.get_download_metaData(row);
	if (! d) { return; };

	if (aColumn.id == "Progress") {
		return d.percentComplete;
	}
}
//------------------------------------------------------------------------------
magdown.treeView.getProgressMode = function(row, aColumn) {
	var d = magdown.get_download_metaData(row);
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
magdown.treeView.getRowProperties = function(row) {
	var d = magdown.get_download_metaData(row);
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
magdown.treeView.getCellProperties = function(row, aColumn) {
	return magdown.treeView.getRowProperties(row);
}
//------------------------------------------------------------------------------
magdown.treeView.setTree = function(aTree) {
	magdown.treeView.tree = aTree;
}
//------------------------------------------------------------------------------
magdown.treeView.cycleHeader = function(aColumn) {
	var elem = document.getElementById(aColumn.id);
	magdown.treeView.sortName = elem.id;
	magdown.treeView.sortDirection = elem.getAttribute('sortDirection');
	magdown.treeView.sortDirection = (magdown.treeView.sortDirection == 'ascending') ? 'descending' : 'ascending';
	magdown.treeView.sortElements();
}
//------------------------------------------------------------------------------
magdown.treeView.sortElements = function() {
	magdown.sort_handler_count++;

	if (magdown.sort_handler_count > 100) {
		if (magdown.sort_handler != null) {
			clearTimeout(magdown.sort_handler);
		}
		if (magdown.sort_handler_count > 1000) {
			magdown.treeView.sortElements_count_clear();
		} else {
			magdown.sort_handler = setTimeout(function(){ magdown.treeView.sortElements_count_clear(); } , 50);
		}
	} else {
		magdown.treeView.sortElements_run();
	}
}
//------------------------------------------------------------------------------
magdown.treeView.sortElements_count_clear = function() {
	magdown.sort_handler_count = 0;
	magdown.sort_handler = null;
	magdown.treeView.sortElements_run();
}
//------------------------------------------------------------------------------
magdown.treeView.sortElements_run = function() {
	//------------------------------------------------------------------------
	var sortName = magdown.treeView.sortName;
	var sortDirection = magdown.treeView.sortDirection;
	var selectionHash = magdown.treeView.selectionGet();
	//------------------------------------------------------------------------
	var cols = magdown.tree.getElementsByTagName("treecol");
	for (var i = 0; i < cols.length; i++) {
		cols[i].removeAttribute("sortActive");
		cols[i].removeAttribute("sortDirection");
	}

	//------------------------------------------------------------------------
	var elem = document.getElementById(sortName);
	elem.setAttribute('sortActive', true);
	elem.setAttribute('sortDirection', magdown.treeView.sortDirection);

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
	magdown.treeView.download_list = magdown.treeView.download_list.sort(func_sort);
	magdown.treeView.tree.invalidate();
	magdown.treeView.selectionRestore(selectionHash);
	magdown.count_summary();
}
//------------------------------------------------------------------------------
magdown.treeView.search = function(text) {
	magdown.treeView.filterText = text;
	var row = -1;
	for (var d of magdown.treeView.download_list) {
		if (d.isView) { row++; }

		if (magdown.check_download_filter(d, magdown.treeView.filterText)) {
			if (d.isView == false) {
				d.isView = true;
				magdown.treeView.tree.rowCountChanged(row, 1);
				magdown.treeView.rowCount++;
				row++;
			}
		} else if (d.isView) {
			magdown.treeView.tree.rowCountChanged(row, -1);
			magdown.treeView.rowCount--;
			row--;
			d.isView = false;
		}
	}
	magdown.treeView.sortElements();
}
//------------------------------------------------------------------------------
magdown.treeView.isContainer = function(aRow) { return false; }
magdown.treeView.isContainerOpen = function(aRow) { return false; }
magdown.treeView.isContainerEmpty = function(aRow) { return false; }
magdown.treeView.isSeparator = function(aRow) { return false; }
magdown.treeView.isSorted = function() { return false; }
magdown.treeView.canDrop = function(aIdx, aOrientation) { return false; }
magdown.treeView.drop = function(aIdx, aOrientation) { }
magdown.treeView.getParentIndex = function(aRow) { return -1; }
magdown.treeView.hasNextSibling = function(aRow, aAfterIdx) { return false; }
magdown.treeView.getLevel = function(aRow) { return 0; }

//------------------------------------------------------------------------------
magdown.treeView.selectionGet = function() {
	var result = {};
	if (magdown.treeView.selection) {
		var selectionCount = magdown.treeView.selection.count;
		if (selectionCount) {
			let start = {};
			let end = {};
			let numRanges = magdown.treeView.selection.getRangeCount();
			for (let rg = 0; rg < numRanges; rg++) {
				magdown.treeView.selection.getRangeAt(rg, start, end);
				for (var row = start.value; row <= end.value; row++) {
					var aDownload = magdown.get_download(row);
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
magdown.treeView.selectionRestore = function(selectionHash) {
	magdown.treeView.selection.clearSelection();
	for (var s3id in selectionHash) {
		var res = magdown.get_row_download(s3id);
		if (res.row_tree >= 0) {
			magdown.treeView.selection.rangedSelect(res.row_tree, res.row_tree, true);
		}
	}
}
//------------------------------------------------------------------------------
magdown.settings = function() {
	var winD = window.openDialog('chrome://magdown/content/settings.xul', 'magdown_prefs', 'chrome,modal,centerscreen,toolbar');
	winD.focus();
}
//------------------------------------------------------------------------------
