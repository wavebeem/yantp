#!/bin/bash
set -e

cd ..
rm -rf yantp.zip
zip -r yantp.zip yantp/{*.js,*icon*.png,*.html,*.css,manifest.json}
