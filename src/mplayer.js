const pubsub = require("./pubsub");
const manager = require("./manager");
const localDevice = require("./local-device");
const MPlayer = require("mplayer");
const player = new MPlayer();

let currentState = {};
let timeElapsed = 0;
let changing = false; // Whether there's a track change in progress

async function updateCurrentAudio(data) {
	const now = data.tracks[0];
	const shouldPlay = data.isPlaying && localDevice.isCurrent();
	if (shouldPlay) {
		await setVolume(data.volume);

		if (currentState.filename !== now.url) {
			await changeTrack(now);
		}
		if (currentState.currentTime < now.currentTime) {
			player.seek(now.currentTime);
		}
		if (!currentState.playing) {
			player.play();
		}

	} else {
		await pauseTrack();
	}
}
async function changeTrack(track) {
	changing = true;
	player.openFile(track.url);
	if (track.currentTime > 0) player.seek(track.currentTime);
	changing = false;
	console.log(`Playing track ${track.url} from ${track.currentTime} seconds`);
}
async function pauseTrack() {
	if (!currentState.playing) return;
	changing = true;
	console.log(`Pausing Track`);
	player.pause();

	// Send the server an update to let it know how far the track progressed
	await manager.post("update");
	currentState = {};
	changing = false;
}
async function setVolume(volume) {

	// mplayer's volume doesn't sound linear, so do some maths to try to get it feeling more normal.
	// (Also it's volume is expressed as a percentage)
	const normalisedVol = Math.pow(volume, 0.2) * 100;
	if (player.status.volume === normalisedVol) return;
	player.volume(normalisedVol);
	console.log(`Volume at ${normalisedVol}%`);
}

pubsub.listenExisting("managerData", updateCurrentAudio, true);
player.on('status', newState => {
	currentState = newState;
});
player.on("stop", () => {
	if (changing) return; // Ignore stops which were triggered by the server.
	console.log(`Track Finished ${getCurrentTrack()}`);
	manager.post("done", {track: getCurrentTrack(), status: "ended"});
});
player.on("time", newTimeElapsed => {
	timeElapsed = newTimeElapsed;
})

/**
 * Returns the number of seconds into the current track
 * Based on last update from mplayer.
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
