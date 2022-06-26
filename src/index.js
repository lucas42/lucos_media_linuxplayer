const mediaManager = process.env.MEDIA_MANAGER || "https://ceol.l42.eu/";
require("./manager").init(mediaManager);  // Initiate the manager first so other modules can use it immediately
require("./poll");
require("./local-device-updates");
require("./mplayer");