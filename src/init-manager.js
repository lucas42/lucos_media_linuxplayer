import * as manager from './manager.js';

const mediaManager = process.env.MEDIA_MANAGER_URL || (() => { throw "MEDIA_MANAGER_URL Environment Variable not set" })();
const apiKey = process.env.KEY_LUCOS_MEDIA_MANAGER || (() => { throw "KEY_LUCOS_MEDIA_MANAGER Environment Variable not set" })();
manager.init(mediaManager, apiKey, `lucos_media_linuxplayer/${process.env.HOSTDOMAIN}`);