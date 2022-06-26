const pubsub = require("./pubsub");
const manager = require("./manager");
const localDevice = require("./local-device");
const MPlayer = require("mplayer");
const player = new MPlayer();

let currentState = {};
let timeElapsed = 0;

async function updateCurrentAudio(data) {
	const now = data.tracks[0];
	const shouldPlay = data.isPlaying && localDevice.isCurrent();
	if (shouldPlay) {
		if (!currentState.playing) {
			playTrack(now);
		} else if (getCurrentTrack() !== now.url) {
			playTrack(now);
		}

		// mplayer volume is a percentage, rather than out of 1
		player.volume(data.volume * 100);
	} else {
		console.log(`Stopping Track`);
		currentState = {};
		player.stop();
	}
}
function playTrack(track) {
	player.openFile(track.url);
	player.seek(track.currentTime);
	console.log(`Playing track ${track.url} from ${track.currentTime} seconds`);
}

pubsub.listenExisting("managerData", updateCurrentAudio, true);
player.on('status', newState => {
	console.log("mplayer status update", newState);
	currentState = newState;
});
player.on("stop", () => {
	console.log(`Track Finished ${getCurrentTrack()}`);
	manager.post("done", {track: getCurrentTrack(), status: "ended"});
});
player.on("time", newTimeElapsed => {
	console.log("timeElapsed update", timeElapsed, newTimeElapsed);
	timeElapsed = newTimeElapsed;
})

/**
 * Returns the number of seconds into the current track
 * Based on last update from mplayer, which updates every 30 seconds.
 */
function getTimeElapsed() {
	return timeElapsed;
}

/**
 * Returns the URL of the currently playing track
 */
function getCurrentTrack() {
	return currentState.filename;
}

/**
 * Returns true if the player is current playing media
 */
function isPlaying() {
	return currentState.playing;
}

manager.setUpdateFunctions(getTimeElapsed, getCurrentTrack);
