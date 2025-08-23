'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlusIcon, 
  EyeIcon, 
  EyeSlashIcon,
  ClipboardDocumentIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  KeyIcon
} from '@heroicons/react/24/outline';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { settingsApi, ApiKey, ApiKeyCreateRequest, AvailableScopes } from '@/lib/settingsApi';

export default function ApiKeyManagement() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [availableScopes, setAvailableScopes] = useState<AvailableScopes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedKeyUsage, setSelectedKeyUsage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [keys, scopes] = await Promise.all([
        settingsApi.listApiKeys(),
        settingsApi.getAvailableScopes()
      ]);
      setApiKeys(keys);
      setAvailableScopes(scopes);
    } catch (error) {
      console.error('Failed to load API keys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateApiKey = async (request: ApiKeyCreateRequest) => {
    try {
      const newKey = await settingsApi.createApiKey(request);
      setApiKeys([newKey, ...apiKeys]);
      setShowCreateForm(false);
      
      // Show the new key temporarily
      if (newKey.key) {
        setVisibleKeys(new Set([newKey.id]));
      }
    } catch (error) {
      console.error('Failed to create API key:', error);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    try {
      await settingsApi.revokeApiKey(keyId);
      setApiKeys(apiKeys.filter(key => key.id !== keyId));
    } catch (error) {
      console.error('Failed to revoke API key:', error);
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    const newVisibleKeys = new Set(visibleKeys);
    if (newVisibleKeys.has(keyId)) {
      newVisibleKeys.delete(keyId);
    } else {
      newVisibleKeys.add(keyId);
    }
    setVisibleKeys(newVisibleKeys);
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyId);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const formatKey = (key: string) => {
    if (!key) return '';
    return `${key.substring(0, 8)}...${key.substring(key.length - 8)}`;
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">API Keys</h2>
            <p className="text-gray-600 mt-1">
              Manage your API keys for programmatic access to your account
            </p>
          </div>
          <Button
            onClick={() => setShowCreateForm(true)}
            disabled={!!(availableScopes && apiKeys.length >= availableScopes.limits.maxKeys)}
            className="flex items-center space-x-2"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Create API Key</span>
          </Button>
        </div>

        {/* Tier Information */}
        {availableScopes && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6"
          >
            <div className="flex items-start space-x-3">
              <ChartBarIcon className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900">
                  {availableScopes.currentTier.replace('_', ' ').toUpperCase()} Tier
                </h3>
                <p className="text-blue-700 text-sm mt-1">
                  You can create up to {availableScopes.limits.maxKeys} API keys with rate limits of{' '}
                  {availableScopes.limits.rateLimits.hourly} requests/hour
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableScopes.availableScopes.map((scope) => (
                    <span
                      key={scope}
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Create API Key Form */}
      <AnimatePresence>
        {showCreateForm && (
          <CreateApiKeyForm
            availableScopes={availableScopes?.availableScopes || []}
            onSubmit={handleCreateApiKey}
            onCancel={() => setShowCreateForm(false)}
          />
        )}
      </AnimatePresence>

      {/* API Keys List */}
      <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg overflow-hidden">
        {apiKeys.length === 0 ? (
          <div className="p-12 text-center">
            <KeyIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No API Keys</h3>
            <p className="text-gray-600 mb-4">
              Create your first API key to start using our API programmatically
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              Create API Key
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scopes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {apiKeys.map((apiKey, index) => (
                  <motion.tr
                    key={apiKey.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{apiKey.name}</div>
                      <div className="text-sm text-gray-500">
                        Created {new Date(apiKey.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                          {visibleKeys.has(apiKey.id) 
                            ? (apiKey.key || 'Key not available')
                            : formatKey(apiKey.key || 'bep_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
                          }
                        </code>
                        <button
                          onClick={() => toggleKeyVisibility(apiKey.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {visibleKeys.has(apiKey.id) ? (
                            <EyeSlashIcon className="h-4 w-4" />
                          ) : (
                            <EyeIcon className="h-4 w-4" />
                          )}
                        </button>
                        {visibleKeys.has(apiKey.id) && apiKey.key && (
                          <motion.button
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            onClick={() => copyToClipboard(apiKey.key!, apiKey.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {copiedKey === apiKey.id ? (
                              <CheckIcon className="h-4 w-4 text-green-600" />
                            ) : (
                              <ClipboardDocumentIcon className="h-4 w-4" />
                            )}
                          </motion.button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {apiKey.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {apiKey.lastUsedAt 
                        ? new Date(apiKey.lastUsedAt).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        apiKey.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {apiKey.isActive ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setSelectedKeyUsage(apiKey.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <ChartBarIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRevokeApiKey(apiKey.id)}
                          className="text-red-600 hover:text-red-900"
                          disabled={!apiKey.isActive}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface CreateApiKeyFormProps {
  availableScopes: string[];
  onSubmit: (request: ApiKeyCreateRequest) => void;
  onCancel: () => void;
}

function CreateApiKeyForm({ availableScopes, onSubmit, onCancel }: CreateApiKeyFormProps) {
  const [formData, setFormData] = useState<ApiKeyCreateRequest>({
    name: '',
    scopes: [],
    expiresAt: undefined
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.scopes.length > 0) {
      setIsSubmitting(true);
      try {
        await onSubmit(formData);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const toggleScope = (scope: string) => {
    const newScopes = formData.scopes.includes(scope)
      ? formData.scopes.filter(s => s !== scope)
      : [...formData.scopes, scope];
    setFormData({ ...formData, scopes: newScopes });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-6"
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New API Key</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key Name
          </label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Production API Key"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Scopes (Select at least one)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {availableScopes.map((scope) => (
              <label
                key={scope}
                className="flex items-center space-x-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={formData.scopes.includes(scope)}
                  onChange={() => toggleScope(scope)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">{scope}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expiration Date (Optional)
          </label>
          <Input
            type="datetime-local"
            value={formData.expiresAt ? formData.expiresAt.toISOString().slice(0, 16) : ''}
            onChange={(e) => setFormData({ 
              ...formData, 
              expiresAt: e.target.value ? new Date(e.target.value) : undefined 
            })}
          />
          <p className="text-gray-500 text-sm mt-1">Leave empty for no expiration</p>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4">
          <Button variant="outline" onClick={onCancel} type="button">
            Cancel
          </Button>
          <Button 
            type="submit" 
            loading={isSubmitting}
            disabled={!formData.name || formData.scopes.length === 0}
          >
            Create API Key
          </Button>
        </div>
      </form>
    </motion.div>
  );
}