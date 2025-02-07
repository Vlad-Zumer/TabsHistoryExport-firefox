#!/bin/bash

zip TabHistoryExport.zip -r ./icons/icon.png \
                            ./icons/icon-32.png \
                            ./icons/icon-48.png \
                            ./icons/icon-64.png \
                            ./icons/icon-96.png \
                            ./icons/icon-128.png \
                            ./options \
                            ./common_utils.js \
                            ./background_script.js \
                            ./manifest.json
