'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudArrowUpIcon, PhotoIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useBrandingStore } from '../../stores/brandingStore';
import toast from 'react-hot-toast';

interface LogoUploadProps {
  onUploadComplete?: () => void;
  className?: string;
}

export const LogoUpload: React.FC<LogoUploadProps> = ({ onUploadComplete, className = '' }) => {
  const { uploadLogo, deleteLogo, settings, isUploading, error } = useBrandingStore();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPG, PNG, SVG, or WebP)');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      await uploadLogo(selectedFile, settings?.logoPosition || 'header');
      toast.success('Logo uploaded successfully!');
      setSelectedFile(null);
      setPreviewUrl(null);
      onUploadComplete?.();
    } catch (error) {
      toast.error('Failed to upload logo');
    }
  };

  const handleDeleteLogo = async () => {
    try {
      await deleteLogo();
      toast.success('Logo deleted successfully!');
      onUploadComplete?.();
    } catch (error) {
      toast.error('Failed to delete logo');
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Current Logo Display */}
      <AnimatePresence>
        {settings?.logoUrl && !selectedFile && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-lg border-2 border-gray-200 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">Current Logo</h4>
              <button
                onClick={handleDeleteLogo}
                className="text-red-600 hover:text-red-700 transition-colors"
                disabled={isUploading}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg">
              <img
                src={settings.logoUrl}
                alt="Current logo"
                className="max-h-20 max-w-full object-contain"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Upload Area */}
      <motion.div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
          dragActive
            ? 'border-blue-400 bg-blue-50 shadow-lg'
            : selectedFile
            ? 'border-green-400 bg-green-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        animate={dragActive ? { 
          borderColor: '#60a5fa',
          backgroundColor: '#dbeafe',
          scale: 1.02
        } : {}}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />

        <div className="text-center">
          <AnimatePresence mode="wait">
            {selectedFile ? (
              <motion.div
                key="selected"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="space-y-4"
              >
                <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                {previewUrl && (
                  <div className="flex justify-center">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-20 max-w-full object-contain rounded border"
                    />
                  </div>
                )}
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUploading ? 'Uploading...' : 'Upload Logo'}
                  </button>
                  <button
                    onClick={clearSelection}
                    disabled={isUploading}
                    className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="space-y-4"
              >
                <motion.div
                  animate={dragActive ? { scale: 1.1 } : { scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {dragActive ? (
                    <CloudArrowUpIcon className="mx-auto h-12 w-12 text-blue-500" />
                  ) : (
                    <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                  )}
                </motion.div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {dragActive ? 'Drop your logo here' : 'Upload your logo'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Drag and drop or click to select • PNG, JPG, SVG, WebP • Max 5MB
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Upload Progress */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-4"
          >
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-sm text-blue-700">Uploading logo...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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