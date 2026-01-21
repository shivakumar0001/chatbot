class ChatBot {
    constructor() {
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.statsBtn = document.getElementById('statsBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.chatMessages = document.getElementById('chatMessages');
        this.status = document.getElementById('status');
        this.statsModal = document.getElementById('statsModal');
        this.sessionId = this.generateSessionId();
        
        this.initEventListeners();
        this.loadChatHistory();
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9);
    }

    initEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.clearBtn.addEventListener('click', () => this.clearChat());
        this.statsBtn.addEventListener('click', () => this.showStats());
        this.exportBtn.addEventListener('click', () => this.exportChat());
        
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.messageInput.addEventListener('input', () => {
            this.sendBtn.disabled = this.messageInput.value.trim() === '';
        });

        // Modal close functionality
        const closeBtn = this.statsModal.querySelector('.close');
        closeBtn.addEventListener('click', () => {
            this.statsModal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === this.statsModal) {
                this.statsModal.style.display = 'none';
            }
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

    addMessage(content, sender, scroll = true) {
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
        
        // Scroll to bottom only if requested
        if (scroll) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
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

    async loadChatHistory() {
        try {
            const response = await fetch(`/api/history/${this.sessionId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.conversations && data.conversations.length > 0) {
                    // Clear welcome message
                    this.chatMessages.innerHTML = '';
                    
                    // Load previous conversations
                    data.conversations.forEach(conv => {
                        this.addMessage(conv.message, 'user', false);
                        this.addMessage(conv.response, 'bot', false);
                    });
                }
            }
        } catch (error) {
            console.log('No previous chat history found');
        }
    }

    async showStats() {
        try {
            const response = await fetch('/api/stats');
            if (response.ok) {
                const stats = await response.json();
                const statsContent = document.getElementById('statsContent');
                
                statsContent.innerHTML = `
                    <div class="stats-item">
                        <span><strong>Total Users:</strong></span>
                        <span>${stats.total_users || 0}</span>
                    </div>
                    <div class="stats-item">
                        <span><strong>Total Messages:</strong></span>
                        <span>${stats.total_messages || 0}</span>
                    </div>
                    <div class="stats-item">
                        <span><strong>User Messages:</strong></span>
                        <span>${stats.user_messages || 0}</span>
                    </div>
                    <div class="stats-item">
                        <span><strong>Bot Responses:</strong></span>
                        <span>${stats.bot_responses || 0}</span>
                    </div>
                    <div class="stats-item">
                        <span><strong>Your Session:</strong></span>
                        <span>${this.sessionId.substring(0, 8)}...</span>
                    </div>
                `;
                
                this.statsModal.style.display = 'block';
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
            this.setStatus('Error fetching statistics', 'error');
        }
    }

    async exportChat() {
        try {
            const response = await fetch(`/api/export/${this.sessionId}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chat-export-${this.sessionId.substring(0, 8)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.setStatus('Chat exported successfully!', 'typing');
                setTimeout(() => this.setStatus(''), 3000);
            }
        } catch (error) {
            console.error('Error exporting chat:', error);
            this.setStatus('Error exporting chat', 'error');
        }
    }
}

// Initialize the chatbot when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
});