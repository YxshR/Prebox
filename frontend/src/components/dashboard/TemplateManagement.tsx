'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DocumentTextIcon, 
  SparklesIcon, 
  EyeIcon, 
  PencilIcon,
  PlusIcon 
} from '@heroicons/react/24/outline';

interface Template {
  id: string;
  name: string;
  type: 'ai' | 'custom';
  category: string;
  thumbnail: string;
  lastModified: string;
}

interface TemplateManagementProps {
  userTier: string;
}

export default function TemplateManagement({ userTier }: TemplateManagementProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

  const getTierLimits = (tier: string) => {
    switch (tier) {
      case 'free':
        return { aiTemplates: 1, customTemplates: 'Unlimited' };
      case 'paid_standard':
        return { aiTemplates: 10, customTemplates: 'Unlimited' };
      case 'premium':
      case 'enterprise':
        return { aiTemplates: 'Unlimited', customTemplates: 'Unlimited' };
      default:
        return { aiTemplates: 1, customTemplates: 'Unlimited' };
    }
  };

  const limits = getTierLimits(userTier);
  const usage = { aiTemplates: 0, customTemplates: 3 }; // Mock usage

  // Mock template data
  const templates: Template[] = [
    {
      id: '1',
      name: 'Welcome Email',
      type: 'ai',
      category: 'Onboarding',
      thumbnail: 'bg-gradient-to-br from-blue-400 to-blue-600',
      lastModified: '2 hours ago'
    },
    {
      id: '2',
      name: 'Newsletter Template',
      type: 'custom',
      category: 'Newsletter',
      thumbnail: 'bg-gradient-to-br from-green-400 to-green-600',
      lastModified: '1 day ago'
    },
    {
      id: '3',
      name: 'Product Launch',
      type: 'ai',
      category: 'Marketing',
      thumbnail: 'bg-gradient-to-br from-purple-400 to-purple-600',
      lastModified: '3 days ago'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="bg-white rounded-xl shadow-lg p-6 border border-gray-100"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <DocumentTextIcon className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Template Management</h3>
            <p className="text-sm text-gray-500">Create and manage email templates</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
          >
            <SparklesIcon className="h-4 w-4" />
            <span>AI Generate</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Create</span>
          </motion.button>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-purple-900">AI Templates</span>
            <SparklesIcon className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-lg font-bold text-purple-900">
            {typeof limits.aiTemplates === 'number' 
              ? `${usage.aiTemplates}/${limits.aiTemplates}` 
              : 'Unlimited'
            }
          </div>
          <div className="text-xs text-purple-600">Daily limit</div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-blue-900">Custom Templates</span>
            <DocumentTextIcon className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-lg font-bold text-blue-900">
            {usage.customTemplates}
          </div>
          <div className="text-xs text-blue-600">Created</div>
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template, index) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onHoverStart={() => setHoveredTemplate(template.id)}
            onHoverEnd={() => setHoveredTemplate(null)}
            className="relative group cursor-pointer"
          >
            <motion.div
              whileHover={{ y: -4, scale: 1.02 }}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
            >
              {/* Template Thumbnail */}
              <div className={`h-32 ${template.thumbnail} relative`}>
                <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                  <DocumentTextIcon className="h-8 w-8 text-white" />
                </div>
                
                {/* Type Badge */}
                <div className="absolute top-2 left-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    template.type === 'ai' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {template.type === 'ai' ? 'AI' : 'Custom'}
                  </span>
                </div>

                {/* Hover Actions */}
                <AnimatePresence>
                  {hoveredTemplate === template.id && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center space-x-2"
                    >
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-2 bg-white rounded-full text-gray-700 hover:text-blue-600"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-2 bg-white rounded-full text-gray-700 hover:text-green-600"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Template Info */}
              <div className="p-4">
                <h4 className="font-medium text-gray-900 mb-1">{template.name}</h4>
                <p className="text-sm text-gray-500 mb-2">{template.category}</p>
                <p className="text-xs text-gray-400">Modified {template.lastModified}</p>
              </div>
            </motion.div>
          </motion.div>
        ))}

        {/* Create New Template Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: templates.length * 0.1 }}
          whileHover={{ y: -4, scale: 1.02 }}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:border-purple-400 hover:bg-purple-50 transition-all duration-200 cursor-pointer min-h-[200px]"
        >
          <div className="p-3 bg-gray-100 rounded-full mb-3">
            <PlusIcon className="h-6 w-6 text-gray-600" />
          </div>
          <h4 className="font-medium text-gray-900 mb-1">Create New Template</h4>
          <p className="text-sm text-gray-500">Start from scratch or use AI</p>
        </motion.div>
      </div>

      {/* Tier Upgrade Prompt */}
      {userTier === 'free' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg"
        >
          <div className="flex items-center space-x-3">
            <SparklesIcon className="h-5 w-5 text-yellow-600" />
            <div>
              <h4 className="font-medium text-yellow-900">Unlock More AI Templates</h4>
              <p className="text-sm text-yellow-700">
                Upgrade to Paid Standard for 10 AI templates daily, or Premium for unlimited access.
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm whitespace-nowrap"
            >
              Upgrade Now
            </motion.button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}