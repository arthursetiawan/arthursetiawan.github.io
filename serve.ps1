Param([int]$Port = 8000)
Write-Host "Serving site at http://127.0.0.1:$Port — press CTRL-C to stop"
python -m http.server $Port --bind 127.0.0.1
