/**
 * Pure decision logic for when a volume write to mplayer may be skipped, and
 * when the applied-volume cache may trust that a write actually landed.
 *
 * Background: mplayer silently drops a `volume` command sent before its audio
 * chain is initialised (0.74–5.58s after `loadfile` in production, measured).
 * If the cache is updated optimistically regardless, a dropped write poisons
 * it — every later call with the same requested volume then short-circuits,
 * and the volume is never actually applied. So `status.volume` must only ever
 * reflect a volume mplayer has *confirmed* (via a `time` event, i.e. audio is
 * playing), never one merely requested. `status.audioReady` tracks that
 * confirmation and is reset whenever a new track starts.
 *
 * Pure function with no side effects — safe to call in tests without mocking
 * anything. All I/O (writing to mplayer's stdin) and state mutation are
 * handled by the caller (`setVolume` in mplayer.js).
 *
 * @param {{ volume: number|null, audioReady: boolean }} status  Read-only view of current state.
 * @param {number} requestedVolume  Raw volume (0-100) as requested by the server.
 * @returns {{ normalisedVol: number, skipWrite: boolean, confirm: boolean }}
 *   normalisedVol: the value to send mplayer if writing.
 *   skipWrite: true if the command doesn't need (re)sending — already applied and confirmed.
 *   confirm: true if the caller may now trust this value into the cache (only once audio is ready).
 */
export function decideVolumeWrite(status, requestedVolume) {
	// mplayer's volume doesn't sound linear, so do some maths to try to get it
	// feeling more normal. (Also its volume is expressed as a percentage)
	const normalisedVol = Math.pow(requestedVolume, 0.2) * 100;
	const skipWrite = status.audioReady && status.volume === normalisedVol;
	const confirm = status.audioReady && !skipWrite;
	return { normalisedVol, skipWrite, confirm };
}
