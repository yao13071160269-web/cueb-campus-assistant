@echo off
chcp 65001 >nul
title CUEB 校园助手 - 服务器
color 0F

echo ========================================
echo   CUEB 校园助手 - 一键部署脚本
echo   首都经济贸易大学 AI 智能体
echo ========================================
echo.

:: ── Step 1: Check Node.js ──
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] 未检测到 Node.js，请先安装：
    echo         https://nodejs.org/
    echo         建议下载 LTS 版本
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js 版本: %NODE_VER%

:: ── Step 2: Kill old process on port 3000 ──
echo [INFO] 检查端口 3000 ...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING" 2^>nul') do (
    echo [WARN] 端口 3000 被占用 (PID: %%a)，正在释放...
    taskkill /PID %%a /F >nul 2>nul
    timeout /t 2 /nobreak >nul
)
echo [OK] 端口 3000 可用

:: ── Step 3: Check Docker (optional) ──
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] 未检测到 Docker（可选，微信监控已内置）
) else (
    echo [OK] Docker 已安装
    if exist "docker-compose.yml" (
        docker compose up -d 2>nul
        if %errorlevel% equ 0 (
            echo [OK] we-mp-rss 备用服务已启动
        )
    )
)

:: ── Step 4: Create .env.local if not exists ──
if not exist ".env.local" (
    echo.
    echo [INFO] 首次运行，需要配置环境变量...
    echo.
    set /p DEEPSEEK_KEY="请输入 DeepSeek API Key: "
    (
        echo DEEPSEEK_API_KEY=%DEEPSEEK_KEY%
        echo DATA_ENCRYPTION_KEY=b2b77fc1415b85be4ff8c6c30164bf9ea9f40f4887f15d76a177ae7d98dae50f
        echo SESSION_SECRET=f14a5fafd319a53d3de49aa9254d01291e4d0de345c487723325385e8ce94253
        echo WEBHOOK_SECRET=109d9202f13c2e9c99ee408b7c89282416928b27afde0b30f0f08bbf21400f83
        echo WERSS_API_URL=http://localhost:8001
        echo TAVILY_API_KEY=
    ) > .env.local
    echo [OK] 环境变量已配置
) else (
    echo [OK] 环境变量已存在
)

:: ── Step 5: Install dependencies ──
echo.
if not exist "node_modules" (
    echo [INFO] 首次运行，安装依赖包（约1-2分钟）...
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

:: ── Step 6: Start server with auto-restart ──
:start_server
echo.
echo ========================================
echo   正在启动服务器...
echo.
echo   校园助手：http://localhost:3000
echo   监控管理：http://localhost:3000/admin
echo.
echo   微信公众号监控：
echo     登录页底部 → "管理员：微信公众号数据源配置"
echo     点击"获取登录二维码" → 用微信扫码即可
echo.
echo   按 Ctrl+C 停止服务器
echo ========================================
echo.

:: Wait for server to be ready, then open browser
start /b cmd /c "echo [INFO] 等待服务器就绪... & for /l %%i in (1,1,30) do (curl -s -o nul http://localhost:3000 && (echo [OK] 服务器已就绪！正在打开浏览器... & start "" http://localhost:3000 & exit /b 0) || timeout /t 1 /nobreak >nul) & echo [WARN] 服务器启动超时，请手动打开 http://localhost:3000"

call npx next dev -p 3000

:: If server exits (crashed), ask to restart
echo.
echo [WARN] 服务器已停止运行
echo.
set /p RESTART="是否重新启动？(Y/N): "
if /i "%RESTART%"=="Y" goto start_server
if /i "%RESTART%"=="y" goto start_server

echo.
echo 已退出，感谢使用 CUEB 校园助手！
pause
