const uuid = process.env.CLIENT_UUID;
let name = process.env.CLIENT_NAME;
if (!uuid) throw "No `CLIENT_UUID` set";
if (!name) throw "No `CLIENT_NAME` set";
let current;

function getUuid() {
	return uuid;
}
function getName() {
	return name;
}
function setName(newName) {
	name = newName;
}
function isCurrent() {
	return current;
}
function setCurrent(newIsCurrent) {
	current = newIsCurrent;
}

module.exports = {getUuid, getName, setName, isCurrent, setCurrent};