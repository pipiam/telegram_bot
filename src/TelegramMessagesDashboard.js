import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Calendar, Clock, User, Settings, AlertCircle, RefreshCw, Trash2, Download } from 'lucide-react';

const TelegramMessagesDashboard = () => {
  const [messages, setMessages] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date().toDateString());
  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdateId, setLastUpdateId] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [pollingInterval, setPollingInterval] = useState(2000);
  const messagesEndRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  // Auto scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Update current date every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const newDate = new Date().toDateString();
      if (newDate !== currentDate) {
        setCurrentDate(newDate);
        // Clear messages when date changes to show only today's messages
        setMessages([]);
        setLastUpdateId(0); // Reset update ID for new day
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [currentDate]);

  // Check if message is from today
  const isToday = useCallback((timestamp) => {
    const messageDate = new Date(timestamp * 1000).toDateString();
    return messageDate === currentDate;
  }, [currentDate]);

  // Format message from Telegram API response
  const formatMessage = useCallback((update) => {
    const message = update.message;
    if (!message || !isToday(message.date)) return null;

    // Handle different message types
    let text = message.text || '';
    if (!text) {
      if (message.photo) text = '[Photo]';
      else if (message.video) text = '[Video]';
      else if (message.audio) text = '[Audio]';
      else if (message.document) text = `[Document: ${message.document.file_name || 'File'}]`;
      else if (message.sticker) text = '[Sticker]';
      else if (message.voice) text = '[Voice Message]';
      else if (message.location) text = '[Location]';
      else text = '[Media/File]';
    }

    return {
      id: message.message_id,
      text: text,
      author: message.from.first_name + (message.from.last_name ? ' ' + message.from.last_name : ''),
      username: message.from.username || '',
      timestamp: message.date * 1000,
      date: new Date(message.date * 1000).toDateString(),
      type: message.photo ? 'photo' : message.video ? 'video' : message.document ? 'document' : 'text'
    };
  }, [isToday]);

  // Fetch updates from Telegram API
  const fetchTelegramUpdates = useCallback(async () => {
    if (!botToken || !chatId || !isPolling) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000); // 35 second timeout

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}&limit=100&timeout=30`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.description || 'Telegram API error');
      }

      if (data.result.length > 0) {
        const newMessages = [];
        let maxUpdateId = lastUpdateId;

        data.result.forEach(update => {
          if (update.update_id > maxUpdateId) {
            maxUpdateId = update.update_id;
          }

          // Check if the message is from the specified chat and is from today
          if (update.message && 
              update.message.chat.id.toString() === chatId.toString() && 
              isToday(update.message.date)) {
            
            const formattedMessage = formatMessage(update);
            if (formattedMessage) {
              newMessages.push(formattedMessage);
            }
          }
        });

        setLastUpdateId(maxUpdateId);

        if (newMessages.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(msg => msg.id));
            const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
            return [...prev, ...uniqueNewMessages].sort((a, b) => a.timestamp - b.timestamp);
          });
        }
      }

      setIsConnected(true);
      setError(null);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Request timeout, retrying...');
      } else {
        console.error('Error fetching Telegram updates:', err);
        setError(err.message);
        setIsConnected(false);
      }
    }
  }, [botToken, chatId, lastUpdateId, isToday, formatMessage, isPolling]);

  // Start polling for updates
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    setIsPolling(true);
    setError(null);
    fetchTelegramUpdates(); // Initial fetch
    pollingIntervalRef.current = setInterval(fetchTelegramUpdates, pollingInterval);
  }, [fetchTelegramUpdates, pollingInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
    setIsConnected(false);
  }, []);

  // Handle settings save
  const handleSaveSettings = () => {
    if (botToken && chatId) {
      setShowSettings(false);
      startPolling();
    }
  };

  // Clear messages
  const clearMessages = () => {
    setMessages([]);
    setLastUpdateId(0);
  };

  // Export messages as JSON
  const exportMessages = () => {
    const dataStr = JSON.stringify(todaysMessages, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `telegram-messages-${currentDate.replace(/\s/g, '-')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Manual refresh
  const handleManualRefresh = () => {
    if (isPolling) {
      fetchTelegramUpdates();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Start polling when tokens are available
  useEffect(() => {
    if (botToken && chatId && !pollingIntervalRef.current) {
      startPolling();
    }
  }, [botToken, chatId, startPolling]);

  // Filter messages for current date
  const todaysMessages = messages.filter(msg => msg.date === currentDate);

  // Format time
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get message type icon
  const getMessageTypeIcon = (type) => {
    switch (type) {
      case 'photo': return '📷';
      case 'video': return '🎥';
      case 'document': return '📄';
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-t-2xl shadow-lg p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-500 p-3 rounded-full">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Live Telegram Messages</h1>
                <p className="text-gray-600">Real-time messages from your Telegram group</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handleManualRefresh}
                disabled={!isPolling}
                className="bg-gray-100 hover:bg-gray-200 disabled:opacity-50 p-2 rounded-lg transition-colors"
                title="Manual refresh"
              >
                <RefreshCw className={`w-4 h-4 text-gray-600 ${isPolling && isConnected ? 'animate-spin' : ''}`} />
              </button>
              
              <button
                onClick={clearMessages}
                className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg transition-colors"
                title="Clear messages"
              >
                <Trash2 className="w-4 h-4 text-gray-600" />
              </button>
              
              <button
                onClick={exportMessages}
                disabled={todaysMessages.length === 0}
                className="bg-gray-100 hover:bg-gray-200 disabled:opacity-50 p-2 rounded-lg transition-colors"
                title="Export messages"
              >
                <Download className="w-4 h-4 text-gray-600" />
              </button>
              
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
              
              <div className="flex items-center space-x-2 bg-gray-100 px-3 py-2 rounded-lg">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{currentDate}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-yellow-500'
                } ${isPolling ? 'animate-pulse' : ''}`}></div>
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : error ? 'Error' : isPolling ? 'Connecting...' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Telegram Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bot Token</label>
                  <input
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="Enter your Telegram bot token"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Chat ID</label>
                  <input
                    type="text"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="Enter your group chat ID"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Polling Interval (ms): {pollingInterval}
                  </label>
                  <input
                    type="range"
                    min="1000"
                    max="10000"
                    step="500"
                    value={pollingInterval}
                    onChange={(e) => setPollingInterval(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1s</span>
                    <span>10s</span>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleSaveSettings}
                    disabled={!botToken || !chatId}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Connect
                  </button>
                  <button
                    onClick={stopPolling}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}
        </div>

        {/* Messages Container */}
        <div className="bg-white shadow-lg max-h-96 overflow-y-auto">
          <div className="p-6 space-y-4">
            {!botToken || !chatId ? (
              <div className="text-center py-8">
                <Settings className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Please configure your Telegram bot settings above</p>
              </div>
            ) : todaysMessages.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">
                  {isConnected ? "No messages for today yet" : isPolling ? "Connecting to Telegram..." : "Click Connect to start"}
                </p>
              </div>
            ) : (
              todaysMessages.map((message) => (
                <div key={message.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="bg-blue-100 p-2 rounded-full flex-shrink-0">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1 flex-wrap">
                      <span className="font-semibold text-gray-800">{message.author}</span>
                      {message.username && (
                        <span className="text-sm text-gray-500">@{message.username}</span>
                      )}
                      <div className="flex items-center space-x-1 text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">{formatTime(message.timestamp)}</span>
                      </div>
                      {getMessageTypeIcon(message.type) && (
                        <span className="text-sm">{getMessageTypeIcon(message.type)}</span>
                      )}
                    </div>
                    
                    <p className="text-gray-700 break-words whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-b-2xl shadow-lg p-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Today's Activity</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-xl">
              <div className="text-2xl font-bold text-blue-600">{todaysMessages.length}</div>
              <div className="text-sm text-blue-800">Messages Today</div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-xl">
              <div className="text-2xl font-bold text-green-600">
                {new Set(todaysMessages.map(m => m.author)).size}
              </div>
              <div className="text-sm text-green-800">Active Users</div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-xl">
              <div className="text-2xl font-bold text-purple-600">
                {todaysMessages.length > 0 ? formatTime(todaysMessages[todaysMessages.length - 1].timestamp) : '--:--'}
              </div>
              <div className="text-sm text-purple-800">Last Message</div>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-xl">
              <div className="text-2xl font-bold text-orange-600">
                {todaysMessages.filter(m => m.type !== 'text').length}
              </div>
              <div className="text-sm text-orange-800">Media Files</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelegramMessagesDashboard;