'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  PhoneIcon,
  UserCircleIcon,
  PaperAirplaneIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  SparklesIcon,
  BuildingOfficeIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { useForm } from 'react-hook-form';
import { Toaster, toast } from 'react-hot-toast';
import { contactApi, ContactFormData as ApiContactFormData } from '../../../lib/contactApi';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'technical' | 'billing' | 'feature' | 'general';
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai' | 'support';
  timestamp: Date;
  typing?: boolean;
}

export default function ContactPage() {
  const [activeTab, setActiveTab] = useState('contact-form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Initialize chat session when switching to chat tabs
  useEffect(() => {
    if ((activeTab === 'live-chat' || activeTab === 'ai-assistant') && !currentSessionId) {
      initializeChatSession();
    }
  }, [activeTab, currentSessionId]);

  const initializeChatSession = async () => {
    try {
      const session = await contactApi.createChatSession();
      setCurrentSessionId(session.sessionId);
      
      // Load chat history if any
      const history = await contactApi.getChatHistory(session.sessionId);
      if (history.length > 0) {
        setChatMessages(history.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      }
    } catch (error) {
      console.error('Error initializing chat session:', error);
      toast.error('Failed to initialize chat session');
    }
  };

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<ContactFormData>();

  const tabs = [
    {
      id: 'contact-form',
      name: 'Contact Form',
      icon: EnvelopeIcon,
      description: 'Send us a detailed message'
    },
    {
      id: 'live-chat',
      name: 'Live Chat',
      icon: ChatBubbleLeftRightIcon,
      description: 'Chat with our support team'
    },
    {
      id: 'ai-assistant',
      name: 'AI Assistant',
      icon: SparklesIcon,
      description: 'Get instant help from AI'
    },
    {
      id: 'enterprise',
      name: 'Enterprise Support',
      icon: BuildingOfficeIcon,
      description: 'Premium support for enterprise'
    }
  ];

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' }
  ];

  const categoryOptions = [
    { value: 'technical', label: 'Technical Support' },
    { value: 'billing', label: 'Billing & Payments' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'general', label: 'General Inquiry' }
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    
    try {
      await contactApi.submitContactForm(data as ApiContactFormData);
      
      setSubmitSuccess(true);
      reset();
      toast.success('Your message has been sent successfully!');
      
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (error) {
      console.error('Error submitting contact form:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !currentSessionId) return;

    const messageContent = chatInput;
    setChatInput('');
    setIsTyping(true);

    try {
      // Send message to API
      const response = await contactApi.sendChatMessage(currentSessionId, messageContent);
      
      // Add user message
      setChatMessages(prev => [...prev, {
        ...response.userMessage,
        timestamp: new Date(response.userMessage.timestamp)
      }]);

      setIsTyping(false);
      
      // Show AI typing indicator if there's an AI response
      if (response.aiResponse) {
        setAiTyping(true);
        
        // Simulate typing delay for better UX
        setTimeout(() => {
          setAiTyping(false);
          setChatMessages(prev => [...prev, {
            ...response.aiResponse!,
            timestamp: new Date(response.aiResponse!.timestamp)
          }]);
        }, 1500);
      }
    } catch (error) {
      console.error('Error sending chat message:', error);
      setIsTyping(false);
      toast.error('Failed to send message');
    }
  };

  const getAIResponse = (input: string): string => {
    const responses = [
      "I understand your concern. Let me help you with that. Can you provide more details about the issue you're experiencing?",
      "That's a great question! Based on your subscription tier, here are the available options...",
      "I can help you troubleshoot this issue. Let's start by checking your account settings.",
      "For billing-related questions, I recommend checking your Usage & Billing page in the dashboard. Would you like me to guide you there?",
      "This seems like a technical issue. I'm connecting you with our technical support team who can provide more detailed assistance."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Contact & Support
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Get help when you need it. Choose from multiple support channels to get the assistance you need.
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mb-8"
        >
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 justify-center">
              {tabs.map((tab) => (
                <motion.button
                  key={tab.id}
                  variants={itemVariants}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className={`mr-2 h-5 w-5 ${
                    activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`} />
                  <div className="text-left">
                    <div>{tab.name}</div>
                    <div className="text-xs text-gray-400">{tab.description}</div>
                  </div>
                </motion.button>
              ))}
            </nav>
          </div>
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'contact-form' && (
            <motion.div
              key="contact-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-8">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* Name and Email Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <input
                        {...register('name', { required: 'Name is required' })}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                          errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="Enter your full name"
                      />
                      <AnimatePresence>
                        {errors.name && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-1 text-sm text-red-600 flex items-center"
                          >
                            <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                            {errors.name.message}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        {...register('email', { 
                          required: 'Email is required',
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: 'Invalid email address'
                          }
                        })}
                        type="email"
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                          errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="Enter your email address"
                      />
                      <AnimatePresence>
                        {errors.email && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-1 text-sm text-red-600 flex items-center"
                          >
                            <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                            {errors.email.message}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>

                  {/* Category and Priority Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category *
                      </label>
                      <select
                        {...register('category', { required: 'Category is required' })}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                          errors.category ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select a category</option>
                        {categoryOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <AnimatePresence>
                        {errors.category && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-1 text-sm text-red-600 flex items-center"
                          >
                            <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                            {errors.category.message}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority *
                      </label>
                      <select
                        {...register('priority', { required: 'Priority is required' })}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                          errors.priority ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select priority</option>
                        {priorityOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <AnimatePresence>
                        {errors.priority && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-1 text-sm text-red-600 flex items-center"
                          >
                            <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                            {errors.priority.message}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>

                  {/* Subject */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject *
                    </label>
                    <input
                      {...register('subject', { required: 'Subject is required' })}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                        errors.subject ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="Brief description of your inquiry"
                    />
                    <AnimatePresence>
                      {errors.subject && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="mt-1 text-sm text-red-600 flex items-center"
                        >
                          <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                          {errors.subject.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Message */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message *
                    </label>
                    <textarea
                      {...register('message', { required: 'Message is required' })}
                      rows={6}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none ${
                        errors.message ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="Please provide detailed information about your inquiry..."
                    />
                    <AnimatePresence>
                      {errors.message && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="mt-1 text-sm text-red-600 flex items-center"
                        >
                          <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                          {errors.message.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Submit Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                  >
                    <motion.button
                      type="submit"
                      disabled={isSubmitting || submitSuccess}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                        submitSuccess
                          ? 'bg-green-500 text-white'
                          : isSubmitting
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        {isSubmitting ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"
                            />
                            Sending...
                          </>
                        ) : submitSuccess ? (
                          <>
                            <CheckCircleIcon className="h-5 w-5 mr-2" />
                            Message Sent!
                          </>
                        ) : (
                          <>
                            <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                            Send Message
                          </>
                        )}
                      </div>
                    </motion.button>
                  </motion.div>
                </form>
              </div>
            </motion.div>
          )}

          {(activeTab === 'live-chat' || activeTab === 'ai-assistant') && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-4xl mx-auto"
            >
              <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg overflow-hidden">
                {/* Chat Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {activeTab === 'ai-assistant' ? (
                        <SparklesIcon className="h-6 w-6 text-white mr-3" />
                      ) : (
                        <ChatBubbleLeftRightIcon className="h-6 w-6 text-white mr-3" />
                      )}
                      <div>
                        <h3 className="text-white font-semibold">
                          {activeTab === 'ai-assistant' ? 'AI Assistant' : 'Live Support Chat'}
                        </h3>
                        <p className="text-blue-100 text-sm">
                          {activeTab === 'ai-assistant' 
                            ? 'Get instant answers to your questions'
                            : 'Connected to support team'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-400 rounded-full mr-2"></div>
                      <span className="text-white text-sm">Online</span>
                    </div>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="h-96 overflow-y-auto p-4 space-y-4">
                  <AnimatePresence>
                    {chatMessages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.sender === 'user'
                            ? 'bg-blue-600 text-white'
                            : message.sender === 'ai'
                            ? 'bg-purple-100 text-purple-900'
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <div className="flex items-start">
                            {message.sender !== 'user' && (
                              <div className="mr-2 mt-1">
                                {message.sender === 'ai' ? (
                                  <SparklesIcon className="h-4 w-4" />
                                ) : (
                                  <UserCircleIcon className="h-4 w-4" />
                                )}
                              </div>
                            )}
                            <div>
                              <p className="text-sm">{message.content}</p>
                              <p className={`text-xs mt-1 ${
                                message.sender === 'user' ? 'text-blue-200' : 'text-gray-500'
                              }`}>
                                {message.timestamp.toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Typing Indicators */}
                  <AnimatePresence>
                    {(isTyping || aiTyping) && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex justify-start"
                      >
                        <div className="bg-gray-100 rounded-lg px-4 py-2 flex items-center">
                          <div className="flex space-x-1">
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                              className="w-2 h-2 bg-gray-400 rounded-full"
                            />
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                              className="w-2 h-2 bg-gray-400 rounded-full"
                            />
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                              className="w-2 h-2 bg-gray-400 rounded-full"
                            />
                          </div>
                          <span className="ml-2 text-sm text-gray-500">
                            {activeTab === 'ai-assistant' ? 'AI is typing...' : 'Support is typing...'}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <div className="border-t border-gray-200 p-4">
                  <div className="flex items-center space-x-2">
                    <input
                      ref={chatInputRef}
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={sendChatMessage}
                      disabled={!chatInput.trim() || isTyping || aiTyping}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <PaperAirplaneIcon className="h-5 w-5" />
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'enterprise' && (
            <motion.div
              key="enterprise"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-4xl mx-auto"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Enterprise Support Info */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-8 text-white"
                >
                  <div className="flex items-center mb-6">
                    <BuildingOfficeIcon className="h-8 w-8 mr-3" />
                    <h3 className="text-2xl font-bold">Enterprise Support</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 mr-3 mt-1 text-green-300" />
                      <div>
                        <h4 className="font-semibold">Dedicated Account Manager</h4>
                        <p className="text-purple-100 text-sm">Personal support representative for your account</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 mr-3 mt-1 text-green-300" />
                      <div>
                        <h4 className="font-semibold">24/7 Priority Support</h4>
                        <p className="text-purple-100 text-sm">Round-the-clock assistance with guaranteed response times</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 mr-3 mt-1 text-green-300" />
                      <div>
                        <h4 className="font-semibold">Custom Integration Support</h4>
                        <p className="text-purple-100 text-sm">Help with complex integrations and custom solutions</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 mr-3 mt-1 text-green-300" />
                      <div>
                        <h4 className="font-semibold">Training & Onboarding</h4>
                        <p className="text-purple-100 text-sm">Comprehensive training for your team</p>
                      </div>
                    </div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-8 p-4 bg-white/10 rounded-lg backdrop-blur-sm"
                  >
                    <div className="flex items-center mb-2">
                      <ClockIcon className="h-5 w-5 mr-2" />
                      <span className="font-semibold">Response Times</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Critical Issues:</span>
                        <span className="font-semibold">15 minutes</span>
                      </div>
                      <div className="flex justify-between">
                        <span>High Priority:</span>
                        <span className="font-semibold">1 hour</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Standard:</span>
                        <span className="font-semibold">4 hours</span>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* Contact Information */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-6"
                >
                  <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Direct Contact</h4>
                    
                    <div className="space-y-4">
                      <motion.div
                        whileHover={{ x: 4 }}
                        className="flex items-center p-3 bg-blue-50 rounded-lg"
                      >
                        <EnvelopeIcon className="h-5 w-5 text-blue-600 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900">Email</p>
                          <p className="text-sm text-gray-600">enterprise@bulkemail.com</p>
                        </div>
                      </motion.div>
                      
                      <motion.div
                        whileHover={{ x: 4 }}
                        className="flex items-center p-3 bg-green-50 rounded-lg"
                      >
                        <PhoneIcon className="h-5 w-5 text-green-600 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900">Phone</p>
                          <p className="text-sm text-gray-600">+1 (555) 123-4567</p>
                        </div>
                      </motion.div>
                      
                      <motion.div
                        whileHover={{ x: 4 }}
                        className="flex items-center p-3 bg-purple-50 rounded-lg"
                      >
                        <ChatBubbleLeftRightIcon className="h-5 w-5 text-purple-600 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900">Dedicated Slack Channel</p>
                          <p className="text-sm text-gray-600">Available after onboarding</p>
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white cursor-pointer"
                  >
                    <h4 className="text-lg font-semibold mb-2">Schedule a Call</h4>
                    <p className="text-blue-100 mb-4">
                      Book a personalized demo and consultation with our enterprise team
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="bg-white text-blue-600 px-6 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                    >
                      Book Demo Call
                    </motion.button>
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          },
        }}
      />
    </div>
  );
}