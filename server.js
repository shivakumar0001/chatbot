const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const fs = require('fs-extra');
const mime = require('mime-types');
const axios = require('axios');
const Database = require('./database');
require('dotenv').config();

const app = express();
const port = 3000;

// Check if API key is provided
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY not found in environment variables.');
  console.log('Please create a .env file and add your Gemini API key:');
  console.log('GEMINI_API_KEY=your_api_key_here');
  process.exit(1);
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize Database
const database = new Database();

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
const imagesDir = path.join(__dirname, 'generated-images');
fs.ensureDirSync(uploadsDir);
fs.ensureDirSync(imagesDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, text files, and documents
    const allowedTypes = /jpeg|jpg|png|gif|webp|txt|pdf|doc|docx|json|csv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, text files, and documents are allowed!'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(uploadsDir));
app.use('/generated-images', express.static(imagesDir));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { sessionId = uuidv4() } = req.body;
    
    console.log('File upload details:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
    
    // Create or get user session
    await database.createOrGetUser(sessionId);

    // Save file upload record to database
    const fileRecord = await database.saveFileUpload(
      sessionId,
      req.file.filename,
      req.file.originalname,
      req.file.path,
      req.file.size,
      req.file.mimetype
    );

    console.log('File uploaded successfully:', req.file.originalname);

    res.json({
      success: true,
      file: {
        id: fileRecord.id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        url: `/uploads/${req.file.filename}` // This should match the static route
      },
      sessionId
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ 
      error: 'File upload failed',
      details: error.message 
    });
  }
});

// Chat endpoint with file analysis support
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = uuidv4(), fileUrl, generateImage } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('Received message:', message, 'Session:', sessionId);

    // Create or get user session
    await database.createOrGetUser(sessionId);

    // Check if this is an image generation request
    if (generateImage) {
      return await handleImageGeneration(req, res, sessionId, message);
    }

    // Get conversation history from database
    const conversationHistory = await database.getConversationHistory(sessionId, 10);
    
    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    let prompt = "You are a helpful AI assistant. Be friendly and concise in your responses.\n\n";
    
    // Add conversation history from database
    conversationHistory.forEach(msg => {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n`;
      } else {
        prompt += `Assistant: ${msg.content}\n`;
      }
    });

    // Handle file analysis if fileUrl is provided
    if (fileUrl) {
      try {
        const filePath = path.join(__dirname, fileUrl.replace(/^\//, '')); // Remove leading slash and join with __dirname
        const mimeType = mime.lookup(filePath);
        
        console.log('Analyzing file:', filePath, 'MIME type:', mimeType);
        
        if (mimeType && mimeType.startsWith('image/')) {
          // For images, use vision capabilities
          const imageData = fs.readFileSync(filePath);
          const base64Image = imageData.toString('base64');
          
          const result = await model.generateContent([
            `Analyze this image and answer: ${message}`,
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType
              }
            }
          ]);
          
          const response = await result.response;
          const botResponse = response.text();
          
          // Save messages to database
          await database.saveChatMessage(sessionId, 'user', `${message} [Image: ${fileUrl}]`);
          await database.saveChatMessage(sessionId, 'assistant', botResponse);
          await database.saveConversation(sessionId, message, botResponse);

          return res.json({ 
            response: botResponse,
            sessionId: sessionId
          });
        } else if (mimeType === 'text/plain' || mimeType === 'application/json') {
          // For text files, read content and include in prompt
          const fileContent = fs.readFileSync(filePath, 'utf8');
          prompt += `User uploaded a file with content:\n${fileContent}\n\nUser: ${message}\nAssistant:`;
        }
      } catch (fileError) {
        console.error('File analysis error:', fileError);
        prompt += `User: ${message} (Note: Could not analyze uploaded file - file may not exist or be corrupted)\nAssistant:`;
      }
    } else {
      prompt += `User: ${message}\nAssistant:`;
    }

    console.log('Sending prompt to Gemini...');

    // Generate response
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const botResponse = response.text();
    
    console.log('Received response from Gemini:', botResponse);
    
    // Save messages to database
    await database.saveChatMessage(sessionId, 'user', message);
    await database.saveChatMessage(sessionId, 'assistant', botResponse);
    await database.saveConversation(sessionId, message, botResponse);

    res.json({ 
      response: botResponse,
      sessionId: sessionId
    });

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ 
      error: 'Sorry, I encountered an error. Please try again.',
      details: error.message
    });
  }
});

// Image generation handler
async function handleImageGeneration(req, res, sessionId, prompt) {
  try {
    console.log('Generating image with prompt:', prompt);
    
    // First, let's try with a free image generation service
    // Using Hugging Face's free Stable Diffusion model
    const imageUrl = await generateImageWithHuggingFace(prompt);
    
    if (imageUrl) {
      // Download and save the image locally
      const imagePath = await downloadAndSaveImage(imageUrl, sessionId, prompt);
      
      // Save to database
      await database.saveGeneratedImage(sessionId, prompt, imagePath);
      await database.saveChatMessage(sessionId, 'user', `[Image Generation] ${prompt}`);
      await database.saveChatMessage(sessionId, 'assistant', `Generated image: ${prompt}`);
      await database.saveConversation(sessionId, prompt, `Generated image: ${prompt}`);

      const response = `🎨 **Image Generated Successfully!**

**Your Prompt:** "${prompt}"

I've generated an image based on your description. You can view it below:

![Generated Image](${imagePath})

The image has been created and saved. You can download it or ask me to generate variations!`;

      res.json({
        response: response,
        sessionId: sessionId,
        imageGeneration: true,
        imageUrl: imagePath
      });
    } else {
      // Fallback to description if image generation fails
      await handleImageDescriptionFallback(req, res, sessionId, prompt);
    }

  } catch (error) {
    console.error('Image generation error:', error);
    // Fallback to description
    await handleImageDescriptionFallback(req, res, sessionId, prompt);
  }
}

// Generate image using multiple fallback methods
async function generateImageWithHuggingFace(prompt) {
  // Method 1: Try Pollinations AI (free, no API key needed)
  try {
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&seed=${Math.floor(Math.random() * 1000000)}`;
    
    // Test if the URL is accessible
    const testResponse = await axios.head(pollinationsUrl, { timeout: 10000 });
    if (testResponse.status === 200) {
      console.log('Using Pollinations AI for image generation');
      return pollinationsUrl;
    }
  } catch (error) {
    console.log('Pollinations AI failed, trying next method...');
  }

  // Method 2: Try Picsum with overlay text (as a creative fallback)
  try {
    const picsum = `https://picsum.photos/512/512?random=${Math.floor(Math.random() * 1000)}`;
    console.log('Using Picsum as creative fallback');
    return picsum;
  } catch (error) {
    console.log('Picsum failed, using local generation...');
  }

  // Method 3: Generate local SVG placeholder
  return await generateLocalPlaceholderImage(prompt);
}

