'use client';

import { useEffect, useState } from 'react';
import { useTemplateStore } from '../../../stores/templateStore';
import { TemplateLibrary } from '../../../components/templates/TemplateLibrary';
import { TemplateEditor } from '../../../components/templates/TemplateEditor';
import { TemplatePreview } from '../../../components/templates/TemplatePreview';
import { ShareTemplateModal } from '../../../components/templates/ShareTemplateModal';
import { EmailTemplate } from '../../../types/template';
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon
} from '@heroicons/react/24/outline';

type ViewMode = 'library' | 'editor' | 'preview';
type LayoutMode = 'grid' | 'list';

export default function TemplatesPage() {
  const {
    templates,
    loading,
    error,
    currentTemplate,
    filters,
    currentPage,
    totalPages,
    totalTemplates,
    loadTemplates,
    setCurrentTemplate,
    setFilters,
    clearFilters,
    loadCategories,
    loadTags,
    clearError
  } = useTemplateStore();

  const [viewMode, setViewMode] = useState<ViewMode>('library');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  const [showShareModal, setShowShareModal] = useState(false);
  const [templateToShare, setTemplateToShare] = useState<EmailTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadCategories();
    loadTags();
  }, []);

  useEffect(() => {
    // Update search filter when search query changes
    if (searchQuery !== (filters.search || '')) {
      const timeoutId = setTimeout(() => {
        setFilters({ search: searchQuery || undefined });
      }, 300); // Debounce search

      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, filters.search, setFilters]);

  const handleCreateTemplate = () => {
    setCurrentTemplate(null);
    setViewMode('editor');
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setCurrentTemplate(template);
    setViewMode('editor');
  };

  const handlePreviewTemplate = (template: EmailTemplate) => {
    setCurrentTemplate(template);
    setViewMode('preview');
  };

  const handleShareTemplate = (template: EmailTemplate) => {
    setTemplateToShare(template);
    setShowShareModal(true);
  };

  const handleBackToLibrary = () => {
    setViewMode('library');
    setCurrentTemplate(null);
  };

  const handlePageChange = (page: number) => {
    loadTemplates(page);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Templates</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => {
                clearError();
                loadTemplates();
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {viewMode === 'library' ? 'Template Library' : 
                 viewMode === 'editor' ? (currentTemplate ? 'Edit Template' : 'Create Template') :
                 'Preview Template'}
              </h1>
              
              {viewMode === 'library' && (
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>{totalTemplates} templates</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {viewMode === 'library' && (
                <>
                  {/* Search */}
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search templates..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Filter Toggle */}
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 rounded-lg border transition-colors ${
                      showFilters 
                        ? 'bg-blue-50 border-blue-300 text-blue-600' 
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <FunnelIcon className="h-4 w-4" />
                  </button>

                  {/* Layout Toggle */}
                  <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setLayoutMode('grid')}
                      className={`p-2 ${
                        layoutMode === 'grid' 
                          ? 'bg-blue-50 text-blue-600' 
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Squares2X2Icon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setLayoutMode('list')}
                      className={`p-2 border-l border-gray-300 ${
                        layoutMode === 'list' 
                          ? 'bg-blue-50 text-blue-600' 
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <ListBulletIcon className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Create Template Button */}
                  <button
                    onClick={handleCreateTemplate}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>Create Template</span>
                  </button>
                </>
              )}

              {viewMode !== 'library' && (
                <button
                  onClick={handleBackToLibrary}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Back to Library
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewMode === 'library' && (
          <TemplateLibrary
            templates={templates}
            loading={loading}
            layoutMode={layoutMode}
            showFilters={showFilters}
            currentPage={currentPage}
            totalPages={totalPages}
            onEditTemplate={handleEditTemplate}
            onPreviewTemplate={handlePreviewTemplate}
            onShareTemplate={handleShareTemplate}
            onPageChange={handlePageChange}
          />
        )}

        {viewMode === 'editor' && (
          <TemplateEditor
            template={currentTemplate}
            onSave={handleBackToLibrary}
            onCancel={handleBackToLibrary}
          />
        )}

        {viewMode === 'preview' && currentTemplate && (
          <TemplatePreview
            template={currentTemplate}
            onEdit={() => handleEditTemplate(currentTemplate)}
            onBack={handleBackToLibrary}
          />
        )}
      </div>

      {/* Share Template Modal */}
      {showShareModal && templateToShare && (
        <ShareTemplateModal
          template={templateToShare}
          onClose={() => {
            setShowShareModal(false);
            setTemplateToShare(null);
          }}
        />
      )}
    </div>
  );
}