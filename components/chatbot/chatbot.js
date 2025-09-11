// TravixChatbot.js - Final Version (with position adjustment)
class TravixChatbot {
    constructor() {
        this.isOpen = false;
        this.isMinimized = false;
        this.messages = [
            {
                id: 1,
                text: "🙏 Namaste! I'm Aira, your Travix AI assistant. I'm here to help you with safety information, location guidance, and travel assistance. How can I help you today?",
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString()
            }
        ];
        this.isTyping = false;
        this.messageId = 2;
        this.init();
    }

    init() {
        this.createChatbotHTML();
        this.attachEventListeners();
        this.adjustPositionForPageElements(); // <-- NEW: Call the position adjustment method on init
    }

    // =================================================================================
    // NEW METHOD TO ADJUST CHATBOT POSITION
    // =================================================================================
    adjustPositionForPageElements() {
        // IMPORTANT: Replace '.caution-area-box' with the actual class or ID of your warning bar container.
        // For example, if your bar has an id="zone-warning", use '#zone-warning'.
        const warningBarSelector = '.caution-area-box';
        const warningBar = document.querySelector(warningBarSelector);
        const chatbotWrapper = document.querySelector('.chatbot-wrapper');

        // Check if both the warning bar and chatbot exist on the page
        if (warningBar && chatbotWrapper) {
            // Also check if the bar is currently visible
            const barStyles = window.getComputedStyle(warningBar);
            if (barStyles.display !== 'none' && barStyles.visibility !== 'hidden') {
                const barHeight = warningBar.offsetHeight;
                const originalBottomOffset = 20; // This is the 'bottom: 20px' from your CSS
                const margin = 15; // Extra space between the bar and the bot button

                // Calculate the new bottom position and apply it
                const newBottomPosition = barHeight + originalBottomOffset + margin;
                chatbotWrapper.style.bottom = `${newBottomPosition}px`;
            }
        }
    }
    // =================================================================================


