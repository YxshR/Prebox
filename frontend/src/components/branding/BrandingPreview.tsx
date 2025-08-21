'use client';

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ComputerDesktopIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';

interface BrandingPreviewProps {
  previewHtml?: string;
  isLoading?: boolean;
  className?: string;
  onTemplateChange?: (templateId: string) => void;
}

export const BrandingPreview: React.FC<BrandingPreviewProps> = ({ 
  previewHtml, 
  isLoading = false,
  className = '',
  onTemplateChange
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewMode, setViewMode] = React.useState<'desktop' | 'mobile'>('desktop');
  const [selectedTemplate, setSelectedTemplate] = React.useState<string>('default');

  const templateOptions = [
    { id: 'default', name: 'Default Template', description: 'Basic email layout' },
    { id: 'newsletter', name: 'Newsletter', description: 'Newsletter format' },
    { id: 'promotional', name: 'Promotional', description: 'Marketing email' },
    { id: 'transactional', name: 'Transactional', description: 'Order confirmations, receipts' }
  ];

  useEffect(() => {
    if (previewHtml && iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (doc) {
        doc.open();
        doc.write(previewHtml);
        doc.close();
      }
    }
  }, [previewHtml]);

  const getPreviewStyles = () => {
    return viewMode === 'desktop' 
      ? { width: '100%', height: '500px' }
      : { width: '375px', height: '500px', margin: '0 auto' };
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Preview Controls */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-gray-900">Email Preview</h4>
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('desktop')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'desktop'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ComputerDesktopIcon className="h-4 w-4" />
              <span>Desktop</span>
            </button>
            <button
              onClick={() => setViewMode('mobile')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'mobile'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <DevicePhoneMobileIcon className="h-4 w-4" />
              <span>Mobile</span>
            </button>
          </div>
        </div>

        {/* Template Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Preview Template</label>
          <select
            value={selectedTemplate}
            onChange={(e) => {
              setSelectedTemplate(e.target.value);
              onTemplateChange?.(e.target.value);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {templateOptions.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} - {template.description}
              </option>
            ))}
          </select>
        </div>
      </div>     
 {/* Preview Container */}
      <motion.div
        className="bg-white rounded-lg border border-gray-200 overflow-hidden"
        style={getPreviewStyles()}
        layout
        transition={{ duration: 0.3 }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-600">Generating preview...</p>
            </div>
          </div>
        ) : previewHtml ? (
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0"
            title="Email Preview"
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-gray-200 rounded-lg mx-auto flex items-center justify-center">
                <ComputerDesktopIcon className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">No Preview Available</p>
                <p className="text-xs text-gray-500 mt-1">
                  Make changes to see a live preview of your branding
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Preview Info */}
      {previewHtml && (
        <div className="text-xs text-gray-500 text-center">
          Preview shows how your branding will appear in email templates
        </div>
      )}
    </div>
  );
};