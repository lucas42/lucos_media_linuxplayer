import localDevice from './local-device.js';
import { listenExisting } from 'lucos_pubsub';
import { put } from './manager.js';

function updatelocalDevice(data) {
	const device = data.devices.find(device => device.uuid === localDevice.getUuid());
	if (!device) {
		throw "Connected device not returned by server"
	}
	localDevice.setCurrent(device.isCurrent);

	// If name hasn't changed, then don't take action
	if (device.name === localDevice.getName()) return;

	// If the server is still using a default name, then update it with the local one
	if (localDevice.getName() && device.isDefaultName) {
		put(`v3/device-names/${localDevice.getUuid()}`, localDevice.getName());
	}

	// Otherwise server provided name takes precedent
	localDevice.setName(device.name);
}

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
localDevice.setUuid(domainconfig[hostdomain].uuid);
localDevice.setName(domainconfig[hostdomain].name);

listenExisting("managerData", updatelocalDevice, true);