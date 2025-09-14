# Auth0 Authentication Setup Guide

本文档详细说明如何配置 Auth0 认证系统，包括邮箱验证和社交登录（Google、GitHub）。

## 目录
- [Auth0 基础配置](#auth0-基础配置)
- [邮箱验证配置](#邮箱验证配置)
- [Google 登录配置](#google-登录配置)
- [GitHub 登录配置](#github-登录配置)
- [环境变量配置](#环境变量配置)
- [测试验证](#测试验证)

## Auth0 基础配置

### 1. 创建 Auth0 账户
1. 访问 [Auth0官网](https://auth0.com) 注册免费账户
2. 创建新的 Tenant（租户），选择区域（建议选择距离用户较近的区域）
3. 记录你的 Domain：`your-tenant.auth0.com`

### 2. 创建应用程序
1. 进入 Auth0 Dashboard
2. 点击 `Applications` → `Create Application`
3. 选择 `Regular Web Applications`
4. 应用名称：`Character Creation Platform`
5. 记录 `Client ID` 和 `Client Secret`

### 3. 配置应用设置
在应用设置中配置以下 URL：

**Allowed Callback URLs:**
```
http://localhost:3000/callback,
https://your-production-domain.com/callback
```

**Allowed Logout URLs:**
```
http://localhost:3000,
https://your-production-domain.com
```

**Allowed Web Origins:**
```
http://localhost:3000,
https://your-production-domain.com
```

## 邮箱验证配置

### Auth0 免费邮件服务
Auth0 提供免费邮件服务：
- **免费额度**：1000封邮件/月
- **用途**：邮箱验证、密码重置
- **配置**：默认已启用

### 启用邮箱验证
1. 进入 Auth0 Dashboard
2. 导航到 `Authentication` → `Database`
3. 点击你的数据库连接（通常是 `Username-Password-Authentication`）
4. 在 `Settings` 标签页中：
   - 启用 `Requires Email Verification`
   - 设置 `Disable Sign Ups`（如果需要）

### 自定义邮件模板（可选）
1. 进入 `Branding` → `Email Templates`
2. 选择模板类型（Verification Email、Welcome Email等）
3. 自定义邮件内容和样式

## Google 登录配置

### 1. 创建 Google Cloud Project
1. 访问 [Google Cloud Console](https://console.cloud.google.com)
2. 创建新项目或选择现有项目
3. 项目名称：`Character Creation Platform`

### 2. 启用 Google+ API
1. 在左侧菜单中选择 `APIs & Services` → `Library`
2. 搜索并启用 `Google+ API`

### 3. 创建 OAuth 2.0 凭据
1. 进入 `APIs & Services` → `Credentials`
2. 点击 `Create Credentials` → `OAuth client ID`
3. 应用程序类型：`Web application`
4. 名称：`Character Creation Auth`

5. 配置重定向 URI：
```
https://your-tenant.auth0.com/login/callback
```

6. 记录生成的 `Client ID` 和 `Client Secret`

### 4. 在 Auth0 中配置 Google 连接
1. 进入 Auth0 Dashboard
2. 导航到 `Authentication` → `Social`
3. 点击 `Google` 连接
4. 启用连接并填入：
   - **Client ID**: Google OAuth Client ID
   - **Client Secret**: Google OAuth Client Secret
5. 在 `Applications` 标签页中启用此应用程序

## GitHub 登录配置

### 1. 创建 GitHub OAuth App
1. 登录 GitHub，进入 `Settings`
2. 选择 `Developer settings` → `OAuth Apps`
3. 点击 `New OAuth App`

### 2. 填写应用信息
- **Application name**: `Character Creation Platform`
- **Homepage URL**: `http://localhost:3000` (开发) / `https://your-domain.com` (生产)
- **Authorization callback URL**: 
```
https://your-tenant.auth0.com/login/callback
```

### 3. 获取凭据
创建后会生成：
- **Client ID**: 公开的应用标识符
- **Client Secret**: 点击 `Generate a new client secret` 生成

⚠️ **重要**: Client Secret 只显示一次，请立即保存

### 4. 在 Auth0 中配置 GitHub 连接
1. 进入 Auth0 Dashboard
2. 导航到 `Authentication` → `Social`
3. 点击 `GitHub` 连接
4. 启用连接并填入：
   - **Client ID**: GitHub OAuth App Client ID
   - **Client Secret**: GitHub OAuth App Client Secret
5. 在 `Applications` 标签页中启用此应用程序

## 环境变量配置

创建 `.env` 文件（基于 `.env.example`）：

```bash
# Auth0 基础配置
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_auth0_client_id
AUTH0_CLIENT_SECRET=your_auth0_client_secret
AUTH0_AUDIENCE=https://your-tenant.auth0.com/api/v2/
AUTH0_SCOPE=openid profile email
AUTH0_BASE_URL=http://localhost:3000
AUTH0_SESSION_SECRET=your_random_session_secret_at_least_32_characters_long
AUTH0_ENABLE_TELEMETRY=true
AUTH0_IDP_LOGOUT=true
AUTH0_AUTH_REQUIRED=false

# 社交登录配置（可选）
AUTH0_GOOGLE_CLIENT_ID=your_google_oauth_client_id
AUTH0_GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
AUTH0_GITHUB_CLIENT_ID=your_github_oauth_client_id
AUTH0_GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
```

### 生成安全密钥
```bash
# 生成 32 位随机字符串用作 Session Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 测试验证

### 1. 启动应用
```bash
npm install
npm run dev
```

### 2. 测试功能

**邮箱注册/登录:**
1. 访问 `http://localhost:3000/login`
2. 使用邮箱注册新用户
3. 检查邮箱验证邮件
4. 验证后登录测试

**Google 登录:**
1. 点击 Google 登录按钮
2. 验证 Google OAuth 流程
3. 确认用户信息正确获取

**GitHub 登录:**
1. 点击 GitHub 登录按钮
2. 验证 GitHub OAuth 流程
3. 确认用户信息正确获取

### 3. 调试工具

**Auth0 Logs:**
- 在 Auth0 Dashboard 中查看 `Monitoring` → `Logs`
- 实时查看认证事件和错误

**本地调试:**
```bash
# 启用详细日志
DEBUG=express-openid-connect:* npm run dev
```

## 费用说明

### 免费限额
- **Auth0**: 7,000 活跃用户/月
- **邮件**: 1,000 封/月
- **Google OAuth**: 完全免费
- **GitHub OAuth**: 完全免费

### 超出免费额度
- Auth0: $23/月 起（专业计划）
- 邮件服务: 可配置 Mailgun（5,000封/月免费）或 SendGrid

## 故障排除

### 常见问题

**1. 回调 URL 错误**
```
Error: Invalid callback URL
```
解决: 检查 Auth0 应用设置中的回调 URL 配置

**2. 邮件发送失败**
```
Error: Email delivery failed
```
解决: 检查 Auth0 邮件配置，确认未超出免费限额

**3. 社交登录失败**
```
Error: Access denied
```
解决: 
- 检查 OAuth 应用配置
- 确认回调 URL 正确
- 验证 Client Secret 未过期

### 日志检查
```bash
# 查看 Auth0 详细日志
curl -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN" \
  "https://your-tenant.auth0.com/api/v2/logs"
```

## 生产环境注意事项

1. **HTTPS 必需**: 生产环境必须使用 HTTPS
2. **域名配置**: 更新所有回调 URL 为生产域名
3. **密钥安全**: 使用环境变量存储敏感信息
4. **监控**: 启用 Auth0 日志监控
5. **备份**: 定期导出用户数据

## 相关链接

- [Auth0 文档](https://auth0.com/docs)
- [Google OAuth 文档](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth 文档](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Auth0 定价](https://auth0.com/pricing)