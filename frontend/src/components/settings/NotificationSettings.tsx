'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BellIcon, 
  EnvelopeIcon,
  GlobeAltIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { settingsApi, UserSettings } from '@/lib/settingsApi';

interface NotificationPreference {
  id: string;
  label: string;
  description: string;
  email: boolean;
  webhook: boolean;
  category: 'campaigns' | 'billing' | 'security' | 'system';
}

const notificationPreferences: NotificationPreference[] = [
  {
    id: 'campaign_completed',
    label: 'Campaign Completed',
    description: 'When your email campaign finishes sending',
    email: true,
    webhook: true,
    category: 'campaigns'
  },
  {
    id: 'campaign_failed',
    label: 'Campaign Failed',
    description: 'When your email campaign encounters errors',
    email: true,
    webhook: true,
    category: 'campaigns'
  },
  {
    id: 'high_bounce_rate',
    label: 'High Bounce Rate',
    description: 'When your campaign has unusually high bounce rates',
    email: true,
    webhook: false,
    category: 'campaigns'
  },
  {
    id: 'quota_warning',
    label: 'Quota Warning',
    description: 'When you approach your monthly sending limits',
    email: true,
    webhook: false,
    category: 'billing'
  },
  {
    id: 'payment_failed',
    label: 'Payment Failed',
    description: 'When a subscription payment fails',
    email: true,
    webhook: false,
    category: 'billing'
  },
  {
    id: 'subscription_expiring',
    label: 'Subscription Expiring',
    description: 'When your subscription is about to expire',
    email: true,
    webhook: false,
    category: 'billing'
  },
  {
    id: 'api_key_used',
    label: 'New API Key Usage',
    description: 'When an API key is used for the first time',
    email: false,
    webhook: true,
    category: 'security'
  },
  {
    id: 'login_new_device',
    label: 'New Device Login',
    description: 'When you log in from a new device',
    email: true,
    webhook: false,
    category: 'security'
  },
  {
    id: 'system_maintenance',
    label: 'System Maintenance',
    description: 'Scheduled maintenance notifications',
    email: true,
    webhook: false,
    category: 'system'
  }
];

const categoryIcons = {
  campaigns: EnvelopeIcon,
  billing: InformationCircleIcon,
  security: ExclamationTriangleIcon,
  system: GlobeAltIcon
};

const categoryColors = {
  campaigns: 'blue',
  billing: 'green',
  security: 'red',
  system: 'purple'
};

export default function NotificationSettings() {
  const [settings, setSettings] = useState<UserSettings>({
    emailNotifications: true,
    webhookUrl: '',
    timezone: 'UTC',
    language: 'en'
  });
  const [preferences, setPreferences] = useState<Record<string, NotificationPreference>>(
    Object.fromEntries(notificationPreferences.map(pref => [pref.id, pref]))
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);

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

  const testWebhook = async () => {
    if (!settings.webhookUrl) return;
    
    try {
      setWebhookTesting(true);
      // This would call a test webhook endpoint
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      alert('Test webhook sent successfully!');
    } catch (error) {
      console.error('Failed to test webhook:', error);
      alert('Failed to send test webhook');
    } finally {
      setWebhookTesting(false);
    }
  };

  const updatePreference = (id: string, field: 'email' | 'webhook', value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const groupedPreferences = notificationPreferences.reduce((acc, pref) => {
    if (!acc[pref.category]) {
      acc[pref.category] = [];
    }
    acc[pref.category].push(pref);
    return acc;
  }, {} as Record<string, NotificationPreference[]>);

  if (isLoading) {
    return <LoadingSkeleton type="card" rows={4} />;
  }

  return (
    <div className="space-y-6">
      {/* Global Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-6"
      >
        <div className="flex items-center space-x-3 mb-6">
          <BellIcon className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Global Notification Settings</h2>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <h3 className="font-medium text-blue-900">Email Notifications</h3>
              <p className="text-sm text-blue-700 mt-1">
                Receive notifications via email
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => setSettings(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div>
            <Input
              label="Webhook URL (Optional)"
              value={settings.webhookUrl || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, webhookUrl: e.target.value }))}
              placeholder="https://your-app.com/webhooks/email-notifications"
              helperText="Receive real-time notifications via HTTP POST requests"
            />
            {settings.webhookUrl && (
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testWebhook}
                  loading={webhookTesting}
                  className="flex items-center space-x-2"
                >
                  <GlobeAltIcon className="h-4 w-4" />
                  <span>Test Webhook</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Notification Preferences by Category */}
      {Object.entries(groupedPreferences).map(([category, prefs], categoryIndex) => {
        const IconComponent = categoryIcons[category as keyof typeof categoryIcons];
        const color = categoryColors[category as keyof typeof categoryColors];
        
        return (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (categoryIndex + 1) * 0.1 }}
            className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-6"
          >
            <div className="flex items-center space-x-3 mb-6">
              <IconComponent className={`h-6 w-6 text-${color}-600`} />
              <h2 className="text-xl font-semibold text-gray-900 capitalize">
                {category} Notifications
              </h2>
            </div>

            <div className="space-y-4">
              {prefs.map((pref) => (
                <div
                  key={pref.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{pref.label}</h3>
                    <p className="text-sm text-gray-600 mt-1">{pref.description}</p>
                  </div>
                  
                  <div className="flex items-center space-x-6 ml-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={preferences[pref.id]?.email ?? pref.email}
                        onChange={(e) => updatePreference(pref.id, 'email', e.target.checked)}
                        disabled={!settings.emailNotifications}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="text-sm text-gray-700">Email</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={preferences[pref.id]?.webhook ?? pref.webhook}
                        onChange={(e) => updatePreference(pref.id, 'webhook', e.target.checked)}
                        disabled={!settings.webhookUrl}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="text-sm text-gray-700">Webhook</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}

      {/* Webhook Documentation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gray-50/70 backdrop-blur-sm rounded-xl border border-gray-200 shadow-lg p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Webhook Format</h3>
        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-green-400 text-sm">
{`{
  "event": "campaign_completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "campaignId": "camp_123456",
    "campaignName": "Weekly Newsletter",
    "status": "completed",
    "emailsSent": 1250,
    "deliveryRate": 98.4
  },
  "signature": "sha256=abc123..."
}`}
          </pre>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Webhooks are signed with HMAC-SHA256. Verify the signature using your webhook secret.
        </p>
      </motion.div>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
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
              <span className="text-sm">Notification settings saved successfully!</span>
            </motion.div>
          )}
        </div>
        
        <Button
          onClick={handleSave}
          loading={isSaving}
          className="flex items-center space-x-2"
        >
          <span>Save Notification Settings</span>
        </Button>
      </motion.div>
    </div>
  );
}