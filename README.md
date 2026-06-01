# CUEB 校园助手 — 首都经济贸易大学 AI 智能体

基于 Next.js + DeepSeek AI 的校园智能助手，提供课表查询、图书馆选座、活动通知、办事流程指引、心理健康支持等功能。

## 快速启动

### 环境要求

- **Node.js** 18 或以上版本（[下载地址](https://nodejs.org/)）
- **DeepSeek API Key**（[申请地址](https://platform.deepseek.com/)）
- Docker（可选，用于 we-mp-rss 备用监控）

### Windows 一键启动

双击运行 `setup.bat`，按提示输入 DeepSeek API Key 即可。

### 手动启动

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（复制模板并填入 API Key）
copy .env.example .env.local
# 编辑 .env.local，填入 DEEPSEEK_API_KEY

# 3. 启动开发服务器
npm run dev
```

启动后访问 **http://localhost:3000**

### 微信公众号自动监控

微信公众号监控功能已**内置到项目中**，无需安装 Docker。

1. 启动项目后，打开 **http://localhost:3000/admin**
2. 点击「获取登录二维码」
3. 使用微信扫码并确认登录（需要绑定了微信公众号的微信号）
4. 登录后系统自动从目标公众号抓取最新文章
5. 含「课堂」「预约」等关键词的文章自动推送到通知中心

> **提示**：扫码需要使用绑定了任意微信公众号的微信号（包括免费的个人订阅号）。
> 可在 [mp.weixin.qq.com](https://mp.weixin.qq.com/cgi-bin/registermidpage) 免费注册。登录有效期约 4 天。

#### 备用方案：we-mp-rss Docker

如果已安装 Docker，也可以使用 [we-mp-rss](https://github.com/rachelos/we-mp-rss) 作为备用：

```bash
docker compose up -d
# 访问 http://localhost:8001 管理面板
```

## 功能特性

- **智能对话**：基于 DeepSeek 大模型，扮演首经贸"老学长"角色
- **课表查询**：根据当前教学周和时间，精准查询课程安排
- **图书馆选座**：实时查看各楼层座位情况并预约
- **活动通知**：内置微信公众号平台接入，课堂预约等消息自动推送
- **办事指南**：涵盖教务、医疗报销、心理咨询等完整流程
- **心理支持**：融合首经贸校园特色的趣味解压方式

## 安全机制

- 学生数据 AES-256-GCM 加密存储
- HMAC 会话令牌认证
- API 速率限制
- 安全响应头（CSP / X-Frame-Options / XSS Protection）
- 敏感信息仅通过环境变量加载

## 技术栈

Next.js 16 · React · TypeScript · Tailwind CSS · DeepSeek API · AES-256-GCM · WeChat MP API
