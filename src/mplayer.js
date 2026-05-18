import { listenExisting } from 'lucos_pubsub';
import { put, del } from './manager.js';
import localDevice from './local-device.js';
import { spawn } from 'child_process';


const status = {
	url: null, // The URL of the track playing
	currentTime: 0, // How far the current track has progressed
	isPlaying: false, // Whether mplayer is current playing a track
	volume: null, // Value between 0 and 100 represent the volume used by mplayer (which has a non-linear relationship to the volume sent by lucos media manager)
	lastCodecError: null, // { message, timestamp } — set when mpg123 emits a stream error; used to distinguish codec aborts from natural EOF
	playStartTime: null, // Date.now() when mplayer starts playing the current track
};

// Tracks how many consecutive track errors have occurred without a successful completion.
// Used to compute exponential backoff delays before reporting errors to the server,
// preventing rapid-fire error storms when the audio driver or network is broken.
let consecutiveErrors = 0;

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Report a track error to the server with exponential backoff.
 *
 * First error in a sequence is reported immediately; subsequent consecutive errors
 * are delayed by 2^(n-1) seconds (1 s, 2 s, 4 s, … capped at 30 s).
 * The counter resets when a track completes successfully.
 */
async function reportTrackError(playlist, uuid, reason) {
	consecutiveErrors++;
	const backoffMs = consecutiveErrors > 1
		? Math.min(Math.pow(2, consecutiveErrors - 2) * 1000, 30000)
		: 0;
	if (backoffMs > 0) {
		console.warn(`Backing off ${backoffMs}ms before reporting track error (${consecutiveErrors} consecutive errors)`);
		await sleep(backoffMs);
	}
	try {
		await del(`v3/playlist/${playlist}/${uuid}?action=error`, reason);
	} catch (error) {
		console.error(`Failed to report track error to server: ${error}`);
	}
}

function processTerminated(code, signal) {
	if (code) {
		console.error(`mplayer quit with error code ${code} / ${signal}`);
	} else {
		console.error(`mplayer quit without error / ${signal}`);
	}
	process.exit(1);
}

function onStdout(buffer) {
	processData(buffer, false);
}
function onStderr(buffer) {
	processData(buffer, true);
}

function processData(buffer, isError) {
	const allData = buffer.toString();
	// data may contain multiple lines at once, so split them and process line-by-line
	allData.split("\n").forEach(singleLine => {
		const data = singleLine.trim();
		if (!data) return;
		let match;
		if(match = data.match(/^Playing\s(.{1,})\./)?.[1]) {
			status.isPlaying = true;
			status.url = match;
			status.lastCodecError = null;
			status.playStartTime = Date.now();
			console.info(`Playing track ${status.url}`);
		} else if(match = data.match(/^A:\s*([\d\.]+)\s*/)?.[1]) {
			if (match) {
				status.currentTime = match;
			} else {
				console.warn(`Can't match time update: ${data}`);
			}
		} else if(match = data.match(/^EOF code:\s*(\d+)/)?.[1]) {
			const durationMs = status.playStartTime ? Date.now() - status.playStartTime : null;
			const durationStr = durationMs !== null ? `${Math.round(durationMs / 1000)}s` : 'unknown duration';
			status.isPlaying = false;
			if (match == "4") {
				// Don't take action in response to a proactive stop command
				console.debug("Taking no action as track was proactively stopped");
			} else {
				const recentCodecError = status.lastCodecError
					&& (Date.now() - status.lastCodecError.timestamp) < 2000;
				const playlist = 'null'; // For now, the playlist slug isn't used (but needs to be part of the url).  Set it to null until there's an easier way to derive it.
				if (recentCodecError) {
					console.warn(`Track aborted after ${durationStr} (EOF code ${match}) due to codec error: ${status.lastCodecError.message}  [uuid: ${status.uuid}]`);
					reportTrackError(playlist, status.uuid, status.lastCodecError.message);
				} else {
					console.info(`Track Finished ${status.url} after ${durationStr} with status ${match} (end-of-stream).  [uuid: ${status.uuid}]`);
					consecutiveErrors = 0;
					del(`v3/playlist/${playlist}/${status.uuid}?action=complete`)
						.catch(error => console.error("Failed to report track completion to server", error));
				}
				status.lastCodecError = null;
			}
		} else if(match = data.match(/^Audio:\s(.+)/)?.[1]) {
			if (match === "no sound") {
				console.error("mplayer can't output any sound.  Exiting...");
				process.exit(2);
			}
			console.log(`Type of audio: ${match}`);
		} else if(isError && data.startsWith("No stream found")) {
			console.warn(`Track errored with "${data}"`);
			const playlist = 'null'; // For now, the playlist slug isn't used (but needs to be part of the url).  Set it to null until there's an easier way to derive it.
			reportTrackError(playlist, status.uuid, data);
		} else if(isError && (match = data.match(/^\[.*\](HTTP error.+)$/)?.[1])) {
			console.warn(`Track errored with "${match}"`);
			const playlist = 'null'; // For now, the playlist slug isn't used (but needs to be part of the url).  Set it to null until there's an easier way to derive it.
			reportTrackError(playlist, status.uuid, match);
		} else if(isError && (match = data.match(/^FATAL:\s*(.+)$/)?.[1])) {
			console.warn(`Track errored with fatal mplayer error: "${match}"`);
			const playlist = 'null'; // For now, the playlist slug isn't used (but needs to be part of the url).  Set it to null until there's an easier way to derive it.
			reportTrackError(playlist, status.uuid, match);
		} else if(isError && data.match(/^mpg123.*(?:Error reading|cannot reopen)/i)) {
			status.lastCodecError = { message: data, timestamp: Date.now() };
			console.warn(`Codec error: ${data}`);
		} else {
			if (isError) console.warn(data);
			else console.debug(data);
		}
	});
}

