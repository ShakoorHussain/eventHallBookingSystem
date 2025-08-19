import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../Styless/ChatBot.css';

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Load chat history from localStorage on component mount
  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('user');
    if (!userData) {
      // User is not logged in, clear chat history
      localStorage.removeItem('chatBotMessages');
      setMessages([{
        text: "Hello! I'm here to help you with marriage hall bookings. How can I assist you today?",
        sender: 'bot',
        timestamp: new Date().toISOString()
      }]);
      return;
    }

    const savedMessages = localStorage.getItem('chatBotMessages');
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
      } catch (error) {
        console.error('Error parsing saved messages:', error);
        // If there's an error, start with welcome message
        setMessages([{
          text: "Hello! I'm here to help you with marriage hall bookings. How can I assist you today?",
          sender: 'bot',
          timestamp: new Date().toISOString()
        }]);
      }
    } else {
      // No saved messages, start with welcome message
      setMessages([{
        text: "Hello! I'm here to help you with marriage hall bookings. How can I assist you today?",
        sender: 'bot',
        timestamp: new Date().toISOString()
      }]);
    }
  }, []);

  // Save messages to localStorage whenever messages change (only if user is logged in)
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData && messages.length > 0) {
      localStorage.setItem('chatBotMessages', JSON.stringify(messages));
    }
  }, [messages]);

  // Listen for logout events
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'user' && !e.newValue) {
        // User logged out, clear chat history
        localStorage.removeItem('chatBotMessages');
        setMessages([{
          text: "Hello! I'm here to help you with marriage hall bookings. How can I assist you today?",
          sender: 'bot',
          timestamp: new Date().toISOString()
        }]);
        setIsOpen(false); // Close chat window
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    // Check if user is logged in before allowing chat
    const userData = localStorage.getItem('user');
    if (!userData) {
      alert('Please login to use the chat feature.');
      return;
    }

    const userMessage = {
      text: input,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post('http://localhost:8081/geminiPrompt', {
        prompt: input
      });

      const botMessage = {
        text: response.data.result,
        sender: 'bot',
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        text: "Sorry, I'm having trouble connecting right now. Please try again later.",
        sender: 'bot',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChatHistory = () => {
    const welcomeMessage = {
      text: "Hello! I'm here to help you with marriage hall bookings. How can I assist you today?",
      sender: 'bot',
      timestamp: new Date().toISOString()
    };
    setMessages([welcomeMessage]);
    localStorage.removeItem('chatBotMessages');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Check if user is logged in to show chat
  const userData = localStorage.getItem('user');
  if (!userData) {
    return null; // Don't show chat if user is not logged in
  }

  return (
    <div className={`chatbot-container ${isOpen ? 'open' : ''}`}>
      <div 
        className="chatbot-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? '✕' : '💬'}
      </div>

      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <h4>Marriage Hall Assistant</h4>
            <button 
              className="clear-chat-btn"
              onClick={clearChatHistory}
              title="Clear chat history"
            >
              🗑️
            </button>
          </div>
          
          <div className="chatbot-messages">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`message ${message.sender}`}
              >
                <div className="message-text">
                  {message.text}
                </div>
                <div className="message-time">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="message bot">
                <div className="message-text">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-input">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
            />
            <button 
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBot;