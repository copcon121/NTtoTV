@echo off
cd /d "c:\Users\Administrator\Desktop\NTtoTV\backend"
.venv\Scripts\python.exe -m uvicorn app.app:app --host 0.0.0.0 --port 8000
pause
