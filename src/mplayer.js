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

		// mplayer's volume doesn't sound linear, so do some maths to try to get it feeling more normal.
		// (Also it's volume is expressed as a percentage)
		const normalisedVol = Math.pow(data.volume, 0.2) * 100;
		player.volume(normalisedVol);
		console.log(`Volume at ${normalisedVol}%`);
	} else {
		await stopTrack();
	}
}
function playTrack(track) {

	// Pause until seeking has occured to avoid a blip of audio
	player.openFile(track.url, {pause: 1});
	player.seek(track.currentTime);
	player.setOptions({pause: 0});
	console.log(`Playing track ${track.url} from ${track.currentTime} seconds`);
}
async function stopTrack() {
	if (!currentState.playing) return;
	console.log(`Stopping Track`);
	player.stop();

	// Send the server an update to let it know how far the track progressed
	await manager.post("update");
	currentState = {};
}

pubsub.listenExisting("managerData", updateCurrentAudio, true);
player.on('status', newState => {
	currentState = newState;
});
player.on("stop", () => {
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