// mplayer logs some errors when these aren't set.  (Not sure it make much functional difference, but nice for clearer logs)
const mplayerEnv = {
	TERM: 'vt100',
	HOME: process.env.HOME,
};
const mplayerArgs = [
	'-msglevel', 'global=6', '-msglevel', 'cplayer=4', // Set the verbosity of mplayer logging
	'-slave', '-idle', // Tell mplayer to read commands from stdin, rather than keyboard events.  Also, don't quit while waiting for new commands
	'-nolirc', // Disable infrared remote control support to avoid warnings in logs
	'-cache', '16384', // 16 MB cache — largest track on the estate is ~12 MB, so this covers the whole file in RAM
	'-cache-min', '80', // Start playback once cache is 80% full — eliminates mid-playback Range requests and the cache-pointer mishap that causes mpg123 failures
]

const mplayer = spawn('mplayer', mplayerArgs, { env: mplayerEnv });

mplayer.stdout.on('data', onStdout);
mplayer.stderr.on('data', onStderr);
mplayer.on('exit', processTerminated);


async function updateCurrentAudio(data) {
	const now = data.tracks[0];
	const shouldPlay = data.isPlaying && localDevice.isCurrent();
	if (shouldPlay) {
		if (status.uuid !== now.uuid) {
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
		await setVolume(data.volume);
	} else {
		await pauseTrack();
	}
}
/**
 * Inserts credentials into a track's url
 */
async function authenticateTrack(href) {
	const url = new URL(href);
	url.username = `lucos_media_linuxplayer-${process.env.ENVIRONMENT}`;
	url.password = process.env.KEY_LUCOS_PRIVATE;
	return url.href;
}
async function changeTrack(track) {
	console.info(`Play track ${track.url} from ${track.currentTime} seconds`);
	await mplayer.stdin.write('stop\n');
	const authenticatedUrl = await authenticateTrack(track.url);
	await mplayer.stdin.write(`loadfile "${authenticatedUrl}" \n`);
	status.isPlaying = true;
	status.uuid = track.uuid;
	if (track.currentTime > 0) {
		await mplayer.stdin.write(`seek ${track.currentTime} 2\n`); // According to docs; "2 is a seek to an absolute position of <value> seconds."
	}
}
async function pauseTrack() {
	if (!status.isPlaying) return;
	status.isPlaying = false;
	console.info(`Pausing Track`);
	await mplayer.stdin.write("pause\n");

	// Send the server an update to let it know how far the track progressed
	await updateTrackStatus();
}
async function setVolume(volume) {

	// mplayer's volume doesn't sound linear, so do some maths to try to get it feeling more normal.
	// (Also its volume is expressed as a percentage)
	const normalisedVol = Math.pow(volume, 0.2) * 100;
	if (status.volume === normalisedVol) return;
	await mplayer.stdin.write(`volume ${normalisedVol} 1\n`); // Final argument here sets volume to absolute number, rather than relative
	status.volume = normalisedVol;
	console.info(`Volume at ${normalisedVol}%`);
}


async function updateTrackStatus() {
	if (!status.uuid) return;
	const playlist = 'null'; // For now, the playlist slug isn't used (but needs to be part of the url).  Set it to null until there's an easier way to derive it.
	await put(`v3/playlist/${playlist}/${status.uuid}/current-time`, status.currentTime);
}

// Send periodic status updates to keep server-side position fresh
setInterval(() => {
	if (status.isPlaying && localDevice.isCurrent()) {
		updateTrackStatus().catch(error => console.error("Error sending periodic status update", error));
	}
}, 10000);

// Push position immediately when device becomes not-current
listenExisting("device_notcurrent", () => updateTrackStatus().catch(error => console.error("Error sending status on device switch", error)));

listenExisting("managerData", updateCurrentAudio, true);