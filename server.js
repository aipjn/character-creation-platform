require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

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
const publicPath = path.join(__dirname, 'public');
const subDirs = ['characters', 'thumbnails', 'temp', 'exports'];
subDirs.forEach(dir => {
  const dirPath = path.join(uploadsPath, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// 静态文件服务
app.use('/uploads', express.static(uploadsPath));
app.use(express.static(publicPath));

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
      database: 'disabled (development mode)',
      webInterface: 'enabled'
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
      webInterface: true,
      nanoBananaIntegration: !!process.env.NANOBANANA_API_KEY
    },
    endpoints: {
      health: '/health',
      users: '/api/v1/users',
      characters: '/api/v1/characters',
      generate: '/api/v1/characters/generate',
      webInterface: '/'
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
  const charactersPath = path.join(uploadsPath, 'characters');
  let characters = [];
  
  try {
    if (fs.existsSync(charactersPath)) {
      const files = fs.readdirSync(charactersPath);
      characters = files.filter(f => f.endsWith('.json')).map((file, index) => {
        try {
          const content = fs.readFileSync(path.join(charactersPath, file), 'utf8');
          return JSON.parse(content);
        } catch (err) {
          return {
            id: index + 1,
            name: `Character ${index + 1}`,
            prompt: `Generated character from ${file}`,
            styleType: 'REALISTIC',
            s3Url: `/uploads/characters/${file.replace('.json', '.png')}`,
            thumbnailUrl: `/uploads/thumbnails/${file.replace('.json', '_thumb.png')}`,
            isPublic: true,
            generationStatus: 'COMPLETED',
            createdAt: new Date().toISOString()
          };
        }
      });
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

// 实际的nanoBanana API调用函数
async function callNanoBananaAPI(prompt, styleType, referenceImagePath = null) {
  if (!process.env.NANOBANANA_API_KEY) {
    throw new Error('nanoBanana API key not configured');
  }

  const stylePrompt = {
    'REALISTIC': 'photorealistic, high quality, detailed',
    'CARTOON': 'cartoon style, animated, colorful',
    'ANIME': 'anime style, manga art, Japanese animation',
    'FANTASY': 'fantasy art, magical, ethereal',
    'CYBERPUNK': 'cyberpunk style, futuristic, neon',
    'VINTAGE': 'vintage style, retro, classic',
    'MINIMALIST': 'minimalist style, clean, simple'
  }[styleType] || 'high quality, detailed';

  const enhancedPrompt = referenceImagePath 
    ? `Modify this character image: ${prompt}, ${stylePrompt}`
    : `Generate an image: ${prompt}, ${stylePrompt}`;

  try {
    console.log('🔗 正在通过代理调用nanoBanana API...');
    
    // 配置代理
    const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:7890');
    
    // 准备请求内容
    const parts = [{ text: enhancedPrompt }];
    
    // 如果有参考图片，添加到请求中
    if (referenceImagePath && fs.existsSync(referenceImagePath)) {
      try {
        const imageBuffer = fs.readFileSync(referenceImagePath);
        const imageBase64 = imageBuffer.toString('base64');
        const mimeType = referenceImagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
        
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: imageBase64
          }
        });
        
        console.log(`🖼️ 已添加参考图片: ${referenceImagePath}`);
      } catch (imageError) {
        console.warn('⚠️ 读取参考图片失败，使用文本生成:', imageError.message);
      }
    }
    
    // 使用原生fetch + 代理
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${process.env.NANOBANANA_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Character-Creator/1.0'
      },
      body: JSON.stringify({
        contents: [{
          parts: parts
        }],
        generationConfig: {
          temperature: 0.4
        }
      }),
      agent: proxyAgent  // 使用代理 (node-fetch支持agent属性)
    });

    console.log(`📡 API响应状态: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('nanoBanana API错误响应:', errorText);
      throw new Error(`nanoBanana API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ nanoBanana API调用成功');
    
    // 调试信息：打印完整的API响应结构
    console.log('🔍 API响应结构:', JSON.stringify(result, null, 2));
    
    if (!result.candidates || result.candidates.length === 0) {
      throw new Error('No content generated by nanoBanana API');
    }

    const candidate = result.candidates[0];
    console.log('🔍 候选内容:', JSON.stringify(candidate, null, 2));
    
    // nanoBanana (Gemini 2.5 Flash Image) 可能返回多个parts，包含text和inlineData
    if (candidate.content && candidate.content.parts) {
      // 查找包含图像数据的part
      const imagePart = candidate.content.parts.find(part => part.inlineData);
      if (imagePart && imagePart.inlineData) {
        const imageData = imagePart.inlineData;
        console.log('✅ 找到图像数据，MIME类型:', imageData.mimeType);
        return {
          image_base64: `data:${imageData.mimeType};base64,${imageData.data}`
        };
      } else {
        console.log('❌ 未找到图像数据，只有文本响应');
        throw new Error('No image data received from nanoBanana API');
      }
    } else {
      console.log('❌ 未找到预期的数据格式');
      throw new Error('No image data received from nanoBanana API');
    }
  } catch (error) {
    console.error('nanoBanana API调用失败:', error);
    throw error;
  }
}

// 保存base64图像到文件
function saveBase64Image(base64Data, filePath) {
  try {
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Image, 'base64');
    fs.writeFileSync(filePath, imageBuffer);
    return true;
  } catch (error) {
    console.error('保存图像失败:', error);
    return false;
  }
}

// 字符生成API
app.post('/api/v1/characters/generate', async (req, res) => {
  const { prompt, styleType = 'REALISTIC', batchSize = 1 } = req.body;

  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'Prompt is required'
    });
  }

  if (!process.env.NANOBANANA_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'nanoBanana API key not configured',
      message: '请先配置NANOBANANA_API_KEY环境变量'
    });
  }

  const jobId = Date.now().toString();
  const characters = [];

  // 立即响应，然后在后台处理
  res.json({
    success: true,
    data: {
      jobId: jobId,
      estimatedTime: '10-30 seconds',
      status: 'PROCESSING',
      message: `Starting generation of ${Math.min(batchSize, 4)} character(s)`
    }
  });

  // 后台处理每个字符生成
  for (let i = 0; i < Math.min(batchSize, 4); i++) {
    const characterId = `${jobId}_${i}`;
    
    // 创建初始字符记录
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
        generatedBy: 'nanoBanana-API',
        model: 'imagen-3.0-generate-001',
        jobId: jobId
      }
    };

    const characterPath = path.join(uploadsPath, 'characters', `${characterId}.json`);
    
    try {
      // 保存处理中状态
      fs.writeFileSync(characterPath, JSON.stringify(character, null, 2));
      console.log(`🔄 开始生成角色 ${characterId}...`);

      // 调用nanoBanana API
      const imageResult = await callNanoBananaAPI(prompt, styleType);
      
      // 保存生成的图像
      const imagePath = path.join(uploadsPath, 'characters', `${characterId}.png`);
      const thumbnailPath = path.join(uploadsPath, 'thumbnails', `${characterId}_thumb.png`);
      
      if (imageResult.image_base64) {
        const imageSaved = saveBase64Image(imageResult.image_base64, imagePath);
        const thumbnailSaved = saveBase64Image(imageResult.image_base64, thumbnailPath);
        
        if (imageSaved) {
          // 更新字符状态为完成
          character.generationStatus = 'COMPLETED';
          character.completedAt = new Date().toISOString();
          character.metadata.imageGenerated = true;
          character.metadata.thumbnailGenerated = thumbnailSaved;
          character.metadata.model = 'gemini-2.5-flash-image-preview (nanoBanana)';
          
          fs.writeFileSync(characterPath, JSON.stringify(character, null, 2));
          console.log(`✅ 角色 ${characterId} 生成完成`);
        } else {
          throw new Error('Failed to save generated image');
        }
      } else {
        throw new Error('No image data received from nanoBanana API');
      }
      
    } catch (error) {
      console.error(`❌ 生成角色 ${characterId} 失败:`, error.message);
      
      // 更新状态为失败
      character.generationStatus = 'FAILED';
      character.completedAt = new Date().toISOString();
      character.metadata.error = error.message;
      character.metadata.errorType = error.name || 'GenerationError';
      
      try {
        fs.writeFileSync(characterPath, JSON.stringify(character, null, 2));
      } catch (saveError) {
        console.error('保存失败状态时出错:', saveError.message);
      }
    }
  }
});

// Character Styling API (Step 2)
app.post('/api/v1/characters/:id/style', async (req, res) => {
  const { id } = req.params;
  const { pose, expression, scene, intensity = 50 } = req.body;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Character ID is required'
    });
  }

  if (!pose || !expression || !scene) {
    return res.status(400).json({
      success: false,
      error: 'Pose, expression, and scene are required'
    });
  }

  try {
    // Find the original character
    const charactersDir = path.join(uploadsPath, 'characters');
    let originalCharacter = null;
    
    // Look for character JSON file
    const files = fs.readdirSync(charactersDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const character = JSON.parse(fs.readFileSync(path.join(charactersDir, file), 'utf8'));
      if (character.id === id) {
        originalCharacter = character;
        break;
      }
    }

    if (!originalCharacter) {
      return res.status(404).json({
        success: false,
        error: 'Character not found'
      });
    }

    // Generate new styled character ID
    const styledId = `${Date.now()}_styled`;
    
    // Create enhanced prompt for styling
    const styledPrompt = `${originalCharacter.prompt}, in a ${pose} pose, with a ${expression} expression, intensity ${intensity}%, in a ${scene} setting`;
    
    // Get reference image path
    const originalImagePath = path.join(uploadsPath, 'characters', `${id}.png`);
    
    // Generate styled character using nanoBanana with reference image
    console.log(`🎨 Generating styled character with prompt: ${styledPrompt}`);
    console.log(`🖼️ Using reference image: ${originalImagePath}`);
    
    const result = await callNanoBananaAPI(styledPrompt, originalCharacter.styleType, originalImagePath);
    
    // Create character data
    const styledCharacter = {
      id: styledId,
      name: `${originalCharacter.name} (Styled)`,
      prompt: styledPrompt,
      originalId: id,
      styleType: originalCharacter.styleType,
      s3Url: `/uploads/characters/${styledId}.png`,
      thumbnailUrl: `/uploads/thumbnails/${styledId}_thumb.png`,
      isPublic: true,
      generationStatus: 'PROCESSING',
      createdAt: new Date().toISOString(),
      styling: {
        pose,
        expression,
        scene,
        intensity: parseInt(intensity)
      },
      metadata: {
        generatedBy: 'nanoBanana',
        model: 'imagen-2',
        apiKey: process.env.NANOBANANA_API_KEY ? 'configured' : 'not configured',
        basedOn: originalCharacter.id
      }
    };

    // Save character metadata
    const characterPath = path.join(charactersDir, `${styledId}.json`);
    fs.writeFileSync(characterPath, JSON.stringify(styledCharacter, null, 2));

    // Process the image in background
    setTimeout(async () => {
      try {
        if (result && result.image_base64) {
          // Save main image
          const imagePath = path.join(charactersDir, `${styledId}.png`);
          if (saveBase64Image(result.image_base64, imagePath)) {
            console.log(`✅ Styled character ${styledId} image saved`);
            
            // Update status to completed
            styledCharacter.generationStatus = 'COMPLETED';
            styledCharacter.completedAt = new Date().toISOString();
            
            fs.writeFileSync(characterPath, JSON.stringify(styledCharacter, null, 2));
            console.log(`✅ Styled character ${styledId} generation completed`);
          } else {
            throw new Error('Failed to save styled character image');
          }
        } else {
          throw new Error('No image data received for styled character');
        }
      } catch (error) {
        console.error(`❌ Styling character ${styledId} failed:`, error.message);
        
        // Update status to failed
        styledCharacter.generationStatus = 'FAILED';
        styledCharacter.completedAt = new Date().toISOString();
        styledCharacter.metadata.error = error.message;
        styledCharacter.metadata.errorType = error.name || 'StylingError';
        
        try {
          fs.writeFileSync(characterPath, JSON.stringify(styledCharacter, null, 2));
        } catch (saveError) {
          console.error('Error saving failed status:', saveError.message);
        }
      }
    }, 100);

    // Return immediate response
    res.json({
      success: true,
      data: {
        id: styledId,
        name: styledCharacter.name,
        s3Url: styledCharacter.s3Url,
        generationStatus: 'PROCESSING',
        styling: styledCharacter.styling,
        estimatedTime: '10-15 seconds'
      },
      message: 'Character styling started successfully'
    });

  } catch (error) {
    console.error('Character styling API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to style character'
    });
  }
});

// 文件上传API
app.post('/api/v1/upload', (req, res) => {
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
  console.log('\n🚀 AI角色创造平台启动成功!');
  console.log(`🌐 前端界面: http://localhost:${PORT}`);
  console.log(`🔗 健康检查: http://localhost:${PORT}/health`);
  console.log(`📡 API端点: http://localhost:${PORT}/api/v1`);
  console.log(`🎭 角色生成: http://localhost:${PORT}/api/v1/characters/generate`);
  console.log(`📁 文件上传: http://localhost:${PORT}/api/v1/upload`);
  console.log(`💾 本地存储: ${path.join(__dirname, 'uploads')}`);
  
  if (process.env.NANOBANANA_API_KEY) {
    console.log('🤖 nanoBanana API: ✅ 已配置');
  } else {
    console.log('🤖 nanoBanana API: ⚠️  使用模拟模式');
  }
  
  console.log('\n🎨 立即访问 http://localhost:3000 开始创建角色! 🎉\n');
});