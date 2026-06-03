import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLine } from '../src/mplayer-parse.js';

// ── "Playing" lines ──────────────────────────────────────────────────────────

test('parseLine — "Playing" line yields url without trailing dot', () => {
	const result = parseLine('Playing http://example.com/track.mp3.', false);
	assert.deepEqual(result, { type: 'playing', url: 'http://example.com/track.mp3' });
});

test('parseLine — "Playing" line with path that contains dots', () => {
	const result = parseLine('Playing https://media.l42.eu/stream/some.track.mp3.', false);
	assert.equal(result.type, 'playing');
	assert.equal(result.url, 'https://media.l42.eu/stream/some.track.mp3');
});

// ── "A:" time lines (position updates) ──────────────────────────────────────

test('parseLine — "A:" time line yields numeric seconds and raw string', () => {
	const result = parseLine('A:   5.2   (0:05) of 120.0 (2:00) 128.0', false);
	assert.equal(result.type, 'time');
	assert.equal(result.seconds, 5.2);
	assert.equal(result.raw, '5.2');
});

test('parseLine — time regression: newTime < prevTime is detectable', () => {
	// The regression check in processData compares event.seconds against a
	// previously stored value.  Verify parseLine yields numbers that support it.
	const earlier = parseLine('A:  10.5 (0:10) of 120.0', false);
	const later   = parseLine('A:   5.0 (0:05) of 120.0', false);
	assert.equal(earlier.type, 'time');
	assert.equal(later.type, 'time');
	// This is the condition processData uses to detect a regression:
	assert.equal(later.seconds < earlier.seconds, true, 'should detect time going backwards');
});

test('parseLine — normal forward time progress is not flagged as regression', () => {
	const first  = parseLine('A:   5.0 (0:05) of 120.0', false);
	const second = parseLine('A:  10.5 (0:10) of 120.0', false);
	assert.equal(second.seconds < first.seconds, false, 'forward progress should not be a regression');
});

// ── EOF code lines ───────────────────────────────────────────────────────────

test('parseLine — "EOF code: 1" is an eof event', () => {
	const result = parseLine('EOF code: 1', false);
	assert.deepEqual(result, { type: 'eof', code: '1' });
});

test('parseLine — "EOF code: 4" is an eof event (proactive stop)', () => {
	// Code 4 means we stopped the track ourselves — processData should NOT
	// report an error for this.  parseLine just parses; the caller checks code.
	const result = parseLine('EOF code: 4', false);
	assert.deepEqual(result, { type: 'eof', code: '4' });
});

// ── "Audio:" lines ───────────────────────────────────────────────────────────

test('parseLine — "Audio:" line yields audio format', () => {
	const result = parseLine('Audio: MPEG(2.0), 44100 Hz, stereo', false);
	assert.equal(result.type, 'audio');
	assert.ok(result.format.includes('MPEG'));
});

test('parseLine — "Audio: no sound" is still an audio event', () => {
	// processData handles the "no sound" case by calling process.exit(2);
	// parseLine just parses and lets the caller decide.
	const result = parseLine('Audio: no sound', false);
	assert.deepEqual(result, { type: 'audio', format: 'no sound' });
});

// ── Stderr error lines ───────────────────────────────────────────────────────

test('parseLine — stderr "No stream found" is a stream_error', () => {
	const result = parseLine('No stream found to handle url http://example.com/', true);
	assert.equal(result.type, 'stream_error');
	assert.ok(result.reason.startsWith('No stream found'));
});

test('parseLine — "No stream found" on stdout is not an error (unknown)', () => {
	const result = parseLine('No stream found to handle url http://example.com/', false);
	assert.equal(result.type, 'unknown');
});

test('parseLine — stderr HTTP error yields http_error with captured text', () => {
	// mplayer outputs `[module]HTTP error ...` with no space between ] and H
	const result = parseLine('[http]HTTP error 404 Not Found', true);
	assert.equal(result.type, 'http_error');
	assert.equal(result.reason, 'HTTP error 404 Not Found');
});

test('parseLine — stderr FATAL error is fatal_error', () => {
	const result = parseLine('FATAL: Could not initialize audio driver.', true);
	assert.equal(result.type, 'fatal_error');
	assert.equal(result.reason, 'Could not initialize audio driver.');
});

test('parseLine — mpg123 "Error reading" is a codec_error', () => {
	const result = parseLine('mpg123: Error reading from stream', true);
	assert.equal(result.type, 'codec_error');
	assert.equal(result.message, 'mpg123: Error reading from stream');
});

test('parseLine — mpg123 "cannot reopen" is a codec_error', () => {
	const result = parseLine('mpg123 buffer cannot reopen: input stream', true);
	assert.equal(result.type, 'codec_error');
});

// ── Fallthrough ──────────────────────────────────────────────────────────────

test('parseLine — unrecognised line is "unknown"', () => {
	const result = parseLine('MPlayer SVN-r37641 (C) 2000-2020 MPlayer Team', false);
	assert.equal(result.type, 'unknown');
});
