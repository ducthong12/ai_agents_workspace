@echo off
cd /d "%~dp0"
rem Zalo AI LLM gateway uses an internal CA; Node only reads this at startup.
if not defined NODE_EXTRA_CA_CERTS if exist "C:\cert\za-ecc-root-ca.pem" set "NODE_EXTRA_CA_CERTS=C:\cert\za-ecc-root-ca.pem"
start "" "http://127.0.0.1:4317"
node server.mjs
pause
