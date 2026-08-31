import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideVolumeWrite } from '../src/volume-state.js';

// ── Before audio is ready (e.g. right after changeTrack) ────────────────────

test('decideVolumeWrite — before audio is ready, always writes and never confirms', () => {
	const status = { volume: null, audioReady: false };
	const result = decideVolumeWrite(status, 90);
	assert.equal(result.skipWrite, false, 'must write — mplayer might not have dropped it, we can\'t know yet');
	assert.equal(result.confirm, false, 'must not confirm — the write might be silently dropped (#139)');
});

test('decideVolumeWrite — before audio is ready, repeated identical requests keep retrying', () => {
	// This is the crux of the bug: a stale-but-matching cache must not
	// short-circuit retries until mplayer has actually confirmed the value.
	const status = { volume: null, audioReady: false };
	const first = decideVolumeWrite(status, 90);
	// Caller would NOT update status.volume here (confirm is false), so a
	// second call with the same requested volume is simulated on the same status.
	const second = decideVolumeWrite(status, 90);
	assert.equal(first.skipWrite, false);
	assert.equal(second.skipWrite, false, 'must not short-circuit while unconfirmed, even with a matching value');
});

// ── Once audio is ready (a `time` event has landed for this track) ──────────

test('decideVolumeWrite — once ready, a genuinely new value writes and confirms', () => {
	const status = { volume: 42, audioReady: true };
	const result = decideVolumeWrite(status, 90);
	assert.equal(result.skipWrite, false);
	assert.equal(result.confirm, true);
});

test('decideVolumeWrite — once ready, a matching value short-circuits', () => {
	const normalisedVol = Math.pow(90, 0.2) * 100;
	const status = { volume: normalisedVol, audioReady: true };
	const result = decideVolumeWrite(status, 90);
	assert.equal(result.skipWrite, true, 'no need to re-send a value mplayer has already confirmed');
});

test('decideVolumeWrite — the reassert once audio becomes ready confirms the value', () => {
	// Simulates the fix's core flow: changeTrack() resets audioReady to false,
	// the immediate setVolume() call in updateCurrentAudio() writes but can't
	// confirm, then the first `time` event flips audioReady and reasserts.
	let status = { volume: null, audioReady: false };
	const initial = decideVolumeWrite(status, 90);
	assert.equal(initial.skipWrite, false);
	assert.equal(initial.confirm, false);
	// audioReady flips true on the first `time` event; caller reasserts with
	// the same desired volume.
	status = { volume: status.volume, audioReady: true };
	const reassert = decideVolumeWrite(status, 90);
	assert.equal(reassert.skipWrite, false, 'nothing confirmed in the cache yet, so this must still write');
	assert.equal(reassert.confirm, true, 'now safe to cache — mplayer is confirmed ready');
});

// ── Normalisation ─────────────────────────────────────────────────────────

test('decideVolumeWrite — normalisedVol applies the non-linear volume curve', () => {
	const status = { volume: null, audioReady: true };
	const result = decideVolumeWrite(status, 90);
	assert.equal(result.normalisedVol, Math.pow(90, 0.2) * 100);
});
