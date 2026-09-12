@echo off
rem VELARIS configurator - local static server
cd /d "%~dp0"
start "" http://127.0.0.1:8123/index.html
python -m http.server 8123 --bind 127.0.0.1
