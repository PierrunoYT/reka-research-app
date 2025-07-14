class ChatApp {
    constructor() {
        this.messages = [];
        this.sessionId = null;
        this.initializeElements();
        this.setupEventListeners();
        this.setupTextareaAutoResize();
    }

    initializeElements() {
        this.chatForm = document.getElementById('chatForm');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatMessages = document.getElementById('chatMessages');
        this.loadingOverlay = document.getElementById('loadingOverlay');
    }

    setupEventListeners() {
        this.chatForm.addEventListener('submit', (e) => this.handleSubmit(e));
        
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSubmit(e);
            }
        });

        this.messageInput.addEventListener('input', () => {
            this.toggleSendButton();
        });

        // Initial button state
        this.toggleSendButton();
    }

    setupTextareaAutoResize() {
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
        });
    }

    toggleSendButton() {
        const hasText = this.messageInput.value.trim().length > 0;
        this.sendButton.disabled = !hasText;
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const message = this.messageInput.value.trim();
        if (!message || this.sendButton.disabled) return;

        // Add user message to UI
        this.addMessage('user', message);
        
        // Clear input and disable form
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        this.setLoading(true);

        try {
            const response = await this.sendMessage(message);
            
            if (response.success) {
                this.addMessage('assistant', response.response);
                this.messages = response.messages;
            } else {
                this.addMessage('assistant', `Error: ${response.error}`);
            }
        } catch (error) {
            console.error('Error:', error);
            this.addMessage('assistant', 'Sorry, I encountered an error processing your request. Please try again.');
        } finally {
            this.setLoading(false);
            this.toggleSendButton();
        }
    }

    async sendMessage(message) {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                messages: this.messages,
                session_id: this.sessionId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Store session ID for future requests
        if (data.session_id) {
            this.sessionId = data.session_id;
        }
        
        return data;
    }

    addMessage(sender, content) {
        // Remove welcome message if it exists
        const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Format content for better display
        if (sender === 'assistant') {
            messageContent.innerHTML = this.formatMarkdown(content);
        } else {
            messageContent.textContent = content;
        }
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = this.formatTime(new Date());
        
        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(messageTime);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatMarkdown(text) {
        // Convert markdown to HTML for better formatting
        let formatted = text
            // Convert numbered lists
            .replace(/^(\d+\.\s+\*\*)(.*?)(\*\*)/gm, '<div class="list-item"><strong>$2</strong>')
            // Convert bold text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Convert links with proper formatting
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            // Convert line breaks
            .replace(/\n/g, '<br>')
            // Close list items
            .replace(/(<div class="list-item">.*?)<br>/g, '$1</div>');
        
        return formatted;
    }

    formatTime(date) {
        return date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.loadingOverlay.classList.add('show');
            this.sendButton.disabled = true;
            this.messageInput.disabled = true;
        } else {
            this.loadingOverlay.classList.remove('show');
            this.sendButton.disabled = false;
            this.messageInput.disabled = false;
            this.messageInput.focus();
        }
    }
}

// Health check function
async function checkHealth() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        console.log('Health check:', data);
    } catch (error) {
        console.error('Health check failed:', error);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
    checkHealth();
});

// Service Worker registration (optional, for offline support)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}