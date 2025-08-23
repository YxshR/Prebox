'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  UserIcon, 
  GlobeAltIcon,
  ClockIcon,
  PaintBrushIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { settingsApi, UserSettings } from '@/lib/settingsApi';

const timezones = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' }
];

const languages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'zh', label: '中文' },
  { value: 'hi', label: 'हिन्दी' }
];

export default function GeneralSettings() {
  const [settings, setSettings] = useState<UserSettings>({
    emailNotifications: true,
    timezone: 'UTC',
    language: 'en'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const userSettings = await settingsApi.getUserSettings();
      setSettings(userSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Use default settings if loading fails
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await settingsApi.updateUserSettings(settings);
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = (key: keyof UserSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Profile Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-6"
      >
        <div className="flex items-center space-x-3 mb-6">
          <UserIcon className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Profile Settings</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <Input
              placeholder="Enter your first name"
              // This would be connected to user profile data
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <Input
              placeholder="Enter your last name"
              // This would be connected to user profile data
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <Input
              type="email"
              placeholder="your@email.com"
              disabled
              // This would be connected to user profile data
            />
            <p className="text-sm text-gray-500 mt-1">Contact support to change your email address</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <Input
              type="tel"
              placeholder="+1 (555) 123-4567"
              // This would be connected to user profile data
            />
          </div>
        </div>
      </motion.div>

      {/* Localization Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-6"
      >
        <div className="flex items-center space-x-3 mb-6">
          <GlobeAltIcon className="h-6 w-6 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900">Localization</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <ClockIcon className="h-4 w-4 inline mr-1" />
              Timezone
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => updateSetting('timezone', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Current time: {new Date().toLocaleString('en-US', { timeZone: settings.timezone })}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <GlobeAltIcon className="h-4 w-4 inline mr-1" />
              Language
            </label>
            <select
              value={settings.language}
              onChange={(e) => updateSetting('language', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {languages.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Interface language for the dashboard
            </p>
          </div>
        </div>
      </motion.div>

      {/* Customization Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-6"
      >
        <div className="flex items-center space-x-3 mb-6">
          <PaintBrushIcon className="h-6 w-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">Customization</h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Dashboard Theme
            </label>
            <div className="grid grid-cols-3 gap-4">
              {['Light', 'Dark', 'Auto'].map((theme) => (
                <motion.button
                  key={theme}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    theme === 'Light' // Default selection for demo
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-8 h-8 mx-auto mb-2 rounded ${
                    theme === 'Light' ? 'bg-white border' :
                    theme === 'Dark' ? 'bg-gray-800' : 'bg-gradient-to-r from-white to-gray-800'
                  }`} />
                  <span className="text-sm font-medium">{theme}</span>
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Dashboard Density
            </label>
            <div className="space-y-2">
              {['Comfortable', 'Compact', 'Spacious'].map((density) => (
                <label key={density} className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="density"
                    value={density}
                    defaultChecked={density === 'Comfortable'}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{density}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center space-x-2">
          {savedMessage && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-2 text-green-600"
            >
              <CheckIcon className="h-4 w-4" />
              <span className="text-sm">Settings saved successfully!</span>
            </motion.div>
          )}
        </div>
        
        <Button
          onClick={handleSave}
          loading={isSaving}
          className="flex items-center space-x-2"
        >
          <span>Save Changes</span>
        </Button>
      </motion.div>
    </div>
  );
}