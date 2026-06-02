@echo off
chcp 65001 >nul
title CUEB 校园助手 - 服务器
color 0F

echo ========================================
echo   CUEB 校园助手 - 一键部署脚本
echo   首都经济贸易大学 AI 智能体
echo ========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] 未检测到 Node.js，请先安装 https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js: %NODE_VER%

echo [INFO] 检查端口 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING" 2^>nul') do (
    echo [WARN] 端口 3000 被占用 PID:%%a，正在释放...
    taskkill /PID %%a /F >nul 2>nul
)
timeout /t 1 /nobreak >nul
echo [OK] 端口 3000 可用

if not exist ".env.local" (
    echo.
    echo [INFO] 首次运行，需要配置环境变量...
    set /p DEEPSEEK_KEY=请输入 DeepSeek API Key: 
    call :write_env
) else (
    echo [OK] 环境变量已存在
)

if not exist "node_modules" (
    echo [INFO] 安装依赖包，请等待1-2分钟...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] 依赖安装失败
        pause
        exit /b 1
    )
    echo [OK] 依赖安装完成
) else (
    echo [OK] 依赖已就绪
)

:start_server
echo.
echo ========================================
echo   启动服务器中...
echo   校园助手: http://localhost:3000
echo   管理页面: http://localhost:3000/admin
echo.
echo   微信公众号: 登录页底部 管理员配置
echo   按 Ctrl+C 停止
echo ========================================
echo.

start /b cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"

call npx next dev -p 3000

echo.
echo [WARN] 服务器已停止
set /p RESTART=是否重新启动? (Y/N): 
if /i "%RESTART%"=="Y" goto start_server
if /i "%RESTART%"=="y" goto start_server
pause
exit /b 0

:write_env
echo DEEPSEEK_API_KEY=%DEEPSEEK_KEY%> .env.local
echo DATA_ENCRYPTION_KEY=b2b77fc1415b85be4ff8c6c30164bf9ea9f40f4887f15d76a177ae7d98dae50f>> .env.local
echo SESSION_SECRET=f14a5fafd319a53d3de49aa9254d01291e4d0de345c487723325385e8ce94253>> .env.local
echo WEBHOOK_SECRET=109d9202f13c2e9c99ee408b7c89282416928b27afde0b30f0f08bbf21400f83>> .env.local
echo WERSS_API_URL=http://localhost:8001>> .env.local
echo TAVILY_API_KEY=>> .env.local
echo [OK] 环境变量已配置
exit /b 0
