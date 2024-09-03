import { send } from 'lucos_pubsub';

let uuid;
let name;
let current;

export function getUuid() {
	return uuid;
}
export function setUuid(newUuid) {
	if (uuid === newUuid) return;
	if (uuid !== undefined) throw "Device uuid already set, can't change";
	uuid = newUuid;
}
export function getName() {
	return name;
}
export function setName(newName) {
	name = newName;
}
export function isCurrent() {
	return current;
}
export function setCurrent(newIsCurrent) {
	if (current === newIsCurrent) return;
	current = newIsCurrent;
	send(current?'device_current':'device_notcurrent');
}

export default {getUuid, setUuid, getName, setName, isCurrent, setCurrent};