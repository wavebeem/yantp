#!/bin/bash
set -e

cd ..
rm -rf yantp.zip
zip -r yantp.zip yantp/{*.js,*.png,*.html,*.css,manifest.json}
