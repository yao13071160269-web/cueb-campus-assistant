# CUEB 校园助手 — 首都经济贸易大学 AI 智能体

基于 Next.js + DeepSeek AI 的校园智能助手，提供课表查询、图书馆选座、活动通知、办事流程指引、心理健康支持等功能。

## 快速启动

### 环境要求

- **Node.js** 18 或以上版本（[下载地址](https://nodejs.org/)）
- **DeepSeek API Key**（[申请地址](https://platform.deepseek.com/)）

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

## 功能特性

- **智能对话**：基于 DeepSeek 大模型，扮演首经贸"老学长"角色
- **课表查询**：根据当前教学周和时间，精准查询课程安排
- **图书馆选座**：实时查看各楼层座位情况并预约
- **活动通知**：监控首经贸官方微信公众号推送
- **办事指南**：涵盖教务、医疗报销、心理咨询等完整流程
- **心理支持**：融合首经贸校园特色的趣味解压方式

## 安全机制

- 学生数据 AES-256-GCM 加密存储
- HMAC 会话令牌认证
- API 速率限制
- 安全响应头（CSP / X-Frame-Options / XSS Protection）
- 敏感信息仅通过环境变量加载

## 技术栈

Next.js 16 · React · TypeScript · Tailwind CSS · DeepSeek API · AES-256-GCM
