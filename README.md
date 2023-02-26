# lucos_media_linuxplayer
A browserless player for the lucos_media ecosystem

## Dependencies
* nodejs
* npm
* mplayer

## Environment variables

* _MEDIA_MANAGER_ The origin to use for calls to lucos_media_manager.  Defaults to the production instance.
* _HOSTDOMAIN_ The hostname this instance is running on - used for setting unique uuids and names to identify each client when multiple deployments of the app are running.