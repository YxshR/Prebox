'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import AdminLayout from '@/components/layout/AdminLayout';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    systemName: 'Bulk Email Platform',
    supportEmail: 'admin@bulkemail.com',
    maxEmailsPerHour: 10000,
    enableRegistration: true,
    enableDemoMode: false,
    maintenanceMode: false
  });

  const handleSaveSettings = async () => {
    try {
      // This would typically call an API to save settings
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="mt-2 text-sm text-gray-700">
            Configure system settings and preferences.
          </p>
        </div>

        {/* Settings Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white shadow rounded-lg"
        >
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              System Configuration
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  System Name
                </label>
                <input
                  type="text"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={settings.systemName}
                  onChange={(e) => setSettings({ ...settings, systemName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Support Email
                </label>
                <input
                  type="email"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={settings.supportEmail}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Max Emails Per Hour
                </label>
                <input
                  type="number"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={settings.maxEmailsPerHour}
                  onChange={(e) => setSettings({ ...settings, maxEmailsPerHour: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    checked={settings.enableRegistration}
                    onChange={(e) => setSettings({ ...settings, enableRegistration: e.target.checked })}
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Enable User Registration
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    checked={settings.enableDemoMode}
                    onChange={(e) => setSettings({ ...settings, enableDemoMode: e.target.checked })}
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Enable Demo Mode
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    checked={settings.maintenanceMode}
                    onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Maintenance Mode
                  </label>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleSaveSettings}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* System Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white shadow rounded-lg"
        >
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              System Information
            </h3>
            
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Version</dt>
                <dd className="mt-1 text-sm text-gray-900">1.0.0</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Environment</dt>
                <dd className="mt-1 text-sm text-gray-900">Production</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Database</dt>
                <dd className="mt-1 text-sm text-gray-900">PostgreSQL 14.x</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Cache</dt>
                <dd className="mt-1 text-sm text-gray-900">Redis 6.x</dd>
              </div>
            </dl>
          </div>
        </motion.div>
      </div>
    </AdminLayout>
  );
}