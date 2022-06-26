# lucos_media_linuxplayer
A browserless player for the lucos_media ecosystem

## Dependencies
* nodejs
* npm
* mplayer

## Environment variables

* _MEDIA_MANAGER_ The origin to use for calls to lucos_media_manager.  Defaults to the production instance.
* _CLIENT_UUID_ A unique uuid for identifying this client.  Needs to be different for each deployment of the player.
* _CLIENT_NAME_ The default name for this client.  Can be updated by other clients, but will revert to this default on restart of lucos_media_manager.