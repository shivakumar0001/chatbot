const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = uuidv4() } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('Received message:', message, 'Session:', sessionId);

    // Create or get user session
    await database.createOrGetUser(sessionId);

    // Get conversation history from database
    const conversationHistory = await database.getConversationHistory(sessionId, 10);
    
    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // Build conversation context
    let prompt = "You are a helpful AI assistant. Be friendly and concise in your responses.\n\n";
    
    // Add conversation history from database
    conversationHistory.forEach(msg => {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n`;
      } else {
        prompt += `Assistant: ${msg.content}\n`;
      }
    });
    
    // Add current message
    prompt += `User: ${message}\nAssistant:`;

    console.log('Sending prompt to Gemini...');

    // Generate response
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const botResponse = response.text();
    
    console.log('Received response from Gemini:', botResponse);
    
    // Save messages to database
    await database.saveChatMessage(sessionId, 'user', message);
    await database.saveChatMessage(sessionId, 'assistant', botResponse);
    
    // Also save the complete conversation
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
    
    // Format for export
    const exportData = {
      sessionId,
      exportDate: new Date().toISOString(),
      messageCount: history.length,
      conversations: history
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="chat-export-${sessionId}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting conversation:', error);
    res.status(500).json({ error: 'Failed to export conversation' });
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
});