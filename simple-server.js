const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// 基本中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 创建上传目录
const uploadsPath = path.join(__dirname, 'uploads');
const subDirs = ['characters', 'thumbnails', 'temp', 'exports'];
subDirs.forEach(dir => {
  const dirPath = path.join(uploadsPath, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// 静态文件服务
app.use('/uploads', express.static(uploadsPath));

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: 'development',
    features: {
      nanoBananaAPI: process.env.NANOBANANA_API_KEY ? 'enabled' : 'disabled',
      localStorage: 'enabled',
      database: 'disabled (development mode)'
    }
  });
});

// API根路径
app.get('/api/v1', (req, res) => {
  res.json({
    message: 'Character Creation Platform API v1',
    version: '1.0.0',
    status: 'running',
    features: {
      characterGeneration: true,
      fileUpload: true,
      localStorage: true,
      nanoBananaIntegration: !!process.env.NANOBANANA_API_KEY
    },
    endpoints: {
      health: '/health',
      users: '/api/v1/users',
      characters: '/api/v1/characters',
      generate: '/api/v1/characters/generate'
    }
  });
});

// 用户API
app.get('/api/v1/users', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        email: 'demo@example.com',
        name: 'Demo User',
        subscriptionTier: 'FREE',
        dailyQuota: 3,
        dailyUsed: 0,
        totalGenerated: 5
      }
    ],
    message: 'Users endpoint ready'
  });
});

// 字符列表API
app.get('/api/v1/characters', (req, res) => {
  // 读取本地存储的字符文件
  const charactersPath = path.join(uploadsPath, 'characters');
  let characters = [];
  
  try {
    if (fs.existsSync(charactersPath)) {
      const files = fs.readdirSync(charactersPath);
      characters = files.filter(f => f.endsWith('.json')).map((file, index) => ({
        id: index + 1,
        name: `Character ${index + 1}`,
        prompt: `Generated character from ${file}`,
        styleType: 'REALISTIC',
        s3Url: `/uploads/characters/${file.replace('.json', '.png')}`,
        thumbnailUrl: `/uploads/thumbnails/${file.replace('.json', '_thumb.png')}`,
        isPublic: true,
        generationStatus: 'COMPLETED',
        createdAt: new Date().toISOString()
      }));
    }
  } catch (error) {
    console.log('读取字符文件时出错:', error.message);
  }

  res.json({
    success: true,
    data: characters,
    total: characters.length,
    message: 'Characters loaded from local storage'
  });
});

// 字符生成API
app.post('/api/v1/characters/generate', async (req, res) => {
  const { prompt, styleType = 'REALISTIC', batchSize = 1 } = req.body;

  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'Prompt is required'
    });
  }

  // 模拟字符生成过程
  const jobId = Date.now().toString();
  const characters = [];

  for (let i = 0; i < Math.min(batchSize, 4); i++) {
    const characterId = `${jobId}_${i}`;
    const character = {
      id: characterId,
      name: `Generated Character ${i + 1}`,
      prompt: prompt,
      styleType: styleType,
      s3Url: `/uploads/characters/${characterId}.png`,
      thumbnailUrl: `/uploads/thumbnails/${characterId}_thumb.png`,
      isPublic: true,
      generationStatus: 'PROCESSING',
      createdAt: new Date().toISOString(),
      metadata: {
        generatedBy: 'nanoBanana',
        model: 'imagen-2',
        apiKey: process.env.NANOBANANA_API_KEY ? 'configured' : 'not configured'
      }
    };
    characters.push(character);

    // 保存字符信息到本地文件
    const characterPath = path.join(uploadsPath, 'characters', `${characterId}.json`);
    try {
      fs.writeFileSync(characterPath, JSON.stringify(character, null, 2));
    } catch (error) {
      console.log('保存字符信息失败:', error.message);
    }
  }

  // 模拟异步处理 - 5秒后更新状态为完成
  setTimeout(() => {
    characters.forEach(char => {
      const characterPath = path.join(uploadsPath, 'characters', `${char.id}.json`);
      try {
        char.generationStatus = 'COMPLETED';
        char.completedAt = new Date().toISOString();
        fs.writeFileSync(characterPath, JSON.stringify(char, null, 2));
        console.log(`字符 ${char.id} 生成完成`);
      } catch (error) {
        console.log('更新字符状态失败:', error.message);
      }
    });
  }, 5000);

  res.json({
    success: true,
    data: {
      jobId: jobId,
      characters: characters,
      estimatedTime: '5 seconds',
      status: 'PROCESSING'
    },
    message: `Started generating ${characters.length} character(s)`
  });
});

// 文件上传API
app.post('/api/v1/upload', (req, res) => {
  // 简单的文件上传响应
  res.json({
    success: true,
    data: {
      url: '/uploads/temp/placeholder.png',
      filename: 'uploaded_file.png'
    },
    message: 'File upload endpoint ready'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `路径 ${req.path} 不存在`
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('\n🚀 字符创建平台服务器启动成功!');
  console.log(`🌐 服务器地址: http://localhost:${PORT}`);
  console.log(`🔗 健康检查: http://localhost:${PORT}/health`);
  console.log(`📡 API端点: http://localhost:${PORT}/api/v1`);
  console.log(`🎭 字符生成: http://localhost:${PORT}/api/v1/characters/generate`);
  console.log(`📁 文件上传: http://localhost:${PORT}/api/v1/upload`);
  console.log(`💾 本地存储: ${path.join(__dirname, 'uploads')}`);
  
  if (process.env.NANOBANANA_API_KEY) {
    console.log('🤖 nanoBanana API: ✅ 已配置');
  } else {
    console.log('🤖 nanoBanana API: ⚠️  未配置 (使用模拟模式)');
  }
  
  console.log('\n准备就绪! 可以开始开发了 🎉\n');
});