# 积分系统使用示例

## 在现有API中集成积分检查

### 1. 角色生成API (需要10积分)

```typescript
// src/routes/v1/characters.ts
import { requireCredits } from '../../middleware/creditCheck';

// 在生成角色的API中添加积分检查
router.post('/generate', 
  requireAuth(),           // 需要登录
  requireCredits(),        // 自动从数据库读取积分配置
  async (req: Request, res: Response) => {
    try {
      // 执行角色生成逻辑
      const character = await generateCharacter(req.body);
      
      res.json({
        success: true,
        data: character,
        meta: {
          creditsUsed: req.creditCost,  // 显示消耗的积分
          transaction: req.creditTransaction.id
        }
      });
    } catch (error) {
      // 如果生成失败，积分会自动退还（需要添加错误处理中间件）
      res.status(500).json({ error: 'Generation failed' });
    }
  }
);
```

### 2. 图像生成API (需要15积分)

```typescript
// 高成本的图像生成API
router.post('/generate-image',
  requireAuth(),
  requireCredits(),  // 数据库中配置为15积分
  async (req: Request, res: Response) => {
    // 图像生成逻辑
  }
);

// 或者固定积分版本
router.post('/premium-generate',
  requireAuth(),
  requireCredits(25),  // 固定25积分
  async (req: Request, res: Response) => {
    // 高级生成逻辑
  }
);
```

### 3. 带积分退还的错误处理

```typescript
import { refundCreditsOnError } from '../../middleware/creditCheck';

router.post('/risky-operation',
  requireAuth(),
  requireCredits(20),
  async (req: Request, res: Response) => {
    try {
      const result = await riskyOperation(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      // 如果操作失败，通过错误中间件退还积分
      throw error;
    }
  },
  refundCreditsOnError()  // 错误时自动退还积分
);
```

## 前端集成示例

### 1. 检查用户积分状态

```javascript
// 获取用户积分状态
async function getCreditStatus() {
  const response = await fetch('/api/v1/credits/status', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    updateCreditDisplay(data.data.remainingCredits);
  }
}

// 更新页面显示
function updateCreditDisplay(credits) {
  document.getElementById('credit-count').textContent = credits;
  
  // 如果积分不足，禁用某些按钮
  if (credits < 10) {
    document.getElementById('generate-btn').disabled = true;
    document.getElementById('generate-btn').textContent = '积分不足';
  }
}
```

### 2. 在操作前检查积分

```javascript
async function beforeExpensiveOperation(requiredCredits) {
  try {
    const response = await fetch('/api/v1/credits/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ credits: requiredCredits })
    });
    
    const result = await response.json();
    
    if (!result.data.canProceed) {
      showInsufficientCreditsModal(result.data);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('积分检查失败:', error);
    return false;
  }
}

// 使用示例
async function generateCharacter() {
  const canProceed = await beforeExpensiveOperation(10);
  
  if (!canProceed) {
    return;
  }
  
  // 执行实际的生成操作
  const response = await fetch('/api/v1/characters/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(characterData)
  });
  
  // 处理响应
  if (response.status === 402) {
    // 积分不足
    const error = await response.json();
    showInsufficientCreditsError(error);
  } else if (response.ok) {
    // 成功，更新积分显示
    getCreditStatus();
  }
}
```

### 3. 积分不足处理

```javascript
function showInsufficientCreditsModal(creditInfo) {
  const modal = document.getElementById('insufficient-credits-modal');
  document.getElementById('current-credits').textContent = creditInfo.currentCredits;
  document.getElementById('required-credits').textContent = creditInfo.requiredCredits;
  document.getElementById('needed-credits').textContent = 
    creditInfo.requiredCredits - creditInfo.currentCredits;
  
  modal.style.display = 'block';
}

function showCreditHistory() {
  fetch('/api/v1/credits/history?limit=20', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      renderCreditHistory(data.data.transactions);
    }
  });
}

function renderCreditHistory(transactions) {
  const container = document.getElementById('credit-history');
  container.innerHTML = transactions.map(tx => `
    <div class="credit-transaction">
      <div class="api-endpoint">${tx.apiEndpoint}</div>
      <div class="credit-cost">-${tx.creditCost} 积分</div>
      <div class="timestamp">${new Date(tx.createdAt).toLocaleString()}</div>
      <div class="description">${tx.description}</div>
    </div>
  `).join('');
}
```

## React组件示例

### 1. 积分状态组件

