import { getUuid, setCurrent, getName, setName } from './local-device.js';
import { listenExisting } from 'lucos_pubsub';
import { post } from './manager.js';

function updatelocalDevice(data) {
	const device = data.devices.find(device => device.uuid === getUuid());
	if (!device) {
		throw "Connected device not returned by server"
	}
	setCurrent(device.isCurrent);

	// If name hasn't changed, then don't take action
	if (device.name === getName()) return;

	// If the server is still using a default name, then update it with the local one
	if (getName() && device.isDefaultName) {
		return post("devices", {
			uuid: getUuid(),
			name: getName()
		});
	}

	// Otherwise server provided name takes precedent
	setName(device.name);
}

listenExisting("managerData", updatelocalDevice, true);