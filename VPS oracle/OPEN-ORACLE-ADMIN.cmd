@echo off
setlocal
title Oracle Rithmic Admin - Secure Tunnel
pushd "%~dp0"
echo Opening encrypted SSH tunnel to Oracle VPS...
echo Keep this window open while using the admin page.
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:8088/admin'"
"%WINDIR%\System32\OpenSSH\ssh.exe" -N -L 127.0.0.1:8088:127.0.0.1:80 -i python-app-a1-ssh -o UserKnownHostsFile=python-app-a1-known-hosts -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 ubuntu@129.221.134.238
echo.
echo SSH tunnel closed. Press any key to exit.
pause >nul
popd
