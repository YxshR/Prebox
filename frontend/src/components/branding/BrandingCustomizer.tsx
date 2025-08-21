'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EyeIcon, SwatchIcon, PaintBrushIcon } from '@heroicons/react/24/outline';
import { useBrandingStore } from '../../stores/brandingStore';
import toast from 'react-hot-toast';

interface BrandingCustomizerProps {
  onPreviewChange?: (previewHtml: string) => void;
  className?: string;
}

const LOGO_POSITIONS = [
  { value: 'header', label: 'Header', description: 'Top of the email' },
  { value: 'footer', label: 'Footer', description: 'Bottom of the email' },
  { value: 'sidebar', label: 'Sidebar', description: 'Left side of the email' }
];

const FONT_FAMILIES = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Courier New, monospace', label: 'Courier New' }
];

const PRESET_COLORS = [
  { name: 'Blue', primary: '#3b82f6', secondary: '#eff6ff', text: '#1e40af' },
  { name: 'Green', primary: '#059669', secondary: '#ecfdf5', text: '#065f46' },
  { name: 'Purple', primary: '#7c3aed', secondary: '#f3e8ff', text: '#5b21b6' },
  { name: 'Red', primary: '#dc2626', secondary: '#fef2f2', text: '#991b1b' },
  { name: 'Orange', primary: '#ea580c', secondary: '#fff7ed', text: '#9a3412' },
  { name: 'Gray', primary: '#374151', secondary: '#f9fafb', text: '#111827' },
  { name: 'Teal', primary: '#0d9488', secondary: '#f0fdfa', text: '#134e4a' },
  { name: 'Pink', primary: '#e11d48', secondary: '#fdf2f8', text: '#9f1239' },
  { name: 'Indigo', primary: '#6366f1', secondary: '#eef2ff', text: '#3730a3' }
];

