# 认证与积分模块化系统实现方案

## 📋 目录

1. [概述](#概述)
2. [架构设计](#架构设计)
3. [模块结构](#模块结构)
4. [数据库设计](#数据库设计)
5. [API设计](#api设计)
6. [中间件流程](#中间件流程)
7. [前端集成](#前端集成)
8. [实现步骤](#实现步骤)
9. [测试计划](#测试计划)

---

## 概述

### 目标

实现完全解耦的认证(Auth)和积分(Credits)系统，作为独立模块与现有角色创建业务代码协作。

### 核心原则

- ✅ **模块独立**：Auth和Credits各自独立，不依赖业务逻辑
- ✅ **零侵入**：业务代码只通过中间件和服务接口调用
- ✅ **无Mock数据**：所有操作必须真实调用API和数据库
- ✅ **事务安全**：积分扣除使用数据库事务保证原子性
- ✅ **可扩展**：易于添加OAuth、第三方支付等功能

---

## 架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │ login.html   │  │ app.html     │  │ credits-widget.js  │    │
│  │ auth.js      │  │ gallery.js   │  │ (全局积分显示)      │    │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬──────────┘    │
└─────────┼──────────────────┼────────────────────┼───────────────┘
          │                  │                    │
          │ JWT Token        │ Bearer Token       │ polling
          ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Express App (app.ts)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 全局中间件：                                                 │ │
│  │ - helmet()         安全头                                   │ │
│  │ - cors()           跨域处理                                 │ │
│  │ - express.json()   解析JSON                                │ │
│  │ - requestId        生成请求ID                               │ │
│  │ - responseTime     记录响应时间                             │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Routes Layer (routes/v1/)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  /api/v1/auth        → authRouter        (无需auth)        │ │
│  │  /api/v1/characters  → charactersRouter  (选择性auth)      │ │
│  │  /api/v1/credits     → creditsRouter     (需要auth)        │ │
│  │  /api/v1/users       → usersRouter       (需要auth)        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│              Middleware Layer (按需应用)                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │ authenticate()  │  │ checkCredits()  │  │ requireOwner() │ │
│  │ - 解析token     │  │ - 检查余额      │  │ - 验证归属     │ │
│  │ - 注入req.user  │  │ - 预扣积分      │  │                │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬───────┘ │
└───────────┼────────────────────┼────────────────────┼──────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Service Layer (业务逻辑)                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │ AuthService     │  │ CreditsService  │  │ CharacterServ  │ │
│  │ - login()       │  │ - deduct()      │  │ - create()     │ │
│  │ - register()    │  │ - refund()      │  │ - update()     │ │
│  │ - verifyToken() │  │ - getBalance()  │  │ - delete()     │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬───────┘ │
└───────────┼────────────────────┼────────────────────┼──────────┘
            │                    │                    │
            └────────────────────┼────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database Layer (Prisma)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  User          - 用户基本信息 + 积分余额                    │ │
│  │  Character     - 角色数据                                   │ │
│  │  CreditLog     - 积分变动历史                               │ │
│  │  Session       - 用户会话管理                               │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 模块结构

### 文件组织

```
apps/server/src/
├── modules/
│   ├── auth/                          # 🔐 认证模块（独立）
│   │   ├── auth.service.ts            # 业务逻辑：登录、注册、token验证
│   │   ├── auth.controller.ts         # HTTP控制器
│   │   ├── auth.middleware.ts         # 中间件：authenticate, requireAuth
│   │   ├── auth.routes.ts             # 路由定义
│   │   ├── auth.types.ts              # 类型定义
│   │   ├── auth.utils.ts              # 工具函数：hash password, generate token
│   │   └── __tests__/
│   │       ├── auth.service.test.ts
│   │       └── auth.middleware.test.ts
│   │
│   ├── credits/                       # 💰 积分模块（独立）
│   │   ├── credits.service.ts         # 业务逻辑：扣除、充值、查询
│   │   ├── credits.controller.ts      # HTTP控制器
│   │   ├── credits.middleware.ts      # 中间件：checkCredits, deductCredits
│   │   ├── credits.routes.ts          # 路由定义
│   │   ├── credits.types.ts           # 类型定义
│   │   └── __tests__/
│   │       ├── credits.service.test.ts
│   │       └── credits.middleware.test.ts
│   │
│   └── characters/                    # 🎨 业务模块（使用auth和credits）
│       ├── character.service.ts       # 依赖注入 CreditsService
│       ├── character.controller.ts
│       └── character.routes.ts        # 使用 authMiddleware 和 checkCredits
│
├── routes/
│   └── v1/
│       ├── index.ts                   # 挂载所有模块路由
│       ├── auth.ts                    # → modules/auth/auth.routes.ts
│       ├── credits.ts                 # → modules/credits/credits.routes.ts
│       └── characters.ts              # → modules/characters/character.routes.ts
│
├── middleware/
│   ├── auth.ts                        # 导出自 modules/auth/auth.middleware.ts
│   └── errorHandler.ts                # 全局错误处理（处理AuthError等）
│
└── app.ts                             # Express应用入口

public/
├── auth/                              # 🔐 前端认证模块
│   ├── login.html                     # 登录页面
│   ├── register.html                  # 注册页面
│   └── auth.js                        # 认证JS模块（全局window.AuthModule）
│
├── credits/                           # 💰 前端积分模块
│   ├── credits-widget.html            # 积分显示组件
│   └── credits.js                     # 积分JS模块（全局window.CreditsModule）
│
└── js/
    ├── gallery.js                     # 业务代码，调用 AuthModule 和 CreditsModule
    └── themes.js                      # 业务代码，调用 AuthModule 和 CreditsModule
```

---

## 数据库设计

### Prisma Schema 扩展

```prisma
// ==================== User模型扩展 ====================
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String   @map("password_hash")  // 新增：密码hash
  name          String?
  avatar        String?

  // 积分相关
  credits       Int      @default(10)           // 当前积分余额
  totalEarned   Int      @default(10) @map("total_earned")   // 累计获得
  totalSpent    Int      @default(0) @map("total_spent")     // 累计消费

  // 认证相关
  emailVerified Boolean  @default(false) @map("email_verified")
  isActive      Boolean  @default(true) @map("is_active")
  roles         String[] @default(["user"])     // 角色：user, admin

  // 时间戳
  lastLoginAt   DateTime? @map("last_login_at")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // 关系
  characters    Character[]
  sessions      Session[]
  creditLogs    CreditLog[]

  @@map("users")
}

// ==================== 用户会话表（新增） ====================
model Session {
  id           String   @id @default(cuid())
  userId       String   @map("user_id")
  token        String   @unique              // JWT token (hashed)
  refreshToken String?  @unique @map("refresh_token")
  ipAddress    String?  @map("ip_address")
  userAgent    String?  @map("user_agent")
  expiresAt    DateTime @map("expires_at")
  createdAt    DateTime @default(now()) @map("created_at")

  // 关系
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("sessions")
}

// ==================== 积分变动日志表（新增） ====================
model CreditLog {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  amount      Int                          // 正数=增加，负数=减少
  type        CreditType                   // PURCHASE, DEDUCT, REFUND, GIFT, ADMIN_ADJUST
  reason      String?                      // 原因描述

  // 关联信息
  relatedId   String?  @map("related_id")  // 关联的characterId/orderId等
  relatedType String?  @map("related_type") // character_creation, theme_variant等

  // 余额快照
  balanceBefore Int    @map("balance_before")
  balanceAfter  Int    @map("balance_after")

  // 元数据
  metadata    Json?                        // 额外信息
  createdAt   DateTime @default(now()) @map("created_at")

  // 关系
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([createdAt])
  @@index([type])
  @@map("credit_logs")
}

// ==================== 枚举类型 ====================
enum CreditType {
  PURCHASE          // 充值购买
  DEDUCT            // 消费扣除
  REFUND            // 退款
  GIFT              // 赠送（新用户、活动等）
  ADMIN_ADJUST      // 管理员调整
}
```

### 数据库迁移命令

```bash
# 生成迁移文件
npx prisma migrate dev --name add_auth_credits_system

# 应用迁移
npx prisma migrate deploy

# 生成Prisma客户端
npx prisma generate
```

---

## API设计

### 认证模块 API

#### POST /api/v1/auth/register
注册新用户

**请求体**：
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "credits": 10
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

#### POST /api/v1/auth/login
用户登录

**请求体**：
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "credits": 10
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

#### POST /api/v1/auth/logout
用户登出（需要认证）

**Headers**：
```
Authorization: Bearer {token}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

#### GET /api/v1/auth/me
获取当前用户信息（需要认证）

**Headers**：
```
Authorization: Bearer {token}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "credits": 10,
      "emailVerified": true,
      "roles": ["user"]
    }
  }
}
```

#### POST /api/v1/auth/refresh
刷新访问令牌

**请求体**：
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

---

### 积分模块 API

#### GET /api/v1/credits
获取当前用户积分余额（需要认证）

**Headers**：
```
Authorization: Bearer {token}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "balance": 25,
    "totalEarned": 50,
    "totalSpent": 25,
    "lastTransaction": {
      "id": "log_123",
      "amount": -5,
      "type": "DEDUCT",
      "reason": "character_creation",
      "createdAt": "2025-10-02T10:30:00Z"
    }
  }
}
```

#### GET /api/v1/credits/history
获取积分变动历史（需要认证）

**查询参数**：
- `page`: 页码（默认1）
- `limit`: 每页数量（默认20）
- `type`: 类型筛选（可选）

**响应**：
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "log_123",
        "amount": -5,
        "type": "DEDUCT",
        "reason": "character_creation",
        "balanceBefore": 30,
        "balanceAfter": 25,
        "relatedId": "char_456",
        "relatedType": "character_creation",
        "createdAt": "2025-10-02T10:30:00Z"
      },
      {
        "id": "log_122",
        "amount": 20,
        "type": "PURCHASE",
        "reason": "credit_pack_purchase",
        "balanceBefore": 10,
        "balanceAfter": 30,
        "createdAt": "2025-10-01T15:20:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 45,
      "itemsPerPage": 20
    }
  }
}
```

#### POST /api/v1/credits/purchase
购买积分（需要认证）

**请求体**：
```json
{
  "package": "basic",  // basic=100积分, premium=500积分, pro=1000积分
  "paymentMethod": "stripe",
  "paymentToken": "tok_visa"
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "orderId": "order_789",
    "credits": 100,
    "amount": 9.99,
    "currency": "USD",
    "newBalance": 125
  }
}
```

---

### 业务模块 API（使用中间件）

#### POST /api/v1/characters
创建角色（需要认证 + 积分）

**中间件链**：
```typescript
router.post('/',
  authMiddleware.required,  // 验证登录
  checkCredits(5),          // 检查积分
  deductCredits(5),         // 扣除积分
  characterController.create
);
```

**Headers**：
```
Authorization: Bearer {token}
```

**请求体**：
```json
{
  "name": "Hero",
  "description": "A brave warrior"
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "character": {
      "id": "char_456",
      "name": "Hero",
      "imageUrl": "https://...",
      "creditsUsed": 5
    },
    "credits": {
      "previous": 25,
      "current": 20,
      "spent": 5
    }
  }
}
```

**错误响应（积分不足）**：
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Insufficient credits",
    "statusCode": 402,
    "details": {
      "required": 5,
      "available": 2
    }
  }
}
```

---

## 中间件流程

### 认证中间件流程图

```
客户端请求
    │
    ▼
┌─────────────────────────────────────────┐
│ authenticate(req, res, next)             │
│                                          │
│ 1. 提取token                             │
│    - Authorization: Bearer {token}      │
│    - Cookie: session={token}            │
│    - Query: ?token={token} (仅开发环境)  │
│                                          │
│ 2. 验证token                             │
│    - jwt.verify(token, JWT_SECRET)      │
│    - 检查是否过期                         │
│    - 检查Session是否有效                  │
│                                          │
│ 3. 查询用户信息                          │
│    - prisma.user.findUnique()           │
│    - 检查用户是否被禁用                   │
│                                          │
│ 4. 注入到请求                             │
│    req.user = {                          │
│      id, email, name, credits, roles    │
│    }                                     │
│    req.auth = {                          │
│      isAuthenticated: true,              │
│      token, sessionId                    │
│    }                                     │
│                                          │
│ 5. 调用next()                            │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ requireAuth(req, res, next)              │
│                                          │
│ 检查 req.auth.isAuthenticated           │
│  - 是 → next()                          │
│  - 否 → throw AuthenticationError(401)  │
└─────────────────────────────────────────┘
    │
    ▼
业务逻辑处理器
```

### 积分中间件流程图

```
业务处理器（已通过认证）
    │
    ▼
┌─────────────────────────────────────────┐
│ checkCredits(cost)(req, res, next)       │
│                                          │
│ 1. 获取用户ID                            │
│    const userId = req.user.id           │
│                                          │
│ 2. 查询积分余额                          │
│    const user = await prisma.user       │
│      .findUnique({ where: { id } })     │
│                                          │
│ 3. 检查余额                              │
│    if (user.credits < cost) {           │
│      throw InsufficientCreditsError()   │
│    }                                     │
│                                          │
│ 4. 预扣积分（开启事务）                   │
│    req.creditsTransaction = {            │
│      userId, cost, startedAt            │
│    }                                     │
│                                          │
│ 5. 调用next()                            │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ deductCredits(cost)(req, res, next)      │
│                                          │
│ 1. 获取事务信息                          │
│    const tx = req.creditsTransaction    │
│                                          │
│ 2. 执行扣除（数据库事务）                 │
│    await prisma.$transaction([          │
│      // 扣除余额                         │
│      prisma.user.update({               │
│        data: { credits: { decrement } } │
│      }),                                 │
│      // 记录日志                         │
│      prisma.creditLog.create({...})     │
│    ])                                    │
│                                          │
│ 3. 注入积分信息到响应                     │
│    res.locals.creditsDeducted = cost    │
│                                          │
│ 4. 调用next()                            │
└─────────────────────────────────────────┘
    │
    ▼
业务逻辑（生成角色）
    │
    ├─ 成功 → 返回结果（积分已扣除）
    │
    └─ 失败 → 触发错误处理器
              │
              ▼
        ┌────────────────────────────┐
        │ 错误处理中间件              │
        │                            │
        │ 检查是否有未完成的积分事务  │
        │ if (req.creditsTransaction) │
        │   → 执行退款               │
        │   await creditsService     │
        │     .refund(userId, cost)  │
        └────────────────────────────┘
```

---

## 前端集成

### 前端模块结构

#### 1. AuthModule (public/auth/auth.js)

```javascript
/**
 * 认证模块 - 全局单例
 * 负责登录、登出、token管理
 */
class AuthModule {
  constructor() {
    this.token = localStorage.getItem('auth_token');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
  }

  // 登录
  async login(email, password) {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error.message);
    }

    const { data } = await res.json();
    this.setAuth(data.token, data.user);

    // 触发全局登录事件
    window.dispatchEvent(new CustomEvent('auth:login', { detail: data.user }));

    return data.user;
  }

  // 注册
  async register(email, password, name) {
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error.message);
    }

    const { data } = await res.json();
    this.setAuth(data.token, data.user);

    window.dispatchEvent(new CustomEvent('auth:register', { detail: data.user }));

    return data.user;
  }

  // 登出
  async logout() {
    if (this.token) {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
    }

    this.clearAuth();
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  // 获取当前用户
  async getCurrentUser() {
    if (!this.token) return null;

    const res = await fetch('/api/v1/auth/me', {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });

    if (!res.ok) {
      this.clearAuth();
      return null;
    }

    const { data } = await res.json();
    this.user = data.user;
    localStorage.setItem('user', JSON.stringify(this.user));

    return this.user;
  }

  // 检查是否登录
  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  // 获取token
  getToken() {
    return this.token;
  }

  // 获取请求头
  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  // 设置认证信息
  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }

  // 清除认证信息
  clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }
}

