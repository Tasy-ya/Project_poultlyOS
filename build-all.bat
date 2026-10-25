@echo off
chcp 65001 >nul
echo === build หน้าพนักงาน/แอดมิน ===
cd /d %~dp0frontend
call npm install || goto :err
call npm run build || goto :err
echo === build หน้าลูกค้า ===
cd /d %~dp0customer-frontend
call npm install || goto :err
call npm run build || goto :err
echo === ติดตั้ง backend ===
cd /d %~dp0backend
call npm install || goto :err
call npx prisma generate || goto :err
echo.
echo เสร็จแล้ว — รัน start-shop.bat เพื่อเปิดระบบ
pause
exit /b 0
:err
echo เกิดข้อผิดพลาด ดูข้อความด้านบน
pause
exit /b 1
