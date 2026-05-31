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
        echo WERSS_API_KEY=
        echo TAVILY_API_KEY=
        echo WOLFRAM_APP_ID=
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

:: Start the server
echo.
echo ========================================
echo   启动成功！请在浏览器中访问：
echo   http://localhost:3000
echo.
echo   按 Ctrl+C 停止服务器
echo ========================================
echo.
npm run dev
