const pubsub = require("./pubsub");
const manager = require("./manager");
const localDevice = require("./local-device");
const spawn = require('child_process').spawn;


const status = {
	url: null, // The URL of the track playing
	currentTime: 0, // How far the current track has progressed
	isPlaying: false, // Whether mplayer is current playing a track
	volume: null, // Value between 0 and 100 represent the volume used by mplayer (which has a non-linear relationship to the volume sent by lucos media manager)
	isChanging: false, // Whether there's a track change in progress
};

function processTerminated(code, signal) {
	if (code) {
		console.error(`mplayer quit with error code ${code} / ${signal}`);
	} else {
		console.error(`mplayer quit without error / ${signal}`);
	}
	process.exit(1);
}

function onStderr(errorMessage) {
	console.error(errorMessage.toString());
}

function onData(buffer) {
	const allData = buffer.toString();
	// data may contain multiple lines at once, so split them and process line-by-line
	allData.split("\n").forEach(singleLine => {
		const data = singleLine.trim();
		let match;
		if(match = data.match(/^Playing\s(.{1,})\./)?.[1]) {
			status.isPlaying = true;
			status.url = match;
			console.info(`Playing track ${status.url}`);
		} else if(match = data.match(/^A:\s*([\d\.]+)\s*/)?.[1]) {
			if (match) {
				status.currentTime = match;
			} else {
				console.warn(`Can't match time update: ${data}`);
			}
		} else if(match = data.match(/^EOF code:\s*(\d+)/)?.[1]) {
			console.debug(`Track ended with code ${match}`);
			status.isPlaying = false;
			if (status.isChanging) {
				// Don't apply to stops which were triggered by the server.
				console.debug("Taking no action as `isChanging` was set");
			} else if (match == "1") {
				console.info(`Track Finished ${getCurrentTrack()}`);
				manager.post("done", {track: getCurrentTrack()});
			} else {
				console.warn(`Track Errored ${getCurrentTrack()} with status ${match}`);
				manager.post("error", {track: getCurrentTrack(), message: `End of File code ${match}`});
			}
		} else if(match = data.match(/^Audio:\s(.+)/)?.[1]) {
			if (match === "no sound") {
				console.error("mplayer can't output any sound.  Exiting...");
				process.exit(2);
			}
			console.log(`Type of audio: ${match}`);
		} else {
			console.debug(`>Unknown mplayer stdout: ${data}`);
		}
	});
}

// mplayer logs some errors when these aren't set.  (Not sure it make much functional difference, but nice for clearer logs)
const mplayerEnv = {
	TERM: 'vt100',
	HOME: process.env.HOME,
};
const mplayerArgs = [
	'-msglevel', 'global=5', '-msglevel', 'cplayer=4', // Set the verbosity of mplayer logging
	'-slave', '-idle', // Tell mplayer to read commands from stdin, rather than keyboard events.  Also, don't quit while waiting for new commands
	'-nolirc', // Disable infrared remote control support to avoid warnings in logs
]

const mplayer = spawn('mplayer', mplayerArgs, { env: mplayerEnv });

mplayer.stdout.on('data', onData);
mplayer.stderr.on('data', onStderr);
mplayer.on('exit', processTerminated);


async function updateCurrentAudio(data) {
	const now = data.tracks[0];
	const shouldPlay = data.isPlaying && localDevice.isCurrent();
	if (shouldPlay) {
		await setVolume(data.volume);

		if (status.url !== now.url) {
			await changeTrack(now);
		}
		if (status.currentTime < now.currentTime) {
			await mplayer.stdin.write(`seek ${now.currentTime} 2\n`); // According to docs; "2 is a seek to an absolute position of <value> seconds."
		}
		if (!status.isPlaying) {
			status.isPlaying = true;
			console.info(`Unpausing Track`);
			await mplayer.stdin.write("pause\n");
		}

	} else {
		await pauseTrack();
	}
}
async function changeTrack(track) {
	status.isChanging = true;
	console.info(`Play track ${track.url} from ${track.currentTime} seconds`);
	await mplayer.stdin.write('stop\n');
	await mplayer.stdin.write(`loadfile "${track.url}" \n`);
	status.isPlaying = true;
	if (track.currentTime > 0) {
		await mplayer.stdin.write(`seek ${track.currentTime} 2\n`); // According to docs; "2 is a seek to an absolute position of <value> seconds."
	}

	status.isChanging = false;
}
async function pauseTrack() {
	if (!status.isPlaying) return;
	status.isPlaying = false;
	status.isChanging = true;
	console.info(`Pausing Track`);
	await mplayer.stdin.write("pause\n");

	// Send the server an update to let it know how far the track progressed
	await manager.post("update");
	status.isChanging = false;
}
async function setVolume(volume) {

	// mplayer's volume doesn't sound linear, so do some maths to try to get it feeling more normal.
	// The exponent varies by device, so rely on per device config
	// (Also it's volume is expressed as a percentage)
	const normalisedVol = Math.pow(volume, localDevice.getVolumeExponent()) * 100;
	if (status.volume === normalisedVol) return;
	await mplayer.stdin.write(`volume ${normalisedVol} 1\n`); // Final argument here sets volume to absolute number, rather than relative
	status.volume = normalisedVol;
	console.info(`Volume at ${normalisedVol}%`);
}

pubsub.listenExisting("managerData", updateCurrentAudio, true);
/**
 * Returns the number of seconds into the current track
 * Based on last update from mplayer.
 */
function getTimeElapsed() {
	return status.currentTime;
}

/**
 * Returns the URL of the currently playing track
 */
function getCurrentTrack() {
	return status.url;
}

/**
 * Returns true if the player is current playing media
 */
function isPlaying() {
	return status.isPlaying;
}

manager.setUpdateFunctions(getTimeElapsed, getCurrentTrack);
