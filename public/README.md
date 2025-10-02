# Public Frontend Files

## 文件结构

```
public/
├── css/
│   └── app.css          # 所有应用样式
├── js/
│   ├── common.js        # 全局状态、认证、工具函数
│   ├── gallery.js       # Character Gallery 页面
│   ├── creation.js      # Character Creation 页面
│   ├── editing.js       # Character Editing 页面
│   └── themes.js        # 主题管理
├── app.html             # 主应用页面
├── index.html           # 首页
├── login.html           # 登录页
└── register.html        # 注册页
```

## JavaScript 模块说明

### common.js (6KB)
- 全局状态管理（characters, currentUser, API_BASE）
- 用户认证（checkAuth, getAuthToken）
- 页面导航（switchPage）
- 通用工具（showNotification, logout）
- 应用初始化

### gallery.js (15KB)
- Character Gallery 页面功能
- 角色列表展示（updateCharacterGallery）
- 角色详情查看（viewCharacterDetail）
- 角色删除（deleteCharacter）

### creation.js (21KB)
- Character Creation 工作流
- 提示词优化（generateCharacter）
- 图像生成（generateWithOptimizedPrompt）
- 角色预览和保存（saveCharacter）
- 提示词修改功能

### editing.js (23KB)
- Character Editing 功能
- 角色变体生成（generateCharacterVariant）
- 主题选择和管理
- 变体展示网格
- Edit页面初始化（loadEditCharacters）

### themes.js (31KB)
- 主题CRUD操作
- 变体管理
- Theme API调用
- Gallery页面主题展示

## 加载顺序

模块按照依赖关系加载：

1. **common.js** - 提供全局状态和工具函数
2. **themes.js** - 主题管理功能
3. **gallery.js** - 使用common和themes
4. **creation.js** - 使用common
5. **editing.js** - 使用common和themes

## 开发建议

- 修改特定功能时，只需编辑对应的模块文件
- 全局功能修改在common.js中进行
- 所有模块共享全局变量（characters, currentUser, API_BASE）
- 使用浏览器开发工具时，模块名称清晰便于调试
