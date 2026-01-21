class ChatBot {
    constructor() {
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.chatMessages = document.getElementById('chatMessages');
        this.status = document.getElementById('status');
        this.sessionId = this.generateSessionId();
        
        this.initEventListeners();
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9);
    }

    initEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.clearBtn.addEventListener('click', () => this.clearChat());
        
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.messageInput.addEventListener('input', () => {
            this.sendBtn.disabled = this.messageInput.value.trim() === '';
        });
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        // Add user message to chat
        this.addMessage(message, 'user');
        this.messageInput.value = '';
        this.sendBtn.disabled = true;
        
        // Show typing indicator
        this.setStatus('Bot is typing...', 'typing');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    sessionId: this.sessionId
                }),
            });

            const data = await response.json();

            if (response.ok) {
                this.addMessage(data.response, 'bot');
                this.setStatus('');
            } else {
                throw new Error(data.error || 'Something went wrong');
            }
        } catch (error) {
            console.error('Error:', error);
            this.addMessage('Sorry, I encountered an error. Please try again.', 'bot');
            this.setStatus('Error occurred', 'error');
            setTimeout(() => this.setStatus(''), 3000);
        }

        this.sendBtn.disabled = false;
    }

    addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        if (sender === 'user') {
            messageContent.innerHTML = `<strong>You:</strong> ${this.escapeHtml(content)}`;
        } else {
            messageContent.innerHTML = `<strong>Bot:</strong> ${this.escapeHtml(content)}`;
        }
        
        messageDiv.appendChild(messageContent);
        this.chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async clearChat() {
        try {
            await fetch('/api/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.sessionId
                }),
            });

            // Clear chat messages except the welcome message
            this.chatMessages.innerHTML = `
                <div class="message bot-message">
                    <div class="message-content">
                        <strong>Bot:</strong> Hello! I'm your AI assistant. How can I help you today?
                    </div>
                </div>
            `;
            
            this.setStatus('Chat cleared', 'typing');
            setTimeout(() => this.setStatus(''), 2000);
            
        } catch (error) {
            console.error('Error clearing chat:', error);
            this.setStatus('Error clearing chat', 'error');
            setTimeout(() => this.setStatus(''), 3000);
        }
    }

    setStatus(message, type = '') {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the chatbot when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
});