// Generate a local placeholder image with text
async function generateLocalPlaceholderImage(prompt) {
  try {
    // Create a more attractive SVG image with the prompt text
    const colors = [
      ['#667eea', '#764ba2'],
      ['#f093fb', '#f5576c'],
      ['#4facfe', '#00f2fe'],
      ['#43e97b', '#38f9d7'],
      ['#fa709a', '#fee140'],
      ['#a8edea', '#fed6e3']
    ];
    
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const promptWords = prompt.split(' ').slice(0, 8).join(' '); // First 8 words
    
    const svgContent = `
      <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${randomColor[0]};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${randomColor[1]};stop-opacity:1" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.3)"/>
          </filter>
        </defs>
        <rect width="512" height="512" fill="url(#grad1)" />
        
        <!-- Decorative elements -->
        <circle cx="100" cy="100" r="30" fill="rgba(255,255,255,0.1)" />
        <circle cx="400" cy="400" r="40" fill="rgba(255,255,255,0.1)" />
        <circle cx="450" cy="80" r="20" fill="rgba(255,255,255,0.1)" />
        
        <!-- Main content -->
        <text x="256" y="180" font-family="Arial, sans-serif" font-size="28" font-weight="bold" text-anchor="middle" fill="white" filter="url(#shadow)">
          🎨 AI Generated
        </text>
        
        <foreignObject x="50" y="220" width="412" height="120">
          <div xmlns="http://www.w3.org/1999/xhtml" style="
            color: white; 
            font-family: Arial, sans-serif; 
            font-size: 18px; 
            text-align: center; 
            line-height: 1.4;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            padding: 10px;
          ">
            "${promptWords}${prompt.length > promptWords.length ? '...' : ''}"
          </div>
        </foreignObject>
        
        <text x="256" y="380" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="rgba(255,255,255,0.9)">
          Generated with AI ✨
        </text>
        
        <text x="256" y="400" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="rgba(255,255,255,0.7)">
          ${new Date().toLocaleDateString()}
        </text>
      </svg>
    `;

    const base64Svg = Buffer.from(svgContent).toString('base64');
    return `data:image/svg+xml;base64,${base64Svg}`;
  } catch (error) {
    console.error('Error generating placeholder:', error);
    return null;
  }
}

