const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const path = require('path');
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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store conversation history (in production, use a database)
const conversations = new Map();

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('Received message:', message);

    // Get the generative model - using a working model name
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Get or create conversation history
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }
    
    const conversationHistory = conversations.get(sessionId);
    
    // Build conversation context
    let prompt = "You are a helpful AI assistant. Be friendly and concise in your responses.\n\n";
    
    // Add conversation history
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
    
    // Add to conversation history
    conversationHistory.push({ role: 'user', content: message });
    conversationHistory.push({ role: 'assistant', content: botResponse });

    // Keep only last 10 exchanges (20 messages)
    if (conversationHistory.length > 20) {
      conversationHistory.splice(0, conversationHistory.length - 20);
    }

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
app.post('/api/clear', (req, res) => {
  const { sessionId = 'default' } = req.body;
  conversations.delete(sessionId);
  console.log('Cleared conversation for session:', sessionId);
  res.json({ message: 'Conversation cleared' });
});

app.listen(port, () => {
  console.log(`🚀 Gemini Chatbot server running at http://localhost:${port}`);
  console.log('Open your browser and go to http://localhost:3000');
  console.log('API Key loaded:', process.env.GEMINI_API_KEY ? 'Yes' : 'No');
});