export const BrandingCustomizer: React.FC<BrandingCustomizerProps> = ({ 
  onPreviewChange, 
  className = '' 
}) => {
  const { 
    settings, 
    updateSettings, 
    generatePreview, 
    preview, 
    isLoading, 
    error 
  } = useBrandingStore();

  const [localSettings, setLocalSettings] = useState({
    logoPosition: 'header' as 'header' | 'footer' | 'sidebar',
    primaryColor: '#3b82f6',
    secondaryColor: '#ffffff',
    textColor: '#374151',
    fontFamily: 'Inter, sans-serif',
    customCss: ''
  });

  const [showCustomCss, setShowCustomCss] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Update local settings when store settings change
  useEffect(() => {
    if (settings) {
      setLocalSettings({
        logoPosition: settings.logoPosition,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        textColor: settings.textColor,
        fontFamily: settings.fontFamily,
        customCss: settings.customCss || ''
      });
    }
  }, [settings]);

  // Generate preview when local settings change (real-time preview)
  useEffect(() => {
    if (previewMode) {
      const debounceTimer = setTimeout(() => {
        handleGeneratePreview();
      }, 300); // Reduced delay for more responsive real-time preview
      return () => clearTimeout(debounceTimer);
    }
  }, [localSettings, previewMode]);

  const handleSettingChange = (key: string, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handlePresetColorSelect = (preset: typeof PRESET_COLORS[0]) => {
    setLocalSettings(prev => ({
      ...prev,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      textColor: preset.text
    }));
  };

  const handleSaveSettings = async () => {
    try {
      await updateSettings(localSettings);
      toast.success('Branding settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save branding settings');
    }
  };

  const handleGeneratePreview = async () => {
    try {
      await generatePreview(localSettings);
      if (preview?.previewHtml) {
        onPreviewChange?.(preview.previewHtml);
      }
    } catch (error) {
      console.error('Preview generation failed:', error);
    }
  };

  const togglePreviewMode = () => {
    setPreviewMode(!previewMode);
    if (!previewMode) {
      handleGeneratePreview();
    }
  };

  const handleResetToDefaults = () => {
    const defaultSettings = {
      logoPosition: 'header' as 'header' | 'footer' | 'sidebar',
      primaryColor: '#3b82f6',
      secondaryColor: '#ffffff',
      textColor: '#374151',
      fontFamily: 'Inter, sans-serif',
      customCss: ''
    };
    setLocalSettings(defaultSettings);
    toast.success('Settings reset to defaults');
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <PaintBrushIcon className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Brand Customization</h3>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={togglePreviewMode}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              previewMode
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
            }`}
          >
            <EyeIcon className="h-4 w-4" />
            <span>{previewMode ? 'Live Preview On' : 'Live Preview Off'}</span>
          </button>
        </div>
      </div>

      {/* Logo Position */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Logo Position</label>
        <div className="grid grid-cols-3 gap-3">
          {LOGO_POSITIONS.map((position) => (
            <motion.button
              key={position.value}
              onClick={() => handleSettingChange('logoPosition', position.value)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                localSettings.logoPosition === position.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="font-medium text-sm">{position.label}</div>
              <div className="text-xs text-gray-500 mt-1">{position.description}</div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Color Presets */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Color Presets</label>
        <div className="grid grid-cols-3 gap-3">
          {PRESET_COLORS.map((preset) => (
            <motion.button
              key={preset.name}
              onClick={() => handlePresetColorSelect(preset)}
              className={`p-3 rounded-lg border-2 transition-all ${
                localSettings.primaryColor === preset.primary
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center space-x-2 mb-2">
                <div 
                  className="w-4 h-4 rounded-full border"
                  style={{ backgroundColor: preset.primary }}
                />
                <span className="text-sm font-medium">{preset.name}</span>
              </div>
              <div className="flex space-x-1">
                <div 
                  className="flex-1 h-2 rounded"
                  style={{ backgroundColor: preset.primary }}
                />
                <div 
                  className="flex-1 h-2 rounded"
                  style={{ backgroundColor: preset.secondary }}
                />
                <div 
                  className="flex-1 h-2 rounded"
                  style={{ backgroundColor: preset.text }}
                />
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Custom Colors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Primary Color</label>
          <div className="flex items-center space-x-3">
            <input
              type="color"
              value={localSettings.primaryColor}
              onChange={(e) => handleSettingChange('primaryColor', e.target.value)}
              className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={localSettings.primaryColor}
              onChange={(e) => handleSettingChange('primaryColor', e.target.value)}
              className={`flex-1 px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                /^#[0-9A-Fa-f]{6}$/.test(localSettings.primaryColor)
                  ? 'border-gray-300'
                  : 'border-red-300 bg-red-50'
              }`}
              placeholder="#3b82f6"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Secondary Color</label>
          <div className="flex items-center space-x-3">
            <input
              type="color"
              value={localSettings.secondaryColor}
              onChange={(e) => handleSettingChange('secondaryColor', e.target.value)}
              className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={localSettings.secondaryColor}
              onChange={(e) => handleSettingChange('secondaryColor', e.target.value)}
              className={`flex-1 px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                /^#[0-9A-Fa-f]{6}$/.test(localSettings.secondaryColor)
                  ? 'border-gray-300'
                  : 'border-red-300 bg-red-50'
              }`}
              placeholder="#ffffff"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Text Color</label>
          <div className="flex items-center space-x-3">
            <input
              type="color"
              value={localSettings.textColor}
              onChange={(e) => handleSettingChange('textColor', e.target.value)}
              className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={localSettings.textColor}
              onChange={(e) => handleSettingChange('textColor', e.target.value)}
              className={`flex-1 px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                /^#[0-9A-Fa-f]{6}$/.test(localSettings.textColor)
                  ? 'border-gray-300'
                  : 'border-red-300 bg-red-50'
              }`}
              placeholder="#374151"
            />
          </div>
        </div>
      </div>

      {/* Font Family */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Font Family</label>
        <select
          value={localSettings.fontFamily}
          onChange={(e) => handleSettingChange('fontFamily', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </div>

      {/* Custom CSS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">Custom CSS</label>
          <button
            onClick={() => setShowCustomCss(!showCustomCss)}
            className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            {showCustomCss ? 'Hide' : 'Show'} Advanced
          </button>
        </div>
        
        <AnimatePresence>
          {showCustomCss && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <textarea
                value={localSettings.customCss}
                onChange={(e) => handleSettingChange('customCss', e.target.value)}
                placeholder="/* Add your custom CSS here */&#10;.custom-class {&#10;  color: #333;&#10;}"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={6}
              />
              <p className="text-xs text-gray-500">
                Add custom CSS to further customize your email appearance. Use with caution.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Template Application */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Apply to Templates</label>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <SwatchIcon className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900">Automatic Application</h4>
              <p className="text-sm text-blue-700 mt-1">
                Your branding settings will be automatically applied to all new email templates and campaigns.
                Existing templates can be updated individually from the Templates page.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleGeneratePreview}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <EyeIcon className="h-4 w-4" />
            <span>{isLoading ? 'Generating...' : 'Preview Changes'}</span>
          </button>

          <button
            onClick={handleResetToDefaults}
            disabled={isLoading}
            className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Reset to Defaults
          </button>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4"
          >
            <p className="text-sm text-red-700">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};