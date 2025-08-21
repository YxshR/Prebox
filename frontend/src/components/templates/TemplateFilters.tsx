'use client';

import { useEffect, useState } from 'react';
import { useTemplateStore } from '../../stores/templateStore';
import { XMarkIcon } from '@heroicons/react/24/outline';

export function TemplateFilters() {
  const {
    filters,
    categories,
    tags,
    setFilters,
    clearFilters,
    loadCategories,
    loadTags
  } = useTemplateStore();

  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    loadCategories();
    loadTags();
  }, []);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    setFilters(newFilters);
  };

  const handleTagToggle = (tag: string) => {
    const currentTags = localFilters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    
    handleFilterChange('tags', newTags.length > 0 ? newTags : undefined);
  };

  const handleDateChange = (key: 'dateFrom' | 'dateTo', value: string) => {
    const date = value ? new Date(value) : undefined;
    handleFilterChange(key, date);
  };

  const hasActiveFilters = Object.keys(filters).some(key => 
    filters[key as keyof typeof filters] !== undefined
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
          >
            <XMarkIcon className="h-4 w-4" />
            <span>Clear all</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            value={localFilters.category || ''}
            onChange={(e) => handleFilterChange('category', e.target.value || undefined)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* AI Generated Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Template Type
          </label>
          <select
            value={
              localFilters.isAIGenerated === undefined ? '' :
              localFilters.isAIGenerated ? 'ai' : 'manual'
            }
            onChange={(e) => {
              const value = e.target.value;
              handleFilterChange('isAIGenerated', 
                value === '' ? undefined :
                value === 'ai' ? true : false
              );
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value="ai">AI Generated</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        {/* Shared Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sharing Status
          </label>
          <select
            value={
              localFilters.isShared === undefined ? '' :
              localFilters.isShared ? 'shared' : 'private'
            }
            onChange={(e) => {
              const value = e.target.value;
              handleFilterChange('isShared', 
                value === '' ? undefined :
                value === 'shared' ? true : false
              );
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Templates</option>
            <option value="shared">Shared</option>
            <option value="private">Private</option>
          </select>
        </div>

        {/* Created By Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Created By
          </label>
          <input
            type="text"
            placeholder="Enter username..."
            value={localFilters.createdBy || ''}
            onChange={(e) => handleFilterChange('createdBy', e.target.value || undefined)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Created From
          </label>
          <input
            type="date"
            value={localFilters.dateFrom ? localFilters.dateFrom.toISOString().split('T')[0] : ''}
            onChange={(e) => handleDateChange('dateFrom', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Created To
          </label>
          <input
            type="date"
            value={localFilters.dateTo ? localFilters.dateTo.toISOString().split('T')[0] : ''}
            onChange={(e) => handleDateChange('dateTo', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tags Filter */}
      {tags.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const isSelected = (localFilters.tags || []).includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          {(localFilters.tags || []).length > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              Selected: {(localFilters.tags || []).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}