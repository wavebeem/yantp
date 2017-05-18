$files = @(
  "*.js"
  "*icon*.png"
  "*.html"
  "*.css"
  "manifest.json"
)
Compress-Archive $files -Force -DestinationPath yantp.zip
