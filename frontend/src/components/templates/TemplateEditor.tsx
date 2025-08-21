'use client';

import { useState, useEffect } from 'react';
import { EmailTemplate, CreateTemplateRequest, UpdateTemplateRequest, TemplateVariable } from '../../types/template';
import { useTemplateStore } from '../../stores/templateStore';
import { DragDropEditor } from './DragDropEditor';
import { VariableManager } from './VariableManager';
import { 
  EyeIcon, 
  CodeBracketIcon,
  SwatchIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface TemplateEditorProps {
  template?: EmailTemplate | null;
  onSave: () => void;
  onCancel: () => void;
}

type EditorMode = 'visual' | 'code';

export function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const { createTemplate, updateTemplate, loading, error } = useTemplateStore();
  
  const [editorMode, setEditorMode] = useState<EditorMode>('visual');
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    htmlContent: '',
    textContent: '',
    category: 'general',
    tags: [] as string[],
    variables: [] as TemplateVariable[]
  });
  const [newTag, setNewTag] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        category: template.category,
        tags: template.tags,
        variables: template.variables
      });
    }
  }, [template]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleVariablesChange = (variables: TemplateVariable[]) => {
    setFormData(prev => ({ ...prev, variables }));
  };

  const handleSave = async () => {
    try {
      if (template) {
        // Update existing template
        const updateData: UpdateTemplateRequest = {
          name: formData.name,
          subject: formData.subject,
          htmlContent: formData.htmlContent,
          textContent: formData.textContent,
          category: formData.category,
          tags: formData.tags,
          variables: formData.variables
        };
        await updateTemplate(template.id, updateData);
      } else {
        // Create new template
        const createData: CreateTemplateRequest = {
          tenantId: 'tenant_1', // This would come from auth context
          name: formData.name,
          subject: formData.subject,
          htmlContent: formData.htmlContent,
          textContent: formData.textContent,
          category: formData.category,
          tags: formData.tags,
          variables: formData.variables,
          isAIGenerated: false
        };
        await createTemplate(createData);
      }
      onSave();
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const categories = [
    'general',
    'marketing',
    'transactional',
    'newsletter',
    'welcome',
    'promotional',
    'notification'
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {template ? 'Edit Template' : 'Create New Template'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Design and customize your email template
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Editor Mode Toggle */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setEditorMode('visual')}
                className={`px-3 py-2 text-sm font-medium ${
                  editorMode === 'visual'
                    ? 'bg-blue-50 text-blue-600 border-blue-300'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <SwatchIcon className="h-4 w-4 inline mr-1" />
                Visual
              </button>
              <button
                onClick={() => setEditorMode('code')}
                className={`px-3 py-2 text-sm font-medium border-l border-gray-300 ${
                  editorMode === 'code'
                    ? 'bg-blue-50 text-blue-600 border-blue-300'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CodeBracketIcon className="h-4 w-4 inline mr-1" />
                Code
              </button>
            </div>

            {/* Preview Toggle */}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`px-3 py-2 text-sm font-medium border rounded-lg ${
                showPreview
                  ? 'bg-green-50 text-green-600 border-green-300'
                  : 'text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <EyeIcon className="h-4 w-4 inline mr-1" />
              Preview
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* Template Settings */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter template name..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject Line *
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => handleInputChange('subject', e.target.value)}
              placeholder="Enter email subject..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Add tag..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleAddTag}
                className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Variables Manager */}
          <VariableManager
            variables={formData.variables}
            onChange={handleVariablesChange}
          />

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={loading || !formData.name || !formData.subject}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {editorMode === 'visual' ? (
            <DragDropEditor
              htmlContent={formData.htmlContent}
              onChange={(html) => handleInputChange('htmlContent', html)}
              variables={formData.variables}
            />
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  HTML Content
                </label>
                <textarea
                  value={formData.htmlContent}
                  onChange={(e) => handleInputChange('htmlContent', e.target.value)}
                  placeholder="Enter HTML content..."
                  rows={20}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Text Content (Optional)
                </label>
                <textarea
                  value={formData.textContent}
                  onChange={(e) => handleInputChange('textContent', e.target.value)}
                  placeholder="Enter plain text version..."
                  rows={10}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">Template Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="bg-white rounded shadow-sm p-6">
                  <div className="border-b pb-2 mb-4">
                    <strong>Subject:</strong> {formData.subject}
                  </div>
                  <div 
                    dangerouslySetInnerHTML={{ __html: formData.htmlContent }}
                    className="prose max-w-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}