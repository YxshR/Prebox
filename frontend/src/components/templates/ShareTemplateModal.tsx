'use client';

import { useState } from 'react';
import { EmailTemplate } from '../../types/template';
import { useTemplateStore } from '../../stores/templateStore';
import { 
  XMarkIcon, 
  PlusIcon, 
  TrashIcon,
  ShareIcon,
  UserIcon
} from '@heroicons/react/24/outline';

interface ShareTemplateModalProps {
  template: EmailTemplate;
  onClose: () => void;
}

export function ShareTemplateModal({ template, onClose }: ShareTemplateModalProps) {
  const { shareTemplate, loading } = useTemplateStore();
  const [emails, setEmails] = useState<string[]>(['']);
  const [permissions, setPermissions] = useState<'view' | 'edit'>('view');
  const [error, setError] = useState<string | null>(null);

  const handleAddEmail = () => {
    setEmails([...emails, '']);
  };

  const handleRemoveEmail = (index: number) => {
    if (emails.length > 1) {
      setEmails(emails.filter((_, i) => i !== index));
    }
  };

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const validateEmails = () => {
    const validEmails = emails.filter(email => {
      const trimmed = email.trim();
      return trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    });

    if (validEmails.length === 0) {
      setError('Please enter at least one valid email address');
      return false;
    }

    setError(null);
    return validEmails;
  };

  const handleShare = async () => {
    const validEmails = validateEmails();
    if (!validEmails) return;

    try {
      await shareTemplate({
        templateId: template.id,
        shareWith: validEmails,
        permissions
      });
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to share template');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <ShareIcon className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900">Share Template</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Template Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-gray-900 mb-1">{template.name}</h4>
            <p className="text-sm text-gray-600">{template.subject}</p>
            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
              <span className="capitalize">{template.category}</span>
              {template.isAIGenerated && <span>AI Generated</span>}
              {template.tags.length > 0 && (
                <span>{template.tags.slice(0, 2).join(', ')}</span>
              )}
            </div>
          </div>

          {/* Current Sharing Status */}
          {template.isShared && template.sharedWith.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Currently shared with:</h4>
              <div className="space-y-1">
                {template.sharedWith.map((email, index) => (
                  <div key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                    <UserIcon className="h-4 w-4" />
                    <span>{email}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email Inputs */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share with email addresses:
            </label>
            <div className="space-y-2">
              {emails.map((email, index) => (
                <div key={index} className="flex space-x-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(index, e.target.value)}
                    placeholder="Enter email address..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {emails.length > 1 && (
                    <button
                      onClick={() => handleRemoveEmail(index)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <button
              onClick={handleAddEmail}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add another email</span>
            </button>
          </div>

          {/* Permissions */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions:
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="permissions"
                  value="view"
                  checked={permissions === 'view'}
                  onChange={(e) => setPermissions(e.target.value as 'view' | 'edit')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">
                  <strong>View only</strong> - Can view and use the template
                </span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  name="permissions"
                  value="edit"
                  checked={permissions === 'edit'}
                  onChange={(e) => setPermissions(e.target.value as 'view' | 'edit')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">
                  <strong>Can edit</strong> - Can view, use, and modify the template
                </span>
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={handleShare}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sharing...' : 'Share Template'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}