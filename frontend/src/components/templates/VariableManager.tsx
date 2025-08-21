'use client';

import { useState } from 'react';
import { TemplateVariable } from '../../types/template';
import { PlusIcon, TrashIcon, ClipboardIcon } from '@heroicons/react/24/outline';

interface VariableManagerProps {
  variables: TemplateVariable[];
  onChange: (variables: TemplateVariable[]) => void;
}

export function VariableManager({ variables, onChange }: VariableManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVariable, setNewVariable] = useState({
    name: '',
    type: 'text' as TemplateVariable['type'],
    defaultValue: '',
    required: false,
    description: ''
  });

  const generateId = () => `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleAddVariable = () => {
    if (!newVariable.name.trim()) return;

    const variable: TemplateVariable = {
      id: generateId(),
      name: newVariable.name.trim(),
      type: newVariable.type,
      defaultValue: newVariable.defaultValue || undefined,
      required: newVariable.required,
      description: newVariable.description || undefined
    };

    onChange([...variables, variable]);
    setNewVariable({
      name: '',
      type: 'text',
      defaultValue: '',
      required: false,
      description: ''
    });
    setShowAddForm(false);
  };

  const handleUpdateVariable = (id: string, updates: Partial<TemplateVariable>) => {
    const updatedVariables = variables.map(variable =>
      variable.id === id ? { ...variable, ...updates } : variable
    );
    onChange(updatedVariables);
  };

  const handleDeleteVariable = (id: string) => {
    const updatedVariables = variables.filter(variable => variable.id !== id);
    onChange(updatedVariables);
  };

  const copyVariableToClipboard = (variableName: string) => {
    navigator.clipboard.writeText(`{{${variableName}}}`);
  };

  const variableTypes = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'image', label: 'Image URL' },
    { value: 'url', label: 'URL' }
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-gray-700">
          Template Variables
        </label>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Variable</span>
        </button>
      </div>

      {/* Add Variable Form */}
      {showAddForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Variable Name *
              </label>
              <input
                type="text"
                value={newVariable.name}
                onChange={(e) => setNewVariable(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., first_name"
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={newVariable.type}
                  onChange={(e) => setNewVariable(prev => ({ 
                    ...prev, 
                    type: e.target.value as TemplateVariable['type'] 
                  }))}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {variableTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Default Value
                </label>
                <input
                  type="text"
                  value={newVariable.defaultValue}
                  onChange={(e) => setNewVariable(prev => ({ ...prev, defaultValue: e.target.value }))}
                  placeholder="Optional"
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={newVariable.description}
                onChange={(e) => setNewVariable(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="required"
                checked={newVariable.required}
                onChange={(e) => setNewVariable(prev => ({ ...prev, required: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="required" className="ml-2 text-sm text-gray-700">
                Required variable
              </label>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleAddVariable}
                disabled={!newVariable.name.trim()}
                className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Variable
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="bg-gray-300 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variables List */}
      {variables.length > 0 ? (
        <div className="space-y-2">
          {variables.map((variable) => (
            <div
              key={variable.id}
              className="bg-white border border-gray-200 rounded-lg p-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <code className="text-sm font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded">
                      {`{{${variable.name}}}`}
                    </code>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {variable.type}
                    </span>
                    {variable.required && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                        Required
                      </span>
                    )}
                  </div>
                  
                  {variable.description && (
                    <p className="text-xs text-gray-600 mt-1">
                      {variable.description}
                    </p>
                  )}
                  
                  {variable.defaultValue && (
                    <p className="text-xs text-gray-500 mt-1">
                      Default: {variable.defaultValue}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-1 ml-2">
                  <button
                    onClick={() => copyVariableToClipboard(variable.name)}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    <ClipboardIcon className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteVariable(variable.id)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete variable"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500">
          <div className="text-4xl mb-2">🔧</div>
          <p className="text-sm">No variables defined</p>
          <p className="text-xs text-gray-400">
            Add variables to make your template dynamic
          </p>
        </div>
      )}
    </div>
  );
}