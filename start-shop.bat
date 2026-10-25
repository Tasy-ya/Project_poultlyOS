@echo off
chcp 65001 >nul
cd /d %~dp0backend
if not exist node_modules\compression (
  echo ติดตั้งแพ็กเกจที่ขาด ^(ครั้งแรกครั้งเดียว^)...
  call npm install
)
:loop
echo [%date% %time%] เริ่ม backend...
node src/server.js
echo [%date% %time%] backend หยุดทำงาน รอ 3 วินาทีแล้วเริ่มใหม่อัตโนมัติ (ปิดหน้าต่างนี้เพื่อหยุด)
timeout /t 3 >nul
goto loop
