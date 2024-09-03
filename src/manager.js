let mediaManager = undefined;
let getTimeElapsed = () => undefined;
let getCurrentTrack = () => undefined;

const controller = new AbortController();
const signal = controller.signal;

export function init(mediaManagerValue) {
	mediaManager = mediaManagerValue;
}
export function get(endpoint) {
	if (!mediaManager) throw "making request before manager module initiated";
	const url = mediaManager+endpoint;
	return fetch(url, {method: 'GET', signal});
}
export function put(endpoint, body) {
	if (!mediaManager) throw "making request before manager module initiated";
	const url = mediaManager+endpoint;
	return fetch(url, {method: 'PUT', body, signal});
}
export function del(endpoint, body) { // Not called 'delete', because that's a reserved word in javascript
	if (!mediaManager) throw "making request before manager module initiated";
	const url = mediaManager+endpoint;
	return fetch(url, {method: 'DELETE', body, signal});
}

export function abortAllRequests(reason) {
	controller.abort(reason);
}

//**** All functions below are deprecated

import { getUuid } from './local-device.js';

/**
 * Returns some standard GET parameters to include in all requests
 * so that server knows the current state of play
 */
function _getUpdateParams() {
	const params = new URLSearchParams();
	if (getUuid() !== undefined) params.set("device", getUuid());

	const timeElapsed = getTimeElapsed();
	const currentTrack = getCurrentTrack();
	if (timeElapsed === undefined || currentTrack === undefined) return params;
	params.set("update_url", currentTrack);
	params.set("update_time", timeElapsed);
	params.set("update_timeset", new Date().getTime());
	return params;
}

function _makeRequestToManager(endpoint, method, parameters={}) {
	if (!mediaManager) throw "making request before manager module initiated";
	const searchParams = _getUpdateParams();
	for (const [key, value] of Object.entries(parameters)) {
		if (value === null || value === undefined) continue;
		searchParams.set(key, value);
	}
	let url = mediaManager+endpoint;
	if (searchParams.toString()) url += "?" + searchParams.toString();
	return fetch(url, {method})
}

export async function getJson(endpoint, parameters={}) {
	const response = await _makeRequestToManager(endpoint, 'get', parameters);
	return response.json();
}
