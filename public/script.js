class ChatBot {
    constructor() {
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.statsBtn = document.getElementById('statsBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.fileBtn = document.getElementById('fileBtn');
        this.imageGenBtn = document.getElementById('imageGenBtn');
        this.fileInput = document.getElementById('fileInput');
        this.filePreview = document.getElementById('filePreview');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatHistory = document.getElementById('chatHistory');
        this.currentChatTitle = document.getElementById('currentChatTitle');
        this.sessionInfo = document.getElementById('sessionInfo');
        this.status = document.getElementById('status');
        this.statsModal = document.getElementById('statsModal');
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebarToggle');
        
        this.currentSessionId = this.generateSessionId();
        this.chatSessions = new Map();
        this.uploadedFiles = [];
        this.imageGenerationMode = false;
        this.messageCount = 0;
        
        this.initEventListeners();
        this.loadChatSessions();
        this.updateSessionInfo();
        this.showWelcomeMessage();
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9);
    }

    initEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.clearBtn.addEventListener('click', () => this.clearCurrentChat());
        this.newChatBtn.addEventListener('click', () => this.startNewChat());
        this.statsBtn.addEventListener('click', () => this.showStats());
        this.exportBtn.addEventListener('click', () => this.exportChat());
        this.fileBtn.addEventListener('click', () => this.fileInput.click());
        this.imageGenBtn.addEventListener('click', () => this.toggleImageGeneration());
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        
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

        // Close sidebar on mobile when clicking outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                !this.sidebar.contains(e.target) && 
                !this.sidebarToggle.contains(e.target) &&
                this.sidebar.classList.contains('open')) {
                this.toggleSidebar();
            }
        });

        // Add click handler for generated images
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('generated-image')) {
                this.showImageFullscreen(e.target.src);
            }
        });
    }

    showWelcomeMessage() {
        this.chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-content">
                    <h2>👋 Welcome to AI Chatbot</h2>
                    <p>I'm your AI assistant powered by Google's Gemini. I can help you with:</p>
                    <ul>
                        <li>💬 Answer questions and have conversations</li>
                        <li>📎 Analyze uploaded images and documents</li>
                        <li>🎨 Generate images from text descriptions</li>
                        <li>📊 Provide insights and explanations</li>
                    </ul>
                    <p>Start by typing a message below or upload a file to analyze!</p>
                </div>
            </div>
        `;
    }

    toggleSidebar() {
        this.sidebar.classList.toggle('open');
    }

    startNewChat() {
        this.currentSessionId = this.generateSessionId();
        this.uploadedFiles = [];
        this.messageCount = 0;
        this.updateFilePreview();
        this.showWelcomeMessage();
        this.updateSessionInfo();
        this.updateChatTitle('New Conversation');
        this.updateChatHistoryUI();
        
        // Close sidebar on mobile after starting new chat
        if (window.innerWidth <= 768) {
            this.toggleSidebar();
        }
    }

    updateSessionInfo() {
        this.sessionInfo.textContent = `Session: ${this.currentSessionId.substring(0, 8)}...`;
    }

    updateChatTitle(title) {
        this.currentChatTitle.textContent = title;
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        // Hide welcome message if it's the first message
        const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        // Add user message to chat
        this.addMessage(message, 'user');
        this.messageInput.value = '';
        this.sendBtn.disabled = true;
        this.messageCount++;
        
        // Show typing indicator
        this.setStatus('Bot is typing...', 'typing');

        // Add a temporary loading message
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message bot-message loading-message';
        loadingDiv.innerHTML = `
            <div class="message-content">
                <strong>Bot:</strong> <span class="typing-dots">Thinking<span>.</span><span>.</span><span>.</span></span>
            </div>
        `;
        this.chatMessages.appendChild(loadingDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

        try {
            const requestBody = {
                message: message,
                sessionId: this.currentSessionId
            };

            // Add file URL if there's an uploaded file
            if (this.uploadedFiles.length > 0) {
                requestBody.fileUrl = this.uploadedFiles[this.uploadedFiles.length - 1].url;
            }

            // Add image generation flag if in image generation mode
            if (this.imageGenerationMode) {
                requestBody.generateImage = true;
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            // Remove loading message
            loadingDiv.remove();

            const data = await response.json();

            if (response.ok) {
                this.addMessage(data.response, 'bot');
                this.setStatus('');
                
                // Save chat session
                this.saveChatSession(message, data.response);
                
                // Reset image generation mode after use
                if (this.imageGenerationMode) {
                    this.toggleImageGeneration();
                }
            } else {
                throw new Error(data.error || 'Something went wrong');
            }
        } catch (error) {
            // Remove loading message
            loadingDiv.remove();
            
            console.error('Error:', error);
            this.addMessage('Sorry, I encountered an error. Please try again. Make sure you have a stable internet connection.', 'bot');
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
            // Check if content contains image markdown
            let processedContent = this.escapeHtml(content);
            
            // Convert markdown images to HTML images
            processedContent = processedContent.replace(
                /!\[([^\]]*)\]\(([^)]+)\)/g,
                '<br><img src="$2" alt="$1" class="generated-image" style="max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0;"><br>'
            );
            
            // Convert line breaks
            processedContent = processedContent.replace(/\n/g, '<br>');
            
            messageContent.innerHTML = `<strong>Bot:</strong> ${processedContent}`;
        }
        
        messageDiv.appendChild(messageContent);
        this.chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom only if requested
        if (scroll) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    saveChatSession(userMessage, botResponse) {
        const sessionTitle = this.currentChatTitle.textContent === 'New Conversation' 
            ? (userMessage.length > 30 ? userMessage.substring(0, 30) + '...' : userMessage)
            : this.currentChatTitle.textContent;

        if (!this.chatSessions.has(this.currentSessionId)) {
            this.chatSessions.set(this.currentSessionId, {
                id: this.currentSessionId,
                title: sessionTitle,
                messages: [],
                timestamp: new Date(),
                lastMessage: userMessage
            });
        }

        const session = this.chatSessions.get(this.currentSessionId);
        session.messages.push(
            { role: 'user', content: userMessage, timestamp: new Date() },
            { role: 'assistant', content: botResponse, timestamp: new Date() }
        );
        session.lastMessage = userMessage;
        session.timestamp = new Date();
        session.title = sessionTitle;

        // Update chat title if it was "New Conversation"
        if (this.currentChatTitle.textContent === 'New Conversation') {
            this.updateChatTitle(sessionTitle);
        }

        this.updateChatHistoryUI();
        this.saveChatSessionsToStorage();
    }

    loadChatSessions() {
        try {
            const saved = localStorage.getItem('chatSessions');
            if (saved) {
                const sessions = JSON.parse(saved);
                sessions.forEach(session => {
                    session.timestamp = new Date(session.timestamp);
                    session.messages.forEach(msg => {
                        msg.timestamp = new Date(msg.timestamp);
                    });
                    this.chatSessions.set(session.id, session);
                });
                this.updateChatHistoryUI();
            }
        } catch (error) {
            console.error('Error loading chat sessions:', error);
        }
    }

    saveChatSessionsToStorage() {
        try {
            const sessions = Array.from(this.chatSessions.values());
            localStorage.setItem('chatSessions', JSON.stringify(sessions));
        } catch (error) {
            console.error('Error saving chat sessions:', error);
        }
    }

    updateChatHistoryUI() {
        this.chatHistory.innerHTML = '';
        
        const sessions = Array.from(this.chatSessions.values())
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 20); // Show only last 20 sessions

        if (sessions.length === 0) {
            this.chatHistory.innerHTML = '<p style="color: #95a5a6; text-align: center; padding: 20px;">No recent chats</p>';
            return;
        }

        sessions.forEach(session => {
            const historyItem = document.createElement('div');
            historyItem.className = 'chat-history-item';
            if (session.id === this.currentSessionId) {
                historyItem.classList.add('active');
            }

            const timeStr = this.formatTime(session.timestamp);
            const preview = session.lastMessage.length > 40 
                ? session.lastMessage.substring(0, 40) + '...' 
                : session.lastMessage;

            historyItem.innerHTML = `
                <div class="chat-preview">${this.escapeHtml(preview)}</div>
                <div class="chat-time">${timeStr}</div>
            `;

            historyItem.addEventListener('click', () => {
                this.loadChatSession(session.id);
                if (window.innerWidth <= 768) {
                    this.toggleSidebar();
                }
            });

            this.chatHistory.appendChild(historyItem);
        });
    }

    loadChatSession(sessionId) {
        const session = this.chatSessions.get(sessionId);
        if (!session) return;

        this.currentSessionId = sessionId;
        this.updateSessionInfo();
        this.updateChatTitle(session.title);
        
        // Clear current chat
        this.chatMessages.innerHTML = '';
        
        // Load messages
        session.messages.forEach(msg => {
            this.addMessage(msg.content, msg.role, false);
        });

        // Scroll to bottom
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        // Update UI
        this.updateChatHistoryUI();
    }

    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            this.setStatus('File too large. Maximum size is 10MB.', 'error');
            setTimeout(() => this.setStatus(''), 3000);
            return;
        }

        this.setStatus('Uploading file...', 'typing');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('sessionId', this.currentSessionId);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.uploadedFiles.push(data.file);
                this.updateFilePreview();
                this.setStatus(`File uploaded: ${data.file.originalName}`, 'typing');
                setTimeout(() => this.setStatus(''), 2000);
                
                console.log('File uploaded successfully:', data.file);
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.setStatus(`Upload failed: ${error.message}`, 'error');
            setTimeout(() => this.setStatus(''), 5000);
        }

        this.fileInput.value = '';
    }

    updateFilePreview() {
        this.filePreview.innerHTML = '';
        
        this.uploadedFiles.forEach((file, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'file-preview-item';
            
            const fileIcon = this.getFileIcon(file.mimeType);
            
            previewItem.innerHTML = `
                <span>${fileIcon} ${file.originalName}</span>
                <button class="remove-file" onclick="chatBot.removeFile(${index})">×</button>
            `;
            
            this.filePreview.appendChild(previewItem);
        });
    }

    getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('text')) return '📝';
        if (mimeType.includes('json')) return '📋';
        return '📎';
    }

    removeFile(index) {
        this.uploadedFiles.splice(index, 1);
        this.updateFilePreview();
    }

    toggleImageGeneration() {
        this.imageGenerationMode = !this.imageGenerationMode;
        
        if (this.imageGenerationMode) {
            this.imageGenBtn.classList.add('image-generation-mode');
            this.messageInput.placeholder = 'Describe the image you want to generate...';
            this.setStatus('Image generation mode activated 🎨', 'typing');
        } else {
            this.imageGenBtn.classList.remove('image-generation-mode');
            this.messageInput.placeholder = 'Type your message here...';
            this.setStatus('');
        }
    }

    async clearCurrentChat() {
        if (!confirm('Are you sure you want to clear this chat?')) return;

        try {
            await fetch('/api/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.currentSessionId
                }),
            });

            // Remove from local storage
            this.chatSessions.delete(this.currentSessionId);
            this.saveChatSessionsToStorage();
            
            // Start new chat
            this.startNewChat();
            
            this.setStatus('Chat cleared', 'typing');
            setTimeout(() => this.setStatus(''), 2000);
            
        } catch (error) {
            console.error('Error clearing chat:', error);
            this.setStatus('Error clearing chat', 'error');
            setTimeout(() => this.setStatus(''), 3000);
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
                        <span><strong>Local Sessions:</strong></span>
                        <span>${this.chatSessions.size}</span>
                    </div>
                    <div class="stats-item">
                        <span><strong>Current Session:</strong></span>
                        <span>${this.currentSessionId.substring(0, 8)}...</span>
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
            const response = await fetch(`/api/export/${this.currentSessionId}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chat-export-${this.currentSessionId.substring(0, 8)}.json`;
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

    setStatus(message, type = '') {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showImageFullscreen(imageSrc) {
        // Create fullscreen overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            cursor: pointer;
        `;

        const img = document.createElement('img');
        img.src = imageSrc;
        img.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        `;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            font-size: 30px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        overlay.appendChild(img);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);

        // Close on click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target === closeBtn) {
                document.body.removeChild(overlay);
            }
        });

        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }
}

// Initialize the chatbot when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.chatBot = new ChatBot();
});