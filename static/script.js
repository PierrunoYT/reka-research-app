class ChatApp {
    constructor() {
        this.messages = [];
        this.sessionId = null;
        this.currentSessionHistory = [];
        this.allSessions = [];
        this.searchResults = [];
        this.useStreaming = true; // Enable streaming by default
        this.currentStreamingMessage = null;
        this.progressInterval = null;
        this.initializeElements();
        this.setupEventListeners();
        this.setupTextareaAutoResize();
        this.loadInitialData();
    }

    initializeElements() {
        this.chatForm = document.getElementById('chatForm');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatMessages = document.getElementById('chatMessages');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        // History elements
        this.historySidebar = document.getElementById('historySidebar');
        this.historyToggle = document.getElementById('historyToggle');
        this.historyList = document.getElementById('historyList');
        this.historyLoading = document.getElementById('historyLoading');
        this.historyEmpty = document.getElementById('historyEmpty');
        this.searchInput = document.getElementById('searchInput');
        this.searchButton = document.getElementById('searchButton');
        this.newSessionButton = document.getElementById('newSessionButton');
        this.clearHistoryButton = document.getElementById('clearHistory');
        this.resetDatabaseButton = document.getElementById('resetDatabase');
        this.sessionInfo = document.getElementById('sessionInfo');
        
        // Stats elements
        this.totalQueries = document.getElementById('totalQueries');
        this.totalSessions = document.getElementById('totalSessions');
        
        // Loading elements
        this.loadingText = document.getElementById('loadingText');
        this.progressSteps = document.getElementById('progressSteps');
        this.progressFill = document.getElementById('progressFill');
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

        // History panel events
        this.historyToggle.addEventListener('click', () => this.toggleHistoryPanel());
        this.newSessionButton.addEventListener('click', () => this.startNewSession());
        this.clearHistoryButton.addEventListener('click', () => this.clearAllHistory());
        this.resetDatabaseButton.addEventListener('click', () => this.resetDatabase());
        
        // Search events
        this.searchButton.addEventListener('click', () => this.performSearch());
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });
        
        this.searchInput.addEventListener('input', (e) => {
            if (e.target.value === '') {
                this.loadHistory();
            }
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
        if (this.useStreaming) {
            return this.sendStreamingMessage(message);
        }
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                messages: this.messages,
                session_id: this.sessionId,
                stream: false
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

    async sendStreamingMessage(message) {
        return new Promise(async (resolve, reject) => {
            try {
                // Add empty assistant message for streaming
                this.currentStreamingMessage = this.addStreamingMessage();
                
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: message,
                        messages: this.messages,
                        session_id: this.sessionId,
                        stream: true
                    })
                });

                if (!response.ok) {
                    this.removeStreamingMessage();
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let streamingContent = '';
                let sessionId = null;
                let finalMessages = null;

                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6);
                            
                            if (dataStr === '[DONE]') {
                                this.finalizeStreamingMessage();
                                resolve({
                                    success: true,
                                    response: streamingContent,
                                    session_id: sessionId,
                                    messages: finalMessages
                                });
                                return;
                            }
                            
                            try {
                                const data = JSON.parse(dataStr);
                                
                                switch (data.type) {
                                    case 'start':
                                        sessionId = data.session_id;
                                        this.sessionId = sessionId;
                                        break;
                                        
                                    case 'content':
                                        streamingContent += data.content;
                                        this.updateStreamingMessage(streamingContent);
                                        break;
                                        
                                    case 'complete':
                                        sessionId = data.session_id;
                                        finalMessages = data.messages;
                                        break;
                                        
                                    case 'error':
                                        this.removeStreamingMessage();
                                        reject(new Error(data.error));
                                        return;
                                }
                            } catch (error) {
                                console.error('Error parsing streaming data:', error);
                            }
                        }
                    }
                }
            } catch (error) {
                this.removeStreamingMessage();
                reject(error);
            }
        });
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

    addStreamingMessage() {
        const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant streaming-message';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = '<div class="typing-indicator"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = this.formatTime(new Date());
        
        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(messageTime);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        return messageDiv;
    }

    updateStreamingMessage(content) {
        if (this.currentStreamingMessage) {
            const messageContent = this.currentStreamingMessage.querySelector('.message-content');
            messageContent.innerHTML = this.formatMarkdown(content);
            this.scrollToBottom();
        }
    }

    finalizeStreamingMessage() {
        if (this.currentStreamingMessage) {
            this.currentStreamingMessage.classList.remove('streaming-message');
            this.currentStreamingMessage = null;
        }
    }

    removeStreamingMessage() {
        if (this.currentStreamingMessage) {
            this.currentStreamingMessage.remove();
            this.currentStreamingMessage = null;
        }
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.loadingOverlay.classList.add('show');
            this.sendButton.disabled = true;
            this.messageInput.disabled = true;
            this.startProgressAnimation();
        } else {
            this.loadingOverlay.classList.remove('show');
            this.sendButton.disabled = false;
            this.messageInput.disabled = false;
            this.messageInput.focus();
            this.stopProgressAnimation();
        }
    }

    startProgressAnimation() {
        const steps = ['step1', 'step2', 'step3', 'step4'];
        const messages = [
            'Analyzing your question...',
            'Searching the web...',
            'Processing results...',
            'Generating response...'
        ];
        
        let currentStep = 0;
        
        // Reset progress
        this.progressFill.style.width = '0%';
        steps.forEach(stepId => {
            const step = document.getElementById(stepId);
            step.classList.remove('active', 'completed');
        });

        this.progressInterval = setInterval(() => {
            if (currentStep < steps.length) {
                // Complete previous step
                if (currentStep > 0) {
                    const prevStep = document.getElementById(steps[currentStep - 1]);
                    prevStep.classList.remove('active');
                    prevStep.classList.add('completed');
                }
                
                // Activate current step
                const currentStepEl = document.getElementById(steps[currentStep]);
                currentStepEl.classList.add('active');
                
                // Update loading text
                this.loadingText.textContent = messages[currentStep];
                
                // Update progress bar
                const progress = ((currentStep + 1) / steps.length) * 100;
                this.progressFill.style.width = `${progress}%`;
                
                currentStep++;
            } else {
                // Reset to first step for continuous animation
                currentStep = 0;
                steps.forEach(stepId => {
                    const step = document.getElementById(stepId);
                    step.classList.remove('active', 'completed');
                });
            }
        }, 2000); // Change step every 2 seconds
    }

    stopProgressAnimation() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        
        // Complete all steps
        ['step1', 'step2', 'step3', 'step4'].forEach(stepId => {
            const step = document.getElementById(stepId);
            step.classList.remove('active');
            step.classList.add('completed');
        });
        
        this.progressFill.style.width = '100%';
        this.loadingText.textContent = 'Complete!';
    }

    // History Management Methods
    async loadInitialData() {
        try {
            await Promise.all([
                this.loadHistory(),
                this.loadStats()
            ]);
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    async loadHistory() {
        try {
            this.showHistoryLoading(true);
            const response = await fetch('/api/history');
            const data = await response.json();
            
            if (data.success) {
                this.allSessions = data.sessions;
                this.displayHistory(this.allSessions);
            } else {
                console.error('Failed to load history:', data.error);
            }
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            this.showHistoryLoading(false);
        }
    }

    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            const data = await response.json();
            
            if (data.success) {
                this.updateStats(data.stats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async performSearch() {
        const query = this.searchInput.value.trim();
        if (!query) {
            this.loadHistory();
            return;
        }

        try {
            this.showHistoryLoading(true);
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
            const data = await response.json();
            
            if (data.success) {
                this.searchResults = data.results;
                this.displaySearchResults(this.searchResults);
            } else {
                console.error('Search failed:', data.error);
            }
        } catch (error) {
            console.error('Error performing search:', error);
        } finally {
            this.showHistoryLoading(false);
        }
    }

    displayHistory(sessions) {
        if (!sessions || sessions.length === 0) {
            this.historyList.style.display = 'none';
            this.historyEmpty.style.display = 'block';
            return;
        }

        this.historyList.style.display = 'block';
        this.historyEmpty.style.display = 'none';

        this.historyList.innerHTML = sessions.map(session => `
            <div class="history-item ${session.session_id === this.sessionId ? 'active' : ''}" 
                 data-session-id="${session.session_id}" 
                 onclick="chatApp.loadSession('${session.session_id}')">
                <div class="history-item-header">
                    <div class="history-item-time">${this.formatDate(session.updated_at)}</div>
                </div>
                <div class="history-item-query">${session.last_query || 'New Session'}</div>
                <div class="history-item-preview">${session.query_count} queries</div>
            </div>
        `).join('');
    }

    displaySearchResults(results) {
        if (!results || results.length === 0) {
            this.historyList.innerHTML = '<div class="history-empty"><p>No results found</p></div>';
            return;
        }

        this.historyList.innerHTML = results.map(result => `
            <div class="history-item" 
                 data-session-id="${result.session_id}" 
                 onclick="chatApp.loadSession('${result.session_id}')">
                <div class="history-item-header">
                    <div class="history-item-time">${this.formatDate(result.created_at)}</div>
                </div>
                <div class="history-item-query">${result.query}</div>
                <div class="history-item-preview">${result.response.substring(0, 100)}...</div>
            </div>
        `).join('');
    }

    async loadSession(sessionId) {
        try {
            this.sessionId = sessionId;
            this.messages = [];
            
            // Update UI
            this.updateSessionInfo();
            this.clearChatMessages();
            
            // Load session history
            const response = await fetch(`/api/history/${sessionId}`);
            const data = await response.json();
            
            if (data.success && data.history.length > 0) {
                this.currentSessionHistory = data.history;
                
                // Display conversation
                for (const item of data.history) {
                    this.addMessage('user', item.query);
                    this.addMessage('assistant', item.response);
                    this.messages.push(
                        { role: 'user', content: item.query },
                        { role: 'assistant', content: item.response }
                    );
                }
            }
            
            // Update history display
            this.displayHistory(this.allSessions);
            
        } catch (error) {
            console.error('Error loading session:', error);
        }
    }

    startNewSession() {
        this.sessionId = null;
        this.messages = [];
        this.currentSessionHistory = [];
        this.clearChatMessages();
        this.updateSessionInfo();
        this.displayHistory(this.allSessions);
        this.messageInput.focus();
    }

    async clearAllHistory() {
        if (!confirm('Are you sure you want to clear all research history? This action cannot be undone.')) {
            return;
        }

        try {
            // Note: This would require a backend endpoint to clear history
            // For now, we'll just reload the page
            window.location.reload();
        } catch (error) {
            console.error('Error clearing history:', error);
        }
    }

    async resetDatabase() {
        const confirmation = confirm(
            'Are you sure you want to RESET the entire database?\n\n' +
            'This will permanently delete:\n' +
            '• All research history\n' +
            '• All saved sessions\n' +
            '• All statistics\n\n' +
            'This action cannot be undone!'
        );

        if (!confirmation) {
            return;
        }

        // Second confirmation for safety
        const finalConfirmation = confirm(
            'FINAL WARNING: You are about to permanently delete ALL data.\n\n' +
            'Type "RESET" and click OK to proceed, or Cancel to abort.'
        );

        if (!finalConfirmation) {
            return;
        }

        try {
            this.setLoading(true);
            
            const response = await fetch('/api/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    confirm: true
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('Database reset successfully! The page will now reload.');
                window.location.reload();
            } else {
                alert(`Failed to reset database: ${data.error}`);
            }
        } catch (error) {
            console.error('Error resetting database:', error);
            alert('An error occurred while resetting the database. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }

    toggleHistoryPanel() {
        this.historySidebar.classList.toggle('collapsed');
        
        // Update button icon
        const icon = this.historyToggle.querySelector('svg path');
        if (this.historySidebar.classList.contains('collapsed')) {
            icon.setAttribute('d', 'M3 12h18m-9-9l9 9-9 9');
        } else {
            icon.setAttribute('d', 'M3 12h18m-9-9l9 9-9 9');
        }
    }

    updateSessionInfo() {
        if (this.sessionId) {
            const session = this.allSessions.find(s => s.session_id === this.sessionId);
            if (session) {
                this.sessionInfo.textContent = `Session: ${session.query_count} queries`;
            } else {
                this.sessionInfo.textContent = 'Active Session';
            }
        } else {
            this.sessionInfo.textContent = 'New Session';
        }
    }

    updateStats(stats) {
        this.totalQueries.textContent = stats.total_queries || 0;
        this.totalSessions.textContent = stats.total_sessions || 0;
    }

    clearChatMessages() {
        const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
        this.chatMessages.innerHTML = '';
        if (!this.sessionId) {
            this.chatMessages.appendChild(welcomeMessage.cloneNode(true));
        }
    }

    showHistoryLoading(show) {
        this.historyLoading.style.display = show ? 'flex' : 'none';
        this.historyList.style.display = show ? 'none' : 'block';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }

    // Override the existing handleSubmit to refresh history after new messages
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
                
                // Refresh history and stats after new message
                await Promise.all([
                    this.loadHistory(),
                    this.loadStats()
                ]);
                
                this.updateSessionInfo();
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
let chatApp;
document.addEventListener('DOMContentLoaded', () => {
    chatApp = new ChatApp();
    checkHealth();
});

// Service Worker registration removed - not needed for current functionality
// Uncomment and create service-worker.js if offline support is desired in the future