    createChatbotHTML() {
        const chatbotContainer = document.createElement('div');
        chatbotContainer.className = 'chatbot-wrapper';
        chatbotContainer.innerHTML = `
            <button id="chat-toggle-btn" class="chat-toggle-btn">
                <i class="fas fa-comments"></i>
                <div class="notification-dot"></div>
                <div class="tooltip">Chat with Aira AI</div>
            </button>

            <div id="chat-window" class="chat-window hidden">
                <div class="chat-header">
                    <div class="bot-info">
                        <div class="bot-avatar">
                            <i class="fas fa-robot"></i>
                            <div class="online-indicator"></div>
                        </div>
                        <div class="bot-details">
                            <h3>Aira AI Assistant</h3>
                            <p>Online • Travix Safety Bot</p>
                        </div>
                    </div>
                    <div class="header-controls">
                        <button id="minimize-btn" class="control-btn">
                            <i class="fas fa-minus"></i>
                        </button>
                        <button id="close-btn" class="control-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <div id="chat-content" class="chat-content">
                    <div class="quick-actions">
                        <button class="quick-action-btn" data-action="safety">
                            <i class="fas fa-shield-alt"></i>
                            <span>Check Safety</span>
                        </button>
                        <button class="quick-action-btn" data-action="zones">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>Find Safe Zones</span>
                        </button>
                        <button class="quick-action-btn" data-action="routes">
                            <i class="fas fa-route"></i>
                            <span>Travel Routes</span>
                        </button>
                        <button class="quick-action-btn" data-action="emergency">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>Emergency Help</span>
                        </button>
                    </div>

                    <div id="messages-container" class="messages-container">
                        </div>

                    <div class="chat-input">
                        <div class="input-wrapper">
                            <input type="text" id="message-input" placeholder="Ask about safety, routes, zones..." autocomplete="off">
                            <button id="send-btn" class="send-btn">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                        <p class="powered-by">Powered by Travix AI • Always here to help with your safety</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(chatbotContainer);
        this.renderMessages();
    }

    attachEventListeners() {
        const toggleBtn = document.getElementById('chat-toggle-btn');
        const closeBtn = document.getElementById('close-btn');
        const minimizeBtn = document.getElementById('minimize-btn');
        const sendBtn = document.getElementById('send-btn');
        const messageInput = document.getElementById('message-input');
        const quickActionBtns = document.querySelectorAll('.quick-action-btn');

        toggleBtn.addEventListener('click', () => this.toggleChat());
        closeBtn.addEventListener('click', () => this.closeChat());
        minimizeBtn.addEventListener('click', () => this.minimizeChat());
        sendBtn.addEventListener('click', () => this.sendMessage());
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        quickActionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleQuickAction(action);
            });
        });
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        const chatWindow = document.getElementById('chat-window');
        const toggleBtn = document.getElementById('chat-toggle-btn');
        
        if (this.isOpen) {
            chatWindow.classList.remove('hidden');
            toggleBtn.style.display = 'none';
            this.scrollToBottom();
        } else {
            chatWindow.classList.add('hidden');
            toggleBtn.style.display = 'flex';
        }
    }

    closeChat() {
        this.isOpen = false;
        this.isMinimized = false;
        const chatWindow = document.getElementById('chat-window');
        const toggleBtn = document.getElementById('chat-toggle-btn');
        
        chatWindow.classList.add('hidden');
        chatWindow.classList.remove('minimized');
        toggleBtn.style.display = 'flex';
    }

    minimizeChat() {
        this.isMinimized = !this.isMinimized;
        const chatWindow = document.getElementById('chat-window');
        const chatContent = document.getElementById('chat-content');
        const minimizeIcon = document.querySelector('#minimize-btn i');
        
        if (this.isMinimized) {
            chatWindow.classList.add('minimized');
            chatContent.style.display = 'none';
            minimizeIcon.className = 'fas fa-expand';
        } else {
            chatWindow.classList.remove('minimized');
            chatContent.style.display = 'flex';
            minimizeIcon.className = 'fas fa-minus';
            this.scrollToBottom();
        }
    }

    async sendMessage() {
        const input = document.getElementById('message-input');
        const userMessage = input.value.trim();
        
        if (!userMessage) return;

        this.addMessage({
            id: this.messageId++,
            text: userMessage,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString()
        });

        input.value = '';
        this.showTyping();
        
        try {
            const response = await this.getAiResponse(userMessage);
            this.hideTyping();
            this.addMessage({
                id: this.messageId++,
                text: response,
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString()
            });
        } catch (error) {
            console.error('Error fetching AI response:', error);
            this.hideTyping();
            this.addMessage({
                id: this.messageId++,
                text: "Sorry, I'm having trouble connecting right now. Please try again later.",
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString()
            });
        }
    }

    async handleQuickAction(action) {
        const messages = {
            safety: "Tell me about safety in my current location.",
            zones: "Show me safe zones near me.",
            routes: "What are the safest travel routes?",
            emergency: "I need emergency help."
        };
        const message = messages[action];
        
        this.addMessage({
            id: this.messageId++,
            text: message,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString()
        });
        
        this.showTyping();
        
        try {
            const response = await this.getAiResponse(message);
            this.hideTyping();
            this.addMessage({
                id: this.messageId++,
                text: response,
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString()
            });
        } catch (error) {
            console.error('Error fetching AI response:', error);
            this.hideTyping();
            this.addMessage({
                id: this.messageId++,
                text: "Sorry, I'm having trouble with that request. Please try typing a message instead.",
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString()
            });
        }
    }

    async getAiResponse(userMessage) {
        const backendUrl = 'http://localhost:3000/chat';
        
        const res = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: userMessage })
        });

        if (!res.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await res.json();
        return data.response;
    }

    addMessage(message) {
        this.messages.push(message);
        this.renderMessages();
        this.scrollToBottom();
    }

    renderMessages() {
        const container = document.getElementById('messages-container');
        container.innerHTML = '';

        this.messages.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${message.sender}`;
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas ${message.sender === 'user' ? 'fa-user' : 'fa-robot'}"></i>
                </div>
                <div class="message-content">
                    <div class="message-text">${message.text}</div>
                    <div class="message-time">
                        <i class="fas fa-clock"></i>
                        ${message.timestamp}
                    </div>
                </div>
            `;
            container.appendChild(messageDiv);
        });
    }

    showTyping() {
        this.isTyping = true;
        const container = document.getElementById('messages-container');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot typing-message';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        container.appendChild(typingDiv);
        this.scrollToBottom();
    }



    hideTyping() {
        this.isTyping = false;
        const typingMessage = document.querySelector('.typing-message');
        if (typingMessage) {
            typingMessage.remove();
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            const container = document.getElementById('messages-container');
            container.scrollTop = container.scrollHeight;
        }, 100);
    }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        new TravixChatbot();
    }, 1000);
});
