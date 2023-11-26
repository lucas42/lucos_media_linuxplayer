const mediaManager = process.env.MEDIA_MANAGER || "https://ceol.l42.eu/";
require("./console") // Ensure all logs are formatted nicely
require("./manager").init(mediaManager);  // Initiate the manager early so other modules can use it immediately
require("./poll");
require("./local-device-updates");
require("./mplayer");