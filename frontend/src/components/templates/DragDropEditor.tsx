'use client';

import { useState, useRef, useCallback } from 'react';
import { TemplateVariable } from '../../types/template';
import { 
  PhotoIcon,
  DocumentTextIcon,
  LinkIcon,
  Bars3Icon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

interface DragDropEditorProps {
  htmlContent: string;
  onChange: (html: string) => void;
  variables: TemplateVariable[];
}

interface EditorBlock {
  id: string;
  type: 'text' | 'image' | 'button' | 'divider' | 'spacer';
  content: string;
  styles?: Record<string, string>;
}

const BLOCK_TEMPLATES = {
  text: {
    type: 'text' as const,
    content: '<p>Click to edit this text...</p>',
    styles: { padding: '10px', fontSize: '16px', lineHeight: '1.5' }
  },
  image: {
    type: 'image' as const,
    content: '<img src="https://via.placeholder.com/400x200" alt="Placeholder" style="width: 100%; height: auto;" />',
    styles: { padding: '10px', textAlign: 'center' }
  },
  button: {
    type: 'button' as const,
    content: '<a href="#" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Click Here</a>',
    styles: { padding: '20px', textAlign: 'center' }
  },
  divider: {
    type: 'divider' as const,
    content: '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />',
    styles: { padding: '10px 0' }
  },
  spacer: {
    type: 'spacer' as const,
    content: '<div style="height: 40px;"></div>',
    styles: {}
  }
};

export function DragDropEditor({ htmlContent, onChange, variables }: DragDropEditorProps) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => {
    // Parse existing HTML content into blocks (simplified)
    if (htmlContent) {
      return [{
        id: 'existing',
        type: 'text',
        content: htmlContent,
        styles: {}
      }];
    }
    return [];
  });
  
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const generateId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addBlock = (type: keyof typeof BLOCK_TEMPLATES) => {
    const template = BLOCK_TEMPLATES[type];
    const newBlock: EditorBlock = {
      id: generateId(),
      ...template
    };
    
    setBlocks(prev => [...prev, newBlock]);
    updateHtmlContent([...blocks, newBlock]);
  };

  const updateBlock = (id: string, updates: Partial<EditorBlock>) => {
    const updatedBlocks = blocks.map(block => 
      block.id === id ? { ...block, ...updates } : block
    );
    setBlocks(updatedBlocks);
    updateHtmlContent(updatedBlocks);
  };

  const deleteBlock = (id: string) => {
    const updatedBlocks = blocks.filter(block => block.id !== id);
    setBlocks(updatedBlocks);
    updateHtmlContent(updatedBlocks);
    if (selectedBlock === id) {
      setSelectedBlock(null);
    }
  };

  const moveBlock = (fromIndex: number, toIndex: number) => {
    const updatedBlocks = [...blocks];
    const [movedBlock] = updatedBlocks.splice(fromIndex, 1);
    updatedBlocks.splice(toIndex, 0, movedBlock);
    setBlocks(updatedBlocks);
    updateHtmlContent(updatedBlocks);
  };

  const updateHtmlContent = (currentBlocks: EditorBlock[]) => {
    const html = currentBlocks.map(block => {
      const styleString = Object.entries(block.styles || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ');
      
      return `<div style="${styleString}">${block.content}</div>`;
    }).join('\n');
    
    onChange(html);
  };

  const handleDragStart = (e: React.DragEvent, blockId: string) => {
    setDraggedBlock(blockId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    
    if (!draggedBlock) return;
    
    const draggedIndex = blocks.findIndex(block => block.id === draggedBlock);
    if (draggedIndex !== -1 && draggedIndex !== targetIndex) {
      moveBlock(draggedIndex, targetIndex);
    }
    
    setDraggedBlock(null);
  };

  const handleContentEdit = (blockId: string, newContent: string) => {
    updateBlock(blockId, { content: newContent });
  };

  return (
    <div className="flex h-[600px] border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="w-64 bg-gray-50 border-r border-gray-300 p-4 overflow-y-auto">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Add Elements</h3>
        
        <div className="space-y-2">
          <button
            onClick={() => addBlock('text')}
            className="w-full flex items-center space-x-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <DocumentTextIcon className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium">Text Block</span>
          </button>
          
          <button
            onClick={() => addBlock('image')}
            className="w-full flex items-center space-x-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <PhotoIcon className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium">Image</span>
          </button>
          
          <button
            onClick={() => addBlock('button')}
            className="w-full flex items-center space-x-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <LinkIcon className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium">Button</span>
          </button>
          
          <button
            onClick={() => addBlock('divider')}
            className="w-full flex items-center space-x-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Bars3Icon className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium">Divider</span>
          </button>
          
          <button
            onClick={() => addBlock('spacer')}
            className="w-full flex items-center space-x-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <PlusIcon className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium">Spacer</span>
          </button>
        </div>

        {/* Variables */}
        {variables.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Variables</h3>
            <div className="space-y-1">
              {variables.map((variable) => (
                <div
                  key={variable.id}
                  className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border cursor-pointer hover:bg-blue-100"
                  onClick={() => {
                    // Copy variable to clipboard
                    navigator.clipboard.writeText(`{{${variable.name}}}`);
                  }}
                  title="Click to copy"
                >
                  {`{{${variable.name}}}`}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-white overflow-y-auto">
        <div className="p-6">
          <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm min-h-[400px]">
            {blocks.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-sm">Drag elements from the toolbar to start building your template</p>
                </div>
              </div>
            ) : (
              <div className="p-4">
                {blocks.map((block, index) => (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, block.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`relative group mb-2 ${
                      selectedBlock === block.id ? 'ring-2 ring-blue-500' : ''
                    } ${draggedBlock === block.id ? 'opacity-50' : ''}`}
                    onClick={() => setSelectedBlock(block.id)}
                  >
                    {/* Block Controls */}
                    <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBlock(block.id);
                        }}
                        className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                      >
                        <TrashIcon className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Block Content */}
                    <div
                      className="border border-transparent hover:border-gray-300 rounded p-2 cursor-pointer"
                      style={block.styles}
                    >
                      {block.type === 'text' ? (
                        <div
                          contentEditable
                          dangerouslySetInnerHTML={{ __html: block.content }}
                          onBlur={(e) => handleContentEdit(block.id, e.currentTarget.innerHTML)}
                          className="outline-none"
                        />
                      ) : (
                        <div dangerouslySetInnerHTML={{ __html: block.content }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Properties Panel */}
      {selectedBlock && (
        <div className="w-64 bg-gray-50 border-l border-gray-300 p-4 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Properties</h3>
          
          {(() => {
            const block = blocks.find(b => b.id === selectedBlock);
            if (!block) return null;

            return (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Padding
                  </label>
                  <input
                    type="text"
                    value={block.styles?.padding || ''}
                    onChange={(e) => updateBlock(block.id, {
                      styles: { ...block.styles, padding: e.target.value }
                    })}
                    placeholder="e.g., 10px"
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                  />
                </div>

                {block.type === 'text' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Font Size
                      </label>
                      <input
                        type="text"
                        value={block.styles?.fontSize || ''}
                        onChange={(e) => updateBlock(block.id, {
                          styles: { ...block.styles, fontSize: e.target.value }
                        })}
                        placeholder="e.g., 16px"
                        className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Text Align
                      </label>
                      <select
                        value={block.styles?.textAlign || ''}
                        onChange={(e) => updateBlock(block.id, {
                          styles: { ...block.styles, textAlign: e.target.value }
                        })}
                        className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="">Default</option>
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Background Color
                  </label>
                  <input
                    type="color"
                    value={block.styles?.backgroundColor || '#ffffff'}
                    onChange={(e) => updateBlock(block.id, {
                      styles: { ...block.styles, backgroundColor: e.target.value }
                    })}
                    className="w-full h-8 border border-gray-300 rounded"
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}