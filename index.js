const OpenAI = require('openai');
const readline = require('readline');
require('dotenv').config();

class ChatBot {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    this.conversationHistory = [];
  }

  async chat(userMessage) {
    try {
      // Add user message to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      // Create chat completion
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Be concise and friendly in your responses.'
          },
          ...this.conversationHistory
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const botResponse = completion.choices[0].message.content;
      
      // Add bot response to conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: botResponse
      });

      return botResponse;
    } catch (error) {
      console.error('Error calling OpenAI API:', error.message);
      return 'Sorry, I encountered an error. Please try again.';
    }
  }

  start() {
    console.log('🤖 ChatBot is ready! Type "quit" or "exit" to end the conversation.\n');
    
    const askQuestion = () => {
      this.rl.question('You: ', async (input) => {
        const userInput = input.trim();
        
        if (userInput.toLowerCase() === 'quit' || userInput.toLowerCase() === 'exit') {
          console.log('👋 Goodbye!');
          this.rl.close();
          return;
        }
        
        if (userInput === '') {
          askQuestion();
          return;
        }

        console.log('🤖 Thinking...');
        const response = await this.chat(userInput);
        console.log(`Bot: ${response}\n`);
        
        askQuestion();
      });
    };

    askQuestion();
  }
}

// Check if API key is provided
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Error: OPENAI_API_KEY not found in environment variables.');
  console.log('Please create a .env file and add your OpenAI API key:');
  console.log('OPENAI_API_KEY=your_api_key_here');
  process.exit(1);
}

// Start the chatbot
const bot = new ChatBot();
bot.start();