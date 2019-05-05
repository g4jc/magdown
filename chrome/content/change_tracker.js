var magdown = {};

//------------------------------------------------------------------------------
magdown.dialog_init = function() {
	var tracker_list = (window.arguments && window.arguments[0]);
	if (tracker_list) {
		for (var tracker of tracker_list) {
			document.getElementById('magdown_tracker_textbox').value += tracker.url + "\n";
		}
	} else {
		window.close();
	}
}
//------------------------------------------------------------------------------
magdown.ondialogaccept = function() {
	var trackers = document.getElementById('magdown_tracker_textbox').value;
	trackers = trackers.replace(/\r/g, '');
	trackers = trackers.replace(/\n+/g, "\n");
	var tracker_list = trackers.split("\n");
	window.result = { 'is_ok' : true, 'tracker_list' : tracker_list };
}
