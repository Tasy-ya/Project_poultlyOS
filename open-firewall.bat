@echo off
chcp 65001 >nul
net session >nul 2>&1
if errorlevel 1 (
  echo กรุณาคลิกขวาไฟล์นี้ แล้วเลือก "Run as administrator"
  pause
  exit /b 1
)
netsh advfirewall firewall delete rule name="PoultryOS" >nul 2>&1
netsh advfirewall firewall add rule name="PoultryOS" dir=in action=allow protocol=TCP localport=3001,5173 profile=any
echo เปิดพอร์ต 3001 และ 5173 ให้เครื่องอื่นในร้านเข้าได้แล้ว
pause
