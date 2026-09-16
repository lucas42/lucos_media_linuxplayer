/**
 * Pure decision logic for whether playback should proceed, given the latest
 * data pushed by the manager.
 *
 * Background: `data.tracks[0]` is undefined whenever the queue is empty. If
 * the manager still reports `isPlaying` true in that state — e.g. immediately
 * after a queue drains during normal playback, or after a restore from a
 * backup taken mid-queue (see #146) — dereferencing the unguarded `now` threw,
 * which took the whole process down from inside a pubsub callback and Docker
 * restarted it straight back into the same crash.
 *
 * "Playing" with nothing queued is treated as an idle/stop condition, not an
 * error — the caller's existing stop path (pauseTrack) already handles it.
 *
 * Pure function with no side effects — safe to call in tests without mocking
 * anything. All I/O and state mutation are handled by the caller
 * (`updateCurrentAudio` in mplayer.js).
 *
 * @param {{ tracks: object[], isPlaying: boolean }} data
 * @param {boolean} isCurrentDevice
 * @returns {{ now: object|undefined, shouldPlay: boolean }}
 */
export function decidePlayback(data, isCurrentDevice) {
	const now = data.tracks[0];
	const shouldPlay = Boolean(now) && data.isPlaying && isCurrentDevice;
	return { now, shouldPlay };
}