// 全局单例
window.AuthModule = new AuthModule();
```

#### 2. CreditsModule (public/credits/credits.js)

```javascript
/**
 * 积分模块 - 全局单例
 * 负责积分查询、显示、刷新
 */
class CreditsModule {
  constructor() {
    this.balance = 0;
    this.listeners = [];
    this.pollingInterval = null;
  }

  // 获取积分余额
  async getBalance() {
    const token = window.AuthModule.getToken();
    if (!token) return null;

    const res = await fetch('/api/v1/credits', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) return null;

    const { data } = await res.json();
    this.balance = data.balance;

    // 通知所有监听器
    this.notifyListeners(data);

    return data;
  }

  // 获取积分历史
  async getHistory(page = 1, limit = 20) {
    const token = window.AuthModule.getToken();
    if (!token) return null;

    const res = await fetch(`/api/v1/credits/history?page=${page}&limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) return null;

    const { data } = await res.json();
    return data;
  }

  // 开始轮询积分
  startPolling(interval = 30000) {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // 立即获取一次
    this.getBalance();

    // 定时获取
    this.pollingInterval = setInterval(() => {
      this.getBalance();
    }, interval);
  }

  // 停止轮询
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // 添加监听器
  onBalanceChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // 通知监听器
  notifyListeners(data) {
    this.listeners.forEach(callback => callback(data));
  }

  // 显示积分不足提示
  showInsufficientCreditsError(required, available) {
    alert(`积分不足！需要 ${required} 积分，当前只有 ${available} 积分`);
  }
}

// 全局单例
window.CreditsModule = new CreditsModule();

// 监听登录事件，开始轮询
window.addEventListener('auth:login', () => {
  window.CreditsModule.startPolling();
});

// 监听登出事件，停止轮询
window.addEventListener('auth:logout', () => {
  window.CreditsModule.stopPolling();
});
```

#### 3. 业务代码集成 (public/js/gallery.js)

```javascript
/**
 * 业务代码示例：创建角色
 */
async function createCharacter(characterData) {
  // 1. 检查登录状态
  if (!window.AuthModule.isAuthenticated()) {
    alert('请先登录');
    window.location.href = '/auth/login.html';
    return;
  }

  // 2. 检查积分（可选，后端也会检查）
  const credits = await window.CreditsModule.getBalance();
  if (credits.balance < 5) {
    window.CreditsModule.showInsufficientCreditsError(5, credits.balance);
    return;
  }

  // 3. 调用API创建角色
  try {
    const res = await fetch('/api/v1/characters', {
      method: 'POST',
      headers: window.AuthModule.getAuthHeaders(),
      body: JSON.stringify(characterData)
    });

    if (!res.ok) {
      const error = await res.json();

      // 处理积分不足错误
      if (error.error.code === 'INSUFFICIENT_CREDITS') {
        window.CreditsModule.showInsufficientCreditsError(
          error.error.details.required,
          error.error.details.available
        );
        return;
      }

      throw new Error(error.error.message);
    }

    const { data } = await res.json();

    // 4. 刷新积分显示
    await window.CreditsModule.getBalance();

    // 5. 显示成功消息
    alert('角色创建成功！消耗 5 积分');

    return data.character;

  } catch (error) {
    console.error('创建角色失败:', error);
    alert('创建失败: ' + error.message);
  }
}

// 页面加载时初始化
window.addEventListener('load', async () => {
  // 检查登录状态
  if (window.AuthModule.isAuthenticated()) {
    // 获取用户信息
    await window.AuthModule.getCurrentUser();

    // 开始积分轮询
    window.CreditsModule.startPolling();

    // 显示用户信息
    updateUserUI();
  }
});
```

---

## 实现步骤

### Phase 1: 数据库和基础设施（1-2天）

#### 1.1 更新Prisma Schema
- [ ] 扩展User模型（passwordHash, credits字段）
- [ ] 创建Session模型
- [ ] 创建CreditLog模型
- [ ] 添加CreditType枚举

#### 1.2 数据库迁移
```bash
npx prisma migrate dev --name add_auth_credits_system
npx prisma generate
```

#### 1.3 环境配置
```bash
# .env
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d
INITIAL_CREDITS=10
```

---

### Phase 2: Auth模块实现（2-3天）

#### 2.1 创建Auth工具函数
**文件**: `apps/server/src/modules/auth/auth.utils.ts`

功能：
- [ ] hashPassword() - 使用bcrypt加密密码
- [ ] comparePassword() - 验证密码
- [ ] generateToken() - 生成JWT token
- [ ] verifyToken() - 验证JWT token
- [ ] generateRefreshToken() - 生成刷新token

#### 2.2 实现AuthService
**文件**: `apps/server/src/modules/auth/auth.service.ts`

功能：
- [ ] register() - 注册用户
- [ ] login() - 登录
- [ ] logout() - 登出
- [ ] verifyToken() - 验证token
- [ ] refreshToken() - 刷新token
- [ ] getUserById() - 获取用户信息

#### 2.3 实现Auth中间件
**文件**: `apps/server/src/modules/auth/auth.middleware.ts`

功能：
- [ ] authenticate() - 解析token并注入user
- [ ] requireAuth() - 要求已登录
- [ ] requireRole() - 要求特定角色
- [ ] requireOwnership() - 要求资源所有权

#### 2.4 实现Auth路由
**文件**: `apps/server/src/modules/auth/auth.routes.ts`

端点：
- [ ] POST /register
- [ ] POST /login
- [ ] POST /logout
- [ ] GET /me
- [ ] POST /refresh

#### 2.5 编写测试
**文件**: `apps/server/src/modules/auth/__tests__/`

测试：
- [ ] auth.service.test.ts - 服务层测试
- [ ] auth.middleware.test.ts - 中间件测试
- [ ] auth.integration.test.ts - 集成测试

---

### Phase 3: Credits模块实现（2-3天）

#### 3.1 实现CreditsService
**文件**: `apps/server/src/modules/credits/credits.service.ts`

功能：
- [ ] getBalance() - 获取余额
- [ ] deduct() - 扣除积分（带事务）
- [ ] refund() - 退款（带事务）
- [ ] add() - 增加积分
- [ ] getHistory() - 获取变动历史
- [ ] checkSufficient() - 检查余额是否足够

#### 3.2 实现Credits中间件
**文件**: `apps/server/src/modules/credits/credits.middleware.ts`

功能：
- [ ] checkCredits(cost) - 检查积分余额
- [ ] deductCredits(cost) - 扣除积分
- [ ] refundOnError() - 错误时自动退款

#### 3.3 实现Credits路由
**文件**: `apps/server/src/modules/credits/credits.routes.ts`

端点：
- [ ] GET / - 获取余额
- [ ] GET /history - 获取历史
- [ ] POST /purchase - 购买积分（预留接口）

#### 3.4 编写测试
**文件**: `apps/server/src/modules/credits/__tests__/`

测试：
- [ ] credits.service.test.ts - 服务层测试
- [ ] credits.middleware.test.ts - 中间件测试
- [ ] credits.transaction.test.ts - 事务测试

---

### Phase 4: 业务模块集成（1-2天）

#### 4.1 更新Characters路由
**文件**: `apps/server/src/routes/v1/characters.ts`

改动：
- [ ] 导入authMiddleware和creditsMiddleware
- [ ] 为需要的路由添加中间件
- [ ] 更新错误处理

示例：
```typescript
import { authMiddleware } from '../../modules/auth/auth.middleware';
import { checkCredits, deductCredits } from '../../modules/credits/credits.middleware';

// 创建角色（需要认证+积分）
router.post('/',
  authMiddleware.required,
  checkCredits(5),
  deductCredits(5, 'character_creation'),
  characterController.create
);

// 删除角色（需要认证+所有权）
router.delete('/:id',
  authMiddleware.required,
  requireOwnership('id'),
  characterController.delete
);
```

#### 4.2 更新CharacterService
**文件**: `apps/server/src/modules/characters/character.service.ts`

改动：
- [ ] 注入CreditsService
- [ ] 在失败时调用refund
- [ ] 记录积分变动

#### 4.3 更新其他业务路由
- [ ] themes.ts - 添加中间件
- [ ] scenes.ts - 添加中间件
- [ ] collections.ts - 添加中间件

---

### Phase 5: 前端实现（2-3天）

#### 5.1 创建AuthModule
**文件**: `public/auth/auth.js`

功能：
- [ ] login()
- [ ] register()
- [ ] logout()
- [ ] getCurrentUser()
- [ ] isAuthenticated()
- [ ] getAuthHeaders()

#### 5.2 创建登录/注册页面
**文件**: `public/auth/login.html`, `public/auth/register.html`

功能：
- [ ] 登录表单
- [ ] 注册表单
- [ ] 表单验证
- [ ] 错误提示
- [ ] 成功后跳转

#### 5.3 创建CreditsModule
**文件**: `public/credits/credits.js`

功能：
- [ ] getBalance()
- [ ] getHistory()
- [ ] startPolling()
- [ ] onBalanceChange()
- [ ] showInsufficientCreditsError()

#### 5.4 创建积分显示组件
**文件**: `public/credits/credits-widget.html`

功能：
- [ ] 显示当前积分
- [ ] 实时更新
- [ ] 点击查看历史
- [ ] 充值按钮

#### 5.5 集成到业务页面
**文件**: `public/js/gallery.js`, `public/js/themes.js`

改动：
- [ ] 使用AuthModule获取token
- [ ] 使用CreditsModule显示积分
- [ ] 添加积分不足处理
- [ ] 添加未登录跳转

---

### Phase 6: 测试和文档（1-2天）

#### 6.1 单元测试
```bash
npm test -- auth
npm test -- credits
```

#### 6.2 集成测试
```bash
npm test -- integration
```

#### 6.3 E2E测试（手动）
- [ ] 注册流程
- [ ] 登录流程
- [ ] 创建角色（积分扣除）
- [ ] 积分不足错误
- [ ] 操作失败退款
- [ ] 登出流程

#### 6.4 更新API文档
**文件**: `API_DOCUMENTATION.md`

添加：
- [ ] Auth API endpoints
- [ ] Credits API endpoints
- [ ] 中间件使用说明
- [ ] 错误代码说明

---

## 测试计划

### 单元测试

#### Auth模块测试
```typescript
// auth.service.test.ts
describe('AuthService', () => {
  test('should register new user with hashed password', async () => {
    const user = await authService.register({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User'
    });

    expect(user.id).toBeDefined();
    expect(user.credits).toBe(10);
    expect(user.passwordHash).not.toBe('password123');
  });

  test('should not allow duplicate email', async () => {
    await expect(authService.register({
      email: 'test@example.com',
      password: 'password123'
    })).rejects.toThrow('Email already exists');
  });

  test('should login with correct credentials', async () => {
    const result = await authService.login('test@example.com', 'password123');

    expect(result.token).toBeDefined();
    expect(result.user.email).toBe('test@example.com');
  });

  test('should reject invalid credentials', async () => {
    await expect(
      authService.login('test@example.com', 'wrongpassword')
    ).rejects.toThrow('Invalid credentials');
  });
});
```

#### Credits模块测试
```typescript
// credits.service.test.ts
describe('CreditsService', () => {
  test('should deduct credits with transaction', async () => {
    const user = await createTestUser({ credits: 10 });

    const result = await creditsService.deduct(user.id, 5, {
      type: 'DEDUCT',
      reason: 'character_creation',
      relatedId: 'char_123'
    });

    expect(result.balanceAfter).toBe(5);

    // 验证日志
    const logs = await prisma.creditLog.findMany({
      where: { userId: user.id }
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].amount).toBe(-5);
  });

  test('should reject deduction if insufficient credits', async () => {
    const user = await createTestUser({ credits: 3 });

    await expect(
      creditsService.deduct(user.id, 5, { type: 'DEDUCT' })
    ).rejects.toThrow('Insufficient credits');
  });

  test('should refund credits on error', async () => {
    const user = await createTestUser({ credits: 10 });

    await creditsService.deduct(user.id, 5, { type: 'DEDUCT' });
    await creditsService.refund(user.id, 5, 'operation_failed');

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id }
    });
    expect(updatedUser.credits).toBe(10);
  });
});
```

### 集成测试

```typescript
// character-creation.integration.test.ts
describe('Character Creation with Credits', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // 注册并登录
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

    authToken = registerRes.body.data.token;
    userId = registerRes.body.data.user.id;
  });

  test('should create character and deduct credits', async () => {
    const res = await request(app)
      .post('/api/v1/characters')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Hero',
        description: 'A brave warrior'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.credits.current).toBe(5); // 10 - 5

    // 验证数据库
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user.credits).toBe(5);
  });

  test('should reject creation if insufficient credits', async () => {
    // 先消耗掉剩余积分
    await prisma.user.update({
      where: { id: userId },
      data: { credits: 2 }
    });

    const res = await request(app)
      .post('/api/v1/characters')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Hero2',
        description: 'Another warrior'
      });

    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('INSUFFICIENT_CREDITS');
  });

  test('should refund credits if character creation fails', async () => {
    // Mock失败场景
    jest.spyOn(geminiService, 'generateImage').mockRejectedValue(
      new Error('Generation failed')
    );

    const initialCredits = 10;
    await prisma.user.update({
      where: { id: userId },
      data: { credits: initialCredits }
    });

    const res = await request(app)
      .post('/api/v1/characters')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Hero3',
        description: 'Failed warrior'
      });

    expect(res.status).toBe(500);

    // 验证积分已退回
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user.credits).toBe(initialCredits);
  });
});
```

---

## 安全考虑

### 1. 密码安全
- 使用bcrypt加密，salt rounds ≥ 10
- 密码强度验证（最少8位，包含字母数字）
- 密码重置功能（通过邮件）

### 2. Token安全
- JWT使用强密钥（至少32字符）
- Token过期时间：access token 24小时，refresh token 7天
- 生产环境必须使用HTTPS
- 实现token刷新机制

### 3. 积分安全
- 所有积分操作使用数据库事务
- 记录完整的积分变动日志
- 防止并发扣除（使用数据库锁）
- 管理员操作需要额外审计日志

### 4. API安全
- 全局rate limiting
- 用户级别rate limiting
- SQL注入防护（Prisma自动处理）
- XSS防护（helmet中间件）

---

## 性能优化

### 1. 数据库索引
```prisma
// User表
@@index([email])
@@index([createdAt])

// Session表
@@index([userId])
@@index([expiresAt])

// CreditLog表
@@index([userId])
@@index([createdAt])
@@index([type])
```

### 2. 缓存策略
- 用户信息缓存（Redis，TTL 5分钟）
- Session缓存（Redis）
- 积分余额缓存（谨慎使用，需确保一致性）

### 3. 查询优化
- 使用select减少返回字段
- 批量查询时使用分页
- 积分历史查询添加时间范围过滤

---

## 错误代码定义

```typescript
export const ERROR_CODES = {
  // 认证相关 (401)
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',

  // 授权相关 (403)
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_FORBIDDEN: 'RESOURCE_FORBIDDEN',

  // 积分相关 (402)
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  INVALID_CREDIT_AMOUNT: 'INVALID_CREDIT_AMOUNT',

  // 其他
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};
```

---

## 后续扩展

### Phase 7: 高级功能（可选）

1. **OAuth集成**
   - Google登录
   - GitHub登录
   - 微信登录

2. **积分购买**
   - Stripe支付集成
   - 积分套餐管理
   - 订单系统

3. **会员系统**
   - 免费/付费会员
   - 会员专属功能
   - 积分返还规则

4. **邮件功能**
   - 注册验证邮件
   - 密码重置邮件
   - 积分变动通知

5. **管理后台**
   - 用户管理
   - 积分管理
   - 操作日志查询

---

## 总结

本方案实现了：
- ✅ 完全独立的Auth和Credits模块
- ✅ 通过中间件与业务代码解耦
- ✅ 基于Prisma的事务安全
- ✅ 前后端完整集成
- ✅ 完善的测试覆盖
- ✅ 可扩展的架构设计

预计总开发时间：**10-15天**
