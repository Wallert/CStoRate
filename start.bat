@echo off
title CantStop to rate - Local Server
echo Starting CantStop to rate...
echo Proxying Steam API to bypass CORS...
echo ----------------------------------------------------
echo Once the server starts, open http://127.0.0.1:8080 in your browser!
echo ----------------------------------------------------
npx http-server ./ -p 8080 -c-1 --proxy https://store.steampowered.com
pause
