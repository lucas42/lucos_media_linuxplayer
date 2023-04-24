#!/bin/bash

set -e

npm install
servicefile="/etc/systemd/system/mediaplayer.service"
tmpfile="/tmp/mediaplayer.service"
cat > $tmpfile <<- EOM
[Unit]
Description=LucOS Media Linux Player
StartLimitIntervalSec=0
Wants=bluetooth.service
After=bluetooth.service

[Service]
Restart=always
RestartSec=5
EOM

echo "User=`whoami`" >> $tmpfile
echo "ExecStart=`realpath mediaplayer.sh`" >> $tmpfile
echo "Environment=\"XDG_RUNTIME_DIR=`echo $XDG_RUNTIME_DIR`\"" >> $tmpfile

sudo mv $tmpfile $servicefile
sudo systemctl daemon-reload
sudo service mediaplayer restart
