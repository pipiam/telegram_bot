"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Calendar, Clock, User, AlertCircle, RefreshCw, Trash2, Download } from 'lucide-react';

const TelegramMessagesDashboard = () => {
  const [messages, setMessages] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date().toDateString());
  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdateId, setLastUpdateId] = useState(0);

  const messagesEndRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  // Read token/chatId from env
  const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;
  const pollingInterval = 2000;

  // Auto scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Update date every day
  useEffect(() => {
    const interval = setInterval(() => {
      const newDate = new Date().toDateString();
      if (newDate !== currentDate) {
        setCurrentDate(newDate);
        setMessages([]);
        setLastUpdateId(0);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [currentDate]);

  const isToday = useCallback((timestamp) => {
    return new Date(timestamp * 1000).toDateString() === currentDate;
  }, [currentDate]);

  const formatMessage = useCallback((update) => {
    const message = update.message;
    if (!message || !isToday(message.date)) return null;

    let text = message.text || '';
    if (!text) {
      if (message.photo) text = '[Photo]';
      else if (message.video) text = '[Video]';
      else if (message.document) text = `[Document: ${message.document.file_name || 'File'}]`;
      else text = '[Media/File]';
    }

    return {
      id: message.message_id,
      text,
      author: message.from.first_name + (message.from.last_name ? ' ' + message.from.last_name : ''),
      username: message.from.username || '',
      timestamp: message.date * 1000,
      date: new Date(message.date * 1000).toDateString(),
      type: message.photo ? 'photo' : message.video ? 'video' : message.document ? 'document' : 'text'
    };
  }, [isToday]);

  const fetchTelegramUpdates = useCallback(async () => {
    if (!botToken || !chatId || !isPolling) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}&limit=100&timeout=30`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);
      const data = await response.json();

      if (data.ok && data.result.length > 0) {
        let maxUpdateId = lastUpdateId;
        const newMessages = [];

        data.result.forEach(update => {
          if (update.update_id > maxUpdateId) maxUpdateId = update.update_id;
          if (update.message && update.message.chat.id.toString() === chatId.toString() && isToday(update.message.date)) {
            const formatted = formatMessage(update);
            if (formatted) newMessages.push(formatted);
          }
        });

        setLastUpdateId(maxUpdateId);
        if (newMessages.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
            return [...prev, ...uniqueNew].sort((a, b) => a.timestamp - b.timestamp);
          });
        }
      }

      setIsConnected(true);
      setError(null);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Request timeout, retrying...');
      } else {
        setError(err.message);
        setIsConnected(false);
      }
    }
  }, [botToken, chatId, lastUpdateId, isToday, formatMessage, isPolling]);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    setIsPolling(true);
    fetchTelegramUpdates();
    pollingIntervalRef.current = setInterval(fetchTelegramUpdates, pollingInterval);
  }, [fetchTelegramUpdates, pollingInterval]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
    setIsConnected(false);
  }, []);

  useEffect(() => {
    startPolling(); // auto connect
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const todaysMessages = messages.filter(m => m.date === currentDate);
  const formatTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-t-2xl shadow-lg p-6 border-b border-gray-200 flex justify-between">
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
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{currentDate}</span>
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-yellow-500'} ${isPolling ? 'animate-pulse' : ''}`} />
          </div>
        </div>

        {/* Messages */}
        <div className="bg-white shadow-lg max-h-96 overflow-y-auto">
          <div className="p-6 space-y-4">
            {todaysMessages.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No messages yet today</p>
              </div>
            ) : (
              todaysMessages.map((message) => (
                <div key={message.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg">
                  <div className="bg-blue-100 p-2 rounded-full flex-shrink-0">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1 flex-wrap">
                      <span className="font-semibold text-gray-800">{message.author}</span>
                      {message.username && <span className="text-sm text-gray-500">@{message.username}</span>}
                      <div className="flex items-center space-x-1 text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">{formatTime(message.timestamp)}</span>
                      </div>
                    </div>
                    <p className="text-gray-700 break-words whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelegramMessagesDashboard;