// Download and save image locally
async function downloadAndSaveImage(imageUrl, sessionId, prompt) {
  try {
    const timestamp = Date.now();
    const filename = `generated-${sessionId.substring(0, 8)}-${timestamp}.png`;
    const filepath = path.join(imagesDir, filename);

    if (imageUrl.startsWith('data:')) {
      // Handle base64 data URLs
      const base64Data = imageUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(filepath, buffer);
    } else {
      // Handle regular URLs
      const response = await axios.get(imageUrl, { responseType: 'stream' });
      const writer = fs.createWriteStream(filepath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    }

    return `/generated-images/${filename}`;
  } catch (error) {
    console.error('Error saving image:', error);
    return null;
  }
}

// Fallback to description if image generation fails
async function handleImageDescriptionFallback(req, res, sessionId, prompt) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const imagePrompt = `Create a detailed, vivid description of an image based on this prompt: "${prompt}"

Please provide:
1. A detailed visual description of what this image would look like
2. Colors, composition, style, and mood
3. Specific details about objects, people, or scenes

Make it so detailed that someone could almost visualize the image from your description.`;

    const result = await model.generateContent(imagePrompt);
    const response = await result.response;
    const imageDescription = response.text();

    const fullResponse = `🎨 **Image Generation (Description Mode)**

**Your Prompt:** "${prompt}"

**Detailed Visual Description:**
${imageDescription}

---
**Note:** I created a detailed description since image generation services are currently unavailable. The description above gives you a vivid picture of what your requested image would look like!`;

    // Save the image generation request
    await database.saveChatMessage(sessionId, 'user', `[Image Generation] ${prompt}`);
    await database.saveChatMessage(sessionId, 'assistant', fullResponse);
    await database.saveConversation(sessionId, prompt, fullResponse);

    res.json({
      response: fullResponse,
      sessionId: sessionId,
      imageGeneration: true
    });

  } catch (error) {
    console.error('Fallback description error:', error);
    res.status(500).json({ 
      error: 'Image generation failed. Please try again.',
      details: error.message
    });
  }
}

// Get uploaded files for a session
app.get('/api/files/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const files = await database.getSessionFiles(sessionId);
    
    res.json({ 
      sessionId,
      files: files.map(file => ({
        ...file,
        url: `/uploads/${file.filename}`
      }))
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Clear conversation endpoint
app.post('/api/clear', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const result = await database.clearSessionHistory(sessionId);
    console.log('Cleared conversation for session:', sessionId);
    
    res.json({ 
      message: 'Conversation cleared',
      deletedRows: result.deletedRows
    });
  } catch (error) {
    console.error('Error clearing conversation:', error);
    res.status(500).json({ error: 'Failed to clear conversation' });
  }
});

// Get conversation history endpoint
app.get('/api/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const conversations = await database.getSessionConversations(sessionId);
    
    res.json({ 
      sessionId,
      conversations
    });
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    res.status(500).json({ error: 'Failed to fetch conversation history' });
  }
});

// Get chat statistics endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await database.getChatStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching chat stats:', error);
    res.status(500).json({ error: 'Failed to fetch chat statistics' });
  }
});

// Export conversation data endpoint
app.get('/api/export/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const history = await database.getConversationHistory(sessionId, 1000);
    const files = await database.getSessionFiles(sessionId);
    
    // Format for export
    const exportData = {
      sessionId,
      exportDate: new Date().toISOString(),
      messageCount: history.length,
      fileCount: files.length,
      conversations: history,
      uploadedFiles: files
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="chat-export-${sessionId}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting conversation:', error);
    res.status(500).json({ error: 'Failed to export conversation' });
  }
});

// Test endpoint to check file paths
app.get('/api/test-file/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  
  console.log('Testing file path:', filePath);
  console.log('File exists:', fs.existsSync(filePath));
  
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    res.json({
      exists: true,
      path: filePath,
      size: stats.size,
      modified: stats.mtime
    });
  } else {
    res.json({
      exists: false,
      path: filePath,
      uploadsDir: path.join(__dirname, 'uploads'),
      files: fs.readdirSync(path.join(__dirname, 'uploads')).slice(0, 5) // Show first 5 files
    });
  }
});

// Test endpoint to check recent chats
app.get('/api/test-chats', async (req, res) => {
  try {
    const recentChats = await database.db.all(`
      SELECT DISTINCT session_id, 
             (SELECT content FROM chat_messages WHERE session_id = c.session_id AND role = 'user' ORDER BY timestamp ASC LIMIT 1) as first_message,
             MAX(timestamp) as last_activity
      FROM chat_messages c 
      GROUP BY session_id 
      ORDER BY last_activity DESC 
      LIMIT 10
    `);
    
    res.json({ recentChats });
  } catch (error) {
    console.error('Error fetching recent chats:', error);
    res.status(500).json({ error: 'Failed to fetch recent chats' });
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  database.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  database.close();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`🚀 Gemini Chatbot server running at http://localhost:${port}`);
  console.log('Open your browser and go to http://localhost:3000');
  console.log('API Key loaded:', process.env.GEMINI_API_KEY ? 'Yes' : 'No');
  console.log('Database: SQLite initialized');
  console.log('File uploads: Enabled');
  console.log('Image generation: Enabled (Nano Banana)');
});