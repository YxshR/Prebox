'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PaintBrushIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { LogoUpload } from './LogoUpload';
import { BrandingCustomizer } from './BrandingCustomizer';
import { BrandingPreview } from './BrandingPreview';
import { useBrandingStore } from '../../stores/brandingStore';
import toast from 'react-hot-toast';

export const BrandingPage: React.FC = () => {
  const { 
    fetchSettings, 
    settings, 
    preview, 
    isLoading, 
    error, 
    clearError 
  } = useBrandingStore();
  
  const [previewHtml, setPreviewHtml] = useState<string>('');

  useEffect(() => {
    fetchSettings(true);
  }, [fetchSettings]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  useEffect(() => {
    if (preview?.previewHtml) {
      setPreviewHtml(preview.previewHtml);
    }
  }, [preview]);

  const handlePreviewChange = (html: string) => {
    setPreviewHtml(html);
  };

  const handleUploadComplete = () => {
    // Refresh settings after logo upload
    fetchSettings(true);
  };

  const handleTemplateChange = (templateId: string) => {
    // Trigger preview regeneration with new template
    // This would typically call the branding store to regenerate preview with the selected template
    console.log('Template changed to:', templateId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
              <PaintBrushIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Logo & Branding</h1>
              <p className="text-gray-600 mt-1">
                Customize your email branding with logos, colors, and fonts
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Controls */}
          <div className="space-y-8">
            {/* Logo Upload Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center space-x-3 mb-6">
                <SparklesIcon className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Logo Upload</h2>
              </div>
              <LogoUpload onUploadComplete={handleUploadComplete} />
            </motion.div>

            {/* Branding Customizer */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <BrandingCustomizer onPreviewChange={handlePreviewChange} />
            </motion.div>
          </div>

          {/* Right Column - Preview */}
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8"
            >
              <BrandingPreview 
                previewHtml={previewHtml}
                isLoading={isLoading}
                onTemplateChange={handleTemplateChange}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};