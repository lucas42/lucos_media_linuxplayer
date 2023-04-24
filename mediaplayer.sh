#!/bin/bash
set -e
cd `dirname -- "$0"`
bluetoothctl connect 29:CF:34:CD:E5:83
HOSTDOMAIN=`hostname` npm start
