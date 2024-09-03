const domainconfig = {
	'local-dev': {
		'uuid': "d56053b3-affd-4645-8b64-ca715f2aeea4",
		'name': "Local dev linux player",
	},
	'xwing-v4.s.l42.eu': {
		'uuid': "02db18a0-b29d-4eb1-be6d-e7242de6496e",
		'name': "Living Room",
	},
	'salvare-v4.s.l42.eu': {
		'uuid': "bc828821-649a-46bd-9624-7ef668022549",
		'name': "Bedroom",
	},
};
const hostdomain = process.env.HOSTDOMAIN;
if (!(hostdomain in domainconfig)) throw `Unknown HOSTDOMAIN "${hostdomain}"`;
const uuid = domainconfig[hostdomain].uuid;
const volumeExponent = domainconfig[hostdomain].volumeExponent || 0.2;
let name = domainconfig[hostdomain].name;
let current;

export function getUuid() {
	return uuid;
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
	current = newIsCurrent;
}
export function getVolumeExponent() {
	return volumeExponent;
}

export default {getUuid, getName, setName, isCurrent, setCurrent, getVolumeExponent};