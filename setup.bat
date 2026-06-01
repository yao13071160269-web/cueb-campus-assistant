@echo off
chcp 65001 >nul
echo ========================================
echo   CUEB 校园助手 - 一键部署脚本
echo   首都经济贸易大学 AI 智能体
echo ========================================
echo.

:: Check Node.js
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

:: Check Docker (optional)
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] 未检测到 Docker（可选）
    echo        微信公众号监控已内置，无需 Docker
    echo        如需使用 we-mp-rss 扩展，可安装 Docker Desktop
    echo.
) else (
    echo [OK] Docker 已安装
    if exist "docker-compose.yml" (
        echo [INFO] 检测到 Docker，启动 we-mp-rss 备用服务...
        docker compose up -d 2>nul
        if %errorlevel% equ 0 (
            echo [OK] we-mp-rss 备用服务已启动 (http://localhost:8001)
        ) else (
            echo [INFO] Docker 服务未启动，使用内置微信监控
        )
    )
)

:: Create .env.local if not exists
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

:: Install dependencies
echo.
echo [INFO] 安装依赖包（首次运行需要等待1-2分钟）...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] 依赖安装失败
    pause
    exit /b 1
)
echo [OK] 依赖安装完成

:: Start the server and open browser
echo.
echo ========================================
echo   正在启动服务器...
echo   校园助手：http://localhost:3000
echo   监控管理：http://localhost:3000/admin
echo.
echo   微信公众号监控：
echo     打开 http://localhost:3000/admin
echo     点击"获取登录二维码"，用微信扫码即可
echo.
echo   按 Ctrl+C 停止服务器
echo ========================================
echo.
start "" http://localhost:3000
npm run dev