```jsx
import React, { useState, useEffect } from 'react';

const CreditStatus = () => {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreditStatus();
  }, []);

  const fetchCreditStatus = async () => {
    try {
      const response = await fetch('/api/v1/credits/status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCredits(data.data);
      }
    } catch (error) {
      console.error('获取积分状态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>加载中...</div>;

  return (
    <div className="credit-status">
      <div className="credit-display">
        <span className="credit-count">{credits?.remainingCredits || 0}</span>
        <span className="credit-label">剩余积分</span>
      </div>
      <div className="credit-info">
        <div>今日已用: {credits?.usedCredits || 0}</div>
        <div>今日总额: {credits?.dailyCredits || 100}</div>
      </div>
      <button onClick={fetchCreditStatus}>刷新</button>
    </div>
  );
};
```

### 2. 需要积分的操作组件

```jsx
const GenerateCharacterButton = ({ requiredCredits = 10, onGenerate }) => {
  const [credits, setCredits] = useState(null);
  const [checking, setChecking] = useState(false);

  const checkAndGenerate = async () => {
    setChecking(true);
    
    try {
      // 检查积分
      const checkResponse = await fetch('/api/v1/credits/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ credits: requiredCredits })
      });
      
      const checkResult = await checkResponse.json();
      
      if (!checkResult.data.canProceed) {
        alert(`积分不足！需要 ${requiredCredits} 积分，当前仅有 ${checkResult.data.currentCredits} 积分`);
        return;
      }
      
      // 执行生成
      await onGenerate();
      
    } catch (error) {
      console.error('操作失败:', error);
    } finally {
      setChecking(false);
    }
  };

  return (
    <button 
      onClick={checkAndGenerate}
      disabled={checking}
      className="generate-button"
    >
      {checking ? '处理中...' : `生成角色 (${requiredCredits} 积分)`}
    </button>
  );
};
```

## 管理员界面示例

### 1. API积分配置管理

```jsx
const ApiCreditConfig = () => {
  const [configs, setConfigs] = useState([]);
  const [newConfig, setNewConfig] = useState({
    endpoint: '',
    method: 'POST',
    creditCost: 0,
    description: '',
    isEnabled: true
  });

  const fetchConfigs = async () => {
    const response = await fetch('/api/v1/credits/config', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await response.json();
    if (data.success) setConfigs(data.data);
  };

  const saveConfig = async () => {
    const response = await fetch('/api/v1/credits/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(newConfig)
    });
    
    if (response.ok) {
      fetchConfigs();
      setNewConfig({ endpoint: '', method: 'POST', creditCost: 0, description: '', isEnabled: true });
    }
  };

  return (
    <div className="credit-config-panel">
      <h2>API积分配置</h2>
      
      {/* 新增配置表单 */}
      <div className="config-form">
        <input
          value={newConfig.endpoint}
          onChange={e => setNewConfig({...newConfig, endpoint: e.target.value})}
          placeholder="API端点"
        />
        <select
          value={newConfig.method}
          onChange={e => setNewConfig({...newConfig, method: e.target.value})}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
        <input
          type="number"
          value={newConfig.creditCost}
          onChange={e => setNewConfig({...newConfig, creditCost: parseInt(e.target.value)})}
          placeholder="积分消耗"
        />
        <input
          value={newConfig.description}
          onChange={e => setNewConfig({...newConfig, description: e.target.value})}
          placeholder="描述"
        />
        <button onClick={saveConfig}>保存配置</button>
      </div>

      {/* 配置列表 */}
      <div className="config-list">
        {configs.map(config => (
          <div key={config.id} className="config-item">
            <span>{config.endpoint} ({config.method})</span>
            <span>{config.creditCost} 积分</span>
            <span>{config.isEnabled ? '启用' : '禁用'}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 2. 用户积分管理

```jsx
const UserCreditManagement = () => {
  const [userId, setUserId] = useState('');
  const [grantAmount, setGrantAmount] = useState(0);
  const [userCredits, setUserCredits] = useState(null);

  const grantCredits = async () => {
    const response = await fetch('/api/v1/credits/grant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        userId,
        credits: grantAmount,
        description: '管理员手动发放'
      })
    });
    
    if (response.ok) {
      alert('积分发放成功！');
      setGrantAmount(0);
    }
  };

  return (
    <div className="user-credit-management">
      <h2>用户积分管理</h2>
      
      <div className="grant-credits">
        <input
          value={userId}
          onChange={e => setUserId(e.target.value)}
          placeholder="用户ID"
        />
        <input
          type="number"
          value={grantAmount}
          onChange={e => setGrantAmount(parseInt(e.target.value))}
          placeholder="发放积分数量"
        />
        <button onClick={grantCredits}>发放积分</button>
      </div>
    </div>
  );
};
```

这些示例展示了如何在实际应用中集成和使用积分系统，包括前端检查、后端验证、错误处理和管理员功能。