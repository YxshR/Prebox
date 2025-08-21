'use client';

import { useState, useEffect } from 'react';
import { EmailTemplate } from '../../types/template';
import { useTemplateStore } from '../../stores/templateStore';
import { 
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  DocumentTextIcon,
  PencilIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

interface TemplatePreviewProps {
  template: EmailTemplate;
  onEdit: () => void;
  onBack: () => void;
}

type PreviewMode = 'desktop' | 'mobile' | 'text';

export function TemplatePreview({ template, onEdit, onBack }: TemplatePreviewProps) {
  const { previewTemplate, previewData, loading } = useTemplateStore();
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');
  const [variableValues, setVariableValues] = useState<Record<string, any>>({});

  useEffect(() => {
    // Initialize variable values with defaults
    const initialValues: Record<string, any> = {};
    template.variables.forEach(variable => {
      initialValues[variable.name] = variable.defaultValue || 
        (variable.type === 'text' ? `Sample ${variable.name}` :
         variable.type === 'number' ? '123' :
         variable.type === 'date' ? new Date().toISOString().split('T')[0] :
         variable.type === 'boolean' ? 'true' :
         variable.type === 'url' ? 'https://example.com' :
         variable.type === 'image' ? 'https://via.placeholder.com/300x200' :
         `{{${variable.name}}}`);
    });
    setVariableValues(initialValues);
  }, [template.variables]);

  useEffect(() => {
    // Generate preview when mode or variables change
    previewTemplate({
      templateId: template.id,
      variables: variableValues,
      previewType: previewMode
    });
  }, [previewMode, variableValues, template.id]);

  const handleVariableChange = (variableName: string, value: any) => {
    setVariableValues(prev => ({
      ...prev,
      [variableName]: value
    }));
  };

  const getPreviewContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!previewData) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Preview not available</p>
          </div>
        </div>
      );
    }

    if (previewMode === 'text') {
      return (
        <div className="bg-gray-50 p-6 rounded-lg">
          <div className="bg-white p-4 rounded border font-mono text-sm whitespace-pre-wrap">
            <div className="border-b pb-2 mb-4 font-sans">
              <strong>Subject:</strong> {previewData.subject}
            </div>
            {previewData.text}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-gray-100 p-6 rounded-lg">
        <div 
          className={`bg-white rounded-lg shadow-sm mx-auto transition-all duration-300 ${
            previewMode === 'mobile' ? 'max-w-sm' : 'max-w-2xl'
          }`}
        >
          {/* Email Header */}
          <div className="bg-gray-50 px-4 py-3 border-b rounded-t-lg">
            <div className="text-sm text-gray-600">
              <strong>Subject:</strong> {previewData.subject}
            </div>
          </div>
          
          {/* Email Content */}
          <div 
            className="p-6"
            dangerouslySetInnerHTML={{ __html: previewData.html }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {template.name}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Template Preview
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Preview Mode Toggle */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setPreviewMode('desktop')}
                className={`px-3 py-2 text-sm font-medium flex items-center space-x-1 ${
                  previewMode === 'desktop'
                    ? 'bg-blue-50 text-blue-600 border-blue-300'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <ComputerDesktopIcon className="h-4 w-4" />
                <span>Desktop</span>
              </button>
              
              <button
                onClick={() => setPreviewMode('mobile')}
                className={`px-3 py-2 text-sm font-medium border-l border-gray-300 flex items-center space-x-1 ${
                  previewMode === 'mobile'
                    ? 'bg-blue-50 text-blue-600 border-blue-300'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <DevicePhoneMobileIcon className="h-4 w-4" />
                <span>Mobile</span>
              </button>
              
              <button
                onClick={() => setPreviewMode('text')}
                className={`px-3 py-2 text-sm font-medium border-l border-gray-300 flex items-center space-x-1 ${
                  previewMode === 'text'
                    ? 'bg-blue-50 text-blue-600 border-blue-300'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <DocumentTextIcon className="h-4 w-4" />
                <span>Text</span>
              </button>
            </div>

            {/* Edit Button */}
            <button
              onClick={onEdit}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <PencilIcon className="h-4 w-4" />
              <span>Edit Template</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6">
        {/* Variables Panel */}
        {template.variables.length > 0 && (
          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Template Variables
              </h3>
              
              <div className="space-y-4">
                {template.variables.map((variable) => (
                  <div key={variable.id}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {variable.name}
                      {variable.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    
                    {variable.type === 'boolean' ? (
                      <select
                        value={variableValues[variable.name] || 'false'}
                        onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    ) : variable.type === 'date' ? (
                      <input
                        type="date"
                        value={variableValues[variable.name] || ''}
                        onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : variable.type === 'number' ? (
                      <input
                        type="number"
                        value={variableValues[variable.name] || ''}
                        onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      <input
                        type="text"
                        value={variableValues[variable.name] || ''}
                        onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                        placeholder={variable.defaultValue || `Enter ${variable.name}...`}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    )}
                    
                    {variable.description && (
                      <p className="text-xs text-gray-500 mt-1">
                        {variable.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Preview Panel */}
        <div className={template.variables.length > 0 ? 'lg:col-span-3' : 'lg:col-span-4'}>
          {getPreviewContent()}
        </div>
      </div>

      {/* Template Info */}
      <div className="border-t border-gray-200 p-6 bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Template Details</h4>
            <div className="space-y-1 text-gray-600">
              <div>Category: <span className="capitalize">{template.category}</span></div>
              <div>Type: {template.isAIGenerated ? 'AI Generated' : 'Manual'}</div>
              <div>Shared: {template.isShared ? 'Yes' : 'No'}</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Tags</h4>
            <div className="flex flex-wrap gap-1">
              {template.tags.length > 0 ? (
                template.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-gray-500 text-xs">No tags</span>
              )}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Last Modified</h4>
            <div className="space-y-1 text-gray-600">
              <div>{new Date(template.updatedAt).toLocaleDateString()}</div>
              <div>by {template.lastModifiedBy}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}