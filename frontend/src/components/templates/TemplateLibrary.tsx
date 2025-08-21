'use client';

import { useState } from 'react';
import { EmailTemplate } from '../../types/template';
import { TemplateCard } from './TemplateCard';
import { TemplateFilters } from './TemplateFilters';
import { Pagination } from '../ui/Pagination';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface TemplateLibraryProps {
  templates: EmailTemplate[];
  loading: boolean;
  layoutMode: 'grid' | 'list';
  showFilters: boolean;
  currentPage: number;
  totalPages: number;
  onEditTemplate: (template: EmailTemplate) => void;
  onPreviewTemplate: (template: EmailTemplate) => void;
  onShareTemplate: (template: EmailTemplate) => void;
  onPageChange: (page: number) => void;
}

export function TemplateLibrary({
  templates,
  loading,
  layoutMode,
  showFilters,
  currentPage,
  totalPages,
  onEditTemplate,
  onPreviewTemplate,
  onShareTemplate,
  onPageChange,
}: TemplateLibraryProps) {
  if (loading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <TemplateFilters />
        </div>
      )}

      {/* Templates Grid/List */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <div className="text-gray-400 text-6xl mb-4">📧</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-600 mb-6">
            Get started by creating your first email template or adjust your search filters.
          </p>
        </div>
      ) : (
        <>
          <div className={`
            ${layoutMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' 
              : 'space-y-4'
            }
          `}>
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                layoutMode={layoutMode}
                onEdit={() => onEditTemplate(template)}
                onPreview={() => onPreviewTemplate(template)}
                onShare={() => onShareTemplate(template)}
              />
            ))}
          </div>

          {/* Loading overlay for pagination */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={onPageChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}