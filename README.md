# Gemini AI Chatbot

A modern web-based chatbot built with Node.js and Google's Gemini AI API. Features a beautiful, responsive interface for seamless conversations with AI.

![Chatbot Interface](https://img.shields.io/badge/Interface-Web%20Based-blue)
![AI Model](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

- 🤖 **Powered by Gemini 2.5 Flash** - Fast and intelligent responses
- 💬 **Real-time Chat Interface** - Smooth, responsive web UI
- 🧠 **Conversation Memory** - Maintains context during sessions
- 🎨 **Modern Design** - Beautiful gradient UI with animations
- 📱 **Mobile Responsive** - Works perfectly on all devices
- 🔄 **Clear Chat Function** - Start fresh conversations anytime
- ⚡ **Fast Performance** - Optimized for quick responses

## 🚀 Quick Start

### Prerequisites

- Node.js 14 or higher
- A Google AI API key (Gemini)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/gemini-chatbot.git
   cd gemini-chatbot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up your API key:**
   - Copy `.env.example` to `.env`
   - Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Add your key to `.env`:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Open your browser:**
   - Navigate to `http://localhost:3000`
   - Start chatting with the AI!

## 🛠️ Technology Stack

- **Backend:** Node.js, Express.js
- **AI:** Google Gemini 2.5 Flash API
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Styling:** Modern CSS with gradients and animations
- **API:** RESTful endpoints for chat functionality

## 📁 Project Structure

```
gemini-chatbot/
├── public/
│   ├── index.html      # Main web interface
│   ├── style.css       # Styling and animations
│   └── script.js       # Frontend JavaScript
├── server.js           # Express server and API routes
├── package.json        # Dependencies and scripts
├── .env.example        # Environment variables template
├── .gitignore         # Git ignore rules
└── README.md          # Project documentation
```

## 🔧 Configuration

### Environment Variables

- `GEMINI_API_KEY` - Your Google AI API key (required)

### Model Configuration

The chatbot uses `gemini-2.5-flash` by default. You can change this in `server.js`:

```javascript
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
```

Available models:
- `gemini-2.5-flash` (recommended)
- `gemini-2.5-pro`
- `gemini-2.0-flash`

## 🎯 API Endpoints

- `GET /` - Serve the main chat interface
- `POST /api/chat` - Send message and get AI response
- `POST /api/clear` - Clear conversation history

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google AI for the powerful Gemini API
- The open-source community for inspiration and tools

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/YOUR_USERNAME/gemini-chatbot/issues) page
2. Create a new issue if your problem isn't already reported
3. Provide detailed information about your setup and the issue

---

**Made with ❤️ and AI**