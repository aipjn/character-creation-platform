# 用户积分管理系统

## 概述

本系统实现了完整的用户积分管理机制，包括：
- 每日积分分配（每天100积分）
- API调用积分检查和扣除  
- 积分使用记录追踪
- 管理员积分配置和管理
- 自动重置机制

## 系统架构

### 数据库表结构
- **user_credits**: 用户积分状态表
- **credit_transactions**: 积分交易记录表  
- **api_credit_configs**: API积分配置表

### 核心组件
- **CreditService**: 积分管理服务
- **creditCheck middleware**: 积分检查中间件
- **credits routes**: 积分管理API

## 使用方法

### 1. 在API路由中使用积分检查

```typescript
import { requireCredits } from '../middleware/creditCheck';

// 方式1: 自动根据数据库配置检查积分
router.post('/generate-character', requireAuth(), requireCredits(), async (req, res) => {
  // API逻辑
  // 积分会自动根据数据库配置扣除
});

// 方式2: 固定积分消耗
router.post('/premium-feature', requireAuth(), requireCredits(20), async (req, res) => {
  // 固定消耗20积分
});

// 方式3: 添加积分状态到响应（不扣除）
router.get('/profile', requireAuth(), checkCreditStatus(), async (req, res) => {
  res.json({
    user: req.user,
    credits: req.user.credits // 积分信息会自动附加
  });
});
```

### 2. 积分配置管理

```typescript
// 创建或更新API积分配置
await CreditService.upsertApiCreditConfig({
  endpoint: '/api/v1/generate-character',
  method: 'POST',
  creditCost: 10,
  description: '生成角色',
  isEnabled: true
});

// 获取API配置
const config = await CreditService.getApiCreditConfig('/api/v1/generate-character', 'POST');
```

### 3. 手动积分操作

```typescript
// 检查积分（不扣除）
const checkResult = await CreditService.checkCredits(userId, 50);
if (!checkResult.canProceed) {
  throw new Error('积分不足');
}

// 扣除积分
const transaction = await CreditService.consumeCredits(
  userId, 
  '/api/custom', 
  10,
  { requestData: 'optional' }
);

// 管理员授予积分
await CreditService.grantCredits(userId, 100, '活动奖励');

// 获取用户积分状态
const userCredits = await CreditService.getUserCredits(userId);

// 获取积分历史
const history = await CreditService.getCreditHistory(userId, 20, 0);
```

## API接口

### 用户接口

#### GET /api/v1/credits/status
获取当前用户积分状态

**响应:**
```json
{
  "success": true,
  "data": {
    "dailyCredits": 100,
    "usedCredits": 25,
    "remainingCredits": 75,
    "lastResetDate": "2025-09-14T08:00:00Z",
    "totalCreditsEarned": 300,
    "totalCreditsSpent": 225
  }
}
```

#### GET /api/v1/credits/history
获取积分使用历史

**查询参数:**
- `limit`: 每页数量 (默认20)
- `offset`: 偏移量 (默认0)

**响应:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "trans-123",
        "apiEndpoint": "/api/v1/generate-character",
        "creditCost": 10,
        "operationType": "api_call",
        "description": "API call to /api/v1/generate-character",
        "createdAt": "2025-09-14T10:30:00Z"
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 1
    }
  }
}
```

#### POST /api/v1/credits/check
检查指定积分是否足够

**请求体:**
```json
{
  "credits": 50
}
```

### 管理员接口

#### GET /api/v1/credits/config
获取所有API积分配置

#### POST /api/v1/credits/config
创建或更新API积分配置

**请求体:**
```json
{
  "endpoint": "/api/v1/new-feature",
  "method": "POST",
  "creditCost": 15,
  "description": "新功能",
  "isEnabled": true
}
```

#### POST /api/v1/credits/grant
给用户授予积分

**请求体:**
```json
{
  "userId": "user-123",
  "credits": 50,
  "description": "活动奖励"
}
```

#### GET /api/v1/credits/user/:userId/status
获取指定用户积分状态

#### GET /api/v1/credits/user/:userId/history
获取指定用户积分历史

## 错误处理

### 积分不足错误 (402)
```json
{
  "success": false,
  "error": "Insufficient credits. Required: 20, Available: 15",
  "code": "INSUFFICIENT_CREDITS",
  "data": {
    "currentCredits": 15,
    "requiredCredits": 20
  }
}
```

### 认证错误 (401)
```json
{
  "success": false,
  "error": "Authentication required",
  "code": "AUTH_REQUIRED"
}
```

### 权限错误 (403)
```json
{
  "success": false,
  "error": "Admin privileges required",
  "code": "ADMIN_REQUIRED"
}
```

## 积分规则

### 每日重置
- 每天中国时区00:00自动重置积分
- 默认每日100积分
- 未使用积分不累积到下一天

### 积分消耗
- API调用前自动检查并扣除积分
- 失败的API调用可以退还积分（需要在错误处理中实现）
- 所有积分操作都会记录到交易表

### 管理员操作
- 可以给用户增加积分
- 可以配置API积分消耗
- 可以查看所有用户积分状态

## 数据库迁移

运行积分系统迁移：
```bash
node src/migrations/migrationRunner.js
```

这将创建必要的数据库表并插入默认的API积分配置。

## 默认API积分配置

- `/api/v1/generate-character` (POST): 10积分
- `/api/v1/generate-image` (POST): 15积分  
- `/api/v1/characters` (POST): 5积分
- `/api/v1/characters/:id/enhance` (POST): 8积分
- `/api/v1/collections` (POST): 3积分

## 测试

运行积分系统测试：
```bash
npm test -- creditSystem.test.ts
```

## 监控和分析

### 重要指标
- 每日积分使用量
- 用户积分不足频率
- 热门API调用（按积分消耗）
- 用户活跃度（基于积分使用）

### 日志记录
系统会自动记录：
- 所有积分交易
- 积分检查失败
- 每日重置操作
- 管理员操作

## 扩展功能

### 可能的扩展
1. **积分包购买**: 允许用户购买额外积分
2. **VIP会员**: 不同等级用户有不同积分配额
3. **积分奖励**: 完成任务获得额外积分
4. **积分有效期**: 设置积分过期机制
5. **API优先级**: 高优先级API消耗更多积分

### 性能优化
1. **缓存用户积分**: Redis缓存当前积分状态
2. **批量操作**: 批量处理积分重置
3. **异步记录**: 异步写入交易记录