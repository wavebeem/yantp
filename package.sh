#!/bin/bash
set -e

rm -rf ../yantp.zip
zip -r ../yantp.zip *.js *icon*.png *.html *.css manifest.json
