/**
 * Parse a single trimmed, non-empty line of mplayer output into a structured
 * event object.
 *
 * Pure function with no side effects — safe to call in tests without mocking
 * anything.  All stateful decisions (updating `status`, reporting errors, etc.)
 * are handled by the caller (`processData` in mplayer.js).
 *
 * @param {string} line    A single trimmed, non-empty line from mplayer output.
 * @param {boolean} isError  True when the line came from mplayer's stderr.
 * @returns {{ type: string, [key: string]: any }}
 */
export function parseLine(line, isError) {
	let match;
	if (match = line.match(/^Playing\s(.{1,})\./)?.[1]) {
		return { type: 'playing', url: match };
	} else if (match = line.match(/^A:\s*([\d\.]+)\s*/)?.[1]) {
		// `raw` preserves the original string so callers can store it unchanged.
		// `seconds` is the parsed float for numeric comparisons (regression checks, etc).
		return { type: 'time', seconds: parseFloat(match), raw: match };
	} else if (match = line.match(/^EOF code:\s*(\d+)/)?.[1]) {
		return { type: 'eof', code: match };
	} else if (match = line.match(/^Audio:\s(.+)/)?.[1]) {
		return { type: 'audio', format: match };
	} else if (isError && line.startsWith("No stream found")) {
		return { type: 'stream_error', reason: line };
	} else if (isError && (match = line.match(/^\[.*\](HTTP error.+)$/)?.[1])) {
		return { type: 'http_error', reason: match };
	} else if (isError && (match = line.match(/^FATAL:\s*(.+)$/)?.[1])) {
		return { type: 'fatal_error', reason: match };
	} else if (isError && line.match(/^mpg123.*(?:Error reading|cannot reopen)/i)) {
		return { type: 'codec_error', message: line };
	} else {
		return { type: 'unknown' };
	}
}
