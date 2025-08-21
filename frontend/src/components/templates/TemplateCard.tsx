'use client';

import { useState } from 'react';
import { EmailTemplate } from '../../types/template';
import { useTemplateStore } from '../../stores/templateStore';
import { 
  EyeIcon, 
  PencilIcon, 
  ShareIcon, 
  DocumentDuplicateIcon,
  TrashIcon,
  SparklesIcon,
  TagIcon,
  CalendarIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

interface TemplateCardProps {
  template: EmailTemplate;
  layoutMode: 'grid' | 'list';
  onEdit: () => void;
  onPreview: () => void;
  onShare: () => void;
}

export function TemplateCard({ 
  template, 
  layoutMode, 
  onEdit, 
  onPreview, 
  onShare 
}: TemplateCardProps) {
  const { duplicateTemplate, deleteTemplate } = useTemplateStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDuplicate = async () => {
    try {
      await duplicateTemplate(template.id);
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      await deleteTemplate(template.id);
    } catch (error) {
      console.error('Failed to delete template:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  if (layoutMode === 'list') {
    return (
      <div className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-medium text-gray-900 truncate">
                  {template.name}
                </h3>
                {template.isAIGenerated && (
                  <SparklesIcon className="h-4 w-4 text-purple-500" title="AI Generated" />
                )}
                {template.isShared && (
                  <ShareIcon className="h-4 w-4 text-blue-500" title="Shared Template" />
                )}
              </div>
              
              <p className="text-sm text-gray-600 mt-1 truncate">
                {template.subject}
              </p>
              
              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                <div className="flex items-center space-x-1">
                  <CalendarIcon className="h-3 w-3" />
                  <span>Updated {formatDate(template.updatedAt)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <UserIcon className="h-3 w-3" />
                  <span>by {template.lastModifiedBy}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <TagIcon className="h-3 w-3" />
                  <span>{template.category}</span>
                </div>
              </div>
              
              {template.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {template.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                    >
                      {tag}
                    </span>
                  ))}
                  {template.tags.length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{template.tags.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={onPreview}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Preview"
              >
                <EyeIcon className="h-4 w-4" />
              </button>
              
              <button
                onClick={onEdit}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Edit"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              
              <button
                onClick={handleDuplicate}
                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                title="Duplicate"
              >
                <DocumentDuplicateIcon className="h-4 w-4" />
              </button>
              
              <button
                onClick={onShare}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Share"
              >
                <ShareIcon className="h-4 w-4" />
              </button>
              
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={`p-2 rounded-lg transition-colors ${
                  showDeleteConfirm
                    ? 'text-red-600 bg-red-50 hover:bg-red-100'
                    : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                }`}
                title={showDeleteConfirm ? 'Click again to confirm' : 'Delete'}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid layout
  return (
    <div className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-all duration-200 group">
      {/* Template Preview */}
      <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-2">📧</div>
            <div className="text-xs text-gray-600 font-medium">
              {template.category.toUpperCase()}
            </div>
          </div>
        </div>
        
        {/* Overlay actions */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex space-x-2">
            <button
              onClick={onPreview}
              className="bg-white text-gray-700 p-2 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
              title="Preview"
            >
              <EyeIcon className="h-4 w-4" />
            </button>
            <button
              onClick={onEdit}
              className="bg-white text-gray-700 p-2 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
              title="Edit"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex space-x-1">
          {template.isAIGenerated && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              <SparklesIcon className="h-3 w-3 mr-1" />
              AI
            </span>
          )}
          {template.isShared && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <ShareIcon className="h-3 w-3 mr-1" />
              Shared
            </span>
          )}
        </div>
      </div>
      
      {/* Template Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-900 truncate flex-1">
            {template.name}
          </h3>
          
          {/* Action Menu */}
          <div className="flex space-x-1 ml-2">
            <button
              onClick={handleDuplicate}
              className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
              title="Duplicate"
            >
              <DocumentDuplicateIcon className="h-3 w-3" />
            </button>
            
            <button
              onClick={onShare}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Share"
            >
              <ShareIcon className="h-3 w-3" />
            </button>
            
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={`p-1 rounded transition-colors ${
                showDeleteConfirm
                  ? 'text-red-600 bg-red-50 hover:bg-red-100'
                  : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
              }`}
              title={showDeleteConfirm ? 'Click again to confirm' : 'Delete'}
            >
              <TrashIcon className="h-3 w-3" />
            </button>
          </div>
        </div>
        
        <p className="text-xs text-gray-600 mb-3 line-clamp-2">
          {template.subject}
        </p>
        
        {/* Tags */}
        {template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {template.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
              >
                {tag}
              </span>
            ))}
            {template.tags.length > 2 && (
              <span className="text-xs text-gray-500">
                +{template.tags.length - 2}
              </span>
            )}
          </div>
        )}
        
        {/* Meta info */}
        <div className="text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span>Updated {formatDate(template.updatedAt)}</span>
            <span className="capitalize">{template.category}</span>
          </div>
        </div>
      </div>
    </div>
  );
}