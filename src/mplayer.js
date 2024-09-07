import { listenExisting } from 'lucos_pubsub';
import { put, del } from './manager.js';
import localDevice from './local-device.js';
import { spawn } from 'child_process';


const status = {
	url: null, // The URL of the track playing
	currentTime: 0, // How far the current track has progressed
	isPlaying: false, // Whether mplayer is current playing a track
	volume: null, // Value between 0 and 100 represent the volume used by mplayer (which has a non-linear relationship to the volume sent by lucos media manager)
};

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
			if (match == "4") {
				// Don't take action in response to a procative stop command
				console.debug("Taking no action as track was proactively stopped");
			} else {
				console.info(`Track Finished ${status.url} with status ${match}.  [uuid: ${status.uuid}]`);
				const playlist = 'null'; // For now, the playlist slug isn't used (but needs to be part of the url).  Set it to null until there's an easier way to derive it.
				del(`v3/playlist/${playlist}/${status.uuid}?action=complete`);
			}
		} else if(match = data.match(/^Audio:\s(.+)/)?.[1]) {
			if (match === "no sound") {
				console.error("mplayer can't output any sound.  Exiting...");
				process.exit(2);
			}
			console.log(`Type of audio: ${match}`);
		} else if(isError && data.startsWith("No stream found")) {
			console.warn(`Track errored with "${data}" ${getCurrentTrack()}`);
			const playlist = 'null'; // For now, the playlist slug isn't used (but needs to be part of the url).  Set it to null until there's an easier way to derive it.
			del(`v3/playlist/${playlist}/${status.uuid}?action=error`, data);
		} else if(isError && (match = data.match(/^\[.*\](HTTP error.+)$/)?.[1])) {
			console.warn(`Track errored with "${match}" ${getCurrentTrack()}`);
			const playlist = 'null'; // For now, the playlist slug isn't used (but needs to be part of the url).  Set it to null until there's an easier way to derive it.
			del(`v3/playlist/${playlist}/${status.uuid}?action=error`, match);
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
]

const mplayer = spawn('mplayer', mplayerArgs, { env: mplayerEnv });

mplayer.stdout.on('data', onStdout);
mplayer.stderr.on('data', onStderr);
mplayer.on('exit', processTerminated);


async function updateCurrentAudio(data) {
	const now = data.tracks[0];
	const shouldPlay = data.isPlaying && localDevice.isCurrent();
	if (shouldPlay) {
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
		await setVolume(data.volume);
	} else {
		await pauseTrack();
	}
}
async function changeTrack(track) {
	console.info(`Play track ${track.url} from ${track.currentTime} seconds`);
	await mplayer.stdin.write('stop\n');
	await mplayer.stdin.write(`loadfile "${track.url}" \n`);
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

listenExisting("managerData", updateCurrentAudio, true);