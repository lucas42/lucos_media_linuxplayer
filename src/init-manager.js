import { init } from './manager.js';

const mediaManager = process.env.MEDIA_MANAGER || "https://ceol.l42.eu/";

init(mediaManager);