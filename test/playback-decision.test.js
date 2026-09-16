import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidePlayback } from '../src/playback-decision.js';

// ── The crash scenario (#146) ────────────────────────────────────────────────

test('decidePlayback — isPlaying true with an empty queue does not crash and does not play', () => {
	const data = { tracks: [], isPlaying: true, volume: 50 };
	const result = decidePlayback(data, true);
	assert.equal(result.now, undefined, 'no track to play');
	assert.equal(result.shouldPlay, false, 'must not attempt to play with nothing queued');
});

// ── Normal cases ──────────────────────────────────────────────────────────────

test('decidePlayback — isPlaying true with a queued track and current device plays', () => {
	const track = { uuid: 'abc', currentTime: 0 };
	const data = { tracks: [track], isPlaying: true, volume: 50 };
	const result = decidePlayback(data, true);
	assert.equal(result.now, track);
	assert.equal(result.shouldPlay, true);
});

test('decidePlayback — isPlaying false does not play even with a queued track', () => {
	const track = { uuid: 'abc', currentTime: 0 };
	const data = { tracks: [track], isPlaying: false, volume: 50 };
	const result = decidePlayback(data, true);
	assert.equal(result.shouldPlay, false);
});

test('decidePlayback — device not current does not play even with isPlaying true and a queued track', () => {
	const track = { uuid: 'abc', currentTime: 0 };
	const data = { tracks: [track], isPlaying: true, volume: 50 };
	const result = decidePlayback(data, false);
	assert.equal(result.shouldPlay, false);
});
