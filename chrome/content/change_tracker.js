var s3torrent = {};

//------------------------------------------------------------------------------
s3torrent.dialog_init = function() {
	var tracker_list = (window.arguments && window.arguments[0]);
	if (tracker_list) {
		for (var tracker of tracker_list) {
			document.getElementById('s3torrent_tracker_textbox').value += tracker.url + "\n";
		}
	} else {
		window.close();
	}
}
//------------------------------------------------------------------------------
s3torrent.ondialogaccept = function() {
	var trackers = document.getElementById('s3torrent_tracker_textbox').value;
	trackers = trackers.replace(/\r/g, '');
	trackers = trackers.replace(/\n+/g, "\n");
	var tracker_list = trackers.split("\n");
	window.result = { 'is_ok' : true, 'tracker_list' : tracker_list };
}
