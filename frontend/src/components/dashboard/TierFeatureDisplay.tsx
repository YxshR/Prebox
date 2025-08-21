'use client';

import { motion } from 'framer-motion';
import { 
  CheckIcon, 
  XMarkIcon, 
  StarIcon,
  SparklesIcon,
  ArrowUpIcon
} from '@heroicons/react/24/outline';

interface TierFeatureDisplayProps {
  currentTier: string;
}

interface TierFeature {
  name: string;
  free: boolean | string;
  standard: boolean | string;
  premium: boolean | string;
  enterprise: boolean | string;
}

export default function TierFeatureDisplay({ currentTier }: TierFeatureDisplayProps) {
  const features: TierFeature[] = [
    {
      name: 'Daily Email Limit',
      free: '100 emails',
      standard: '500-1000 emails',
      premium: '2000-5000 emails',
      enterprise: 'Unlimited'
    },
    {
      name: 'Monthly Recipients',
      free: '300 recipients',
      standard: '1500-5000 recipients',
      premium: '10000-25000 recipients',
      enterprise: 'Unlimited'
    },
    {
      name: 'AI Templates (Daily)',
      free: '1 template',
      standard: '10 templates',
      premium: 'Unlimited',
      enterprise: 'Unlimited'
    },
    {
      name: 'Logo Customization',
      free: false,
      standard: true,
      premium: true,
      enterprise: true
    },
    {
      name: 'Custom Domains',
      free: false,
      standard: false,
      premium: '2-10 domains',
      enterprise: 'Unlimited'
    },
    {
      name: 'Email History',
      free: '3 days',
      standard: 'Full history',
      premium: 'Full history',
      enterprise: 'Full history'
    },
    {
      name: 'Branding Removal',
      free: false,
      standard: false,
      premium: true,
      enterprise: true
    },
    {
      name: 'Priority Support',
      free: false,
      standard: false,
      premium: true,
      enterprise: 'Dedicated'
    }
  ];

  const tiers = [
    {
      id: 'free',
      name: 'Free',
      price: '₹0',
      icon: StarIcon,
      color: 'gray',
      description: 'Perfect for getting started'
    },
    {
      id: 'paid_standard',
      name: 'Standard',
      price: '₹39-59',
      icon: SparklesIcon,
      color: 'blue',
      description: 'Great for small businesses'
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '₹249-649',
      icon: StarIcon,
      color: 'purple',
      description: 'Advanced features for growth'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Custom',
      icon: StarIcon,
      color: 'gold',
      description: 'Unlimited everything'
    }
  ];

  const getCurrentTierIndex = () => {
    return tiers.findIndex(tier => tier.id === currentTier);
  };

  const renderFeatureValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <CheckIcon className="h-5 w-5 text-green-500" />
      ) : (
        <XMarkIcon className="h-5 w-5 text-red-400" />
      );
    }
    return <span className="text-sm text-gray-700">{value}</span>;
  };

  const getColorClasses = (color: string, isActive: boolean = false) => {
    const colors = {
      gray: {
        bg: isActive ? 'bg-gray-100' : 'bg-white',
        border: isActive ? 'border-gray-400' : 'border-gray-200',
        text: 'text-gray-900',
        button: 'bg-gray-600 hover:bg-gray-700'
      },
      blue: {
        bg: isActive ? 'bg-blue-50' : 'bg-white',
        border: isActive ? 'border-blue-400' : 'border-gray-200',
        text: 'text-blue-900',
        button: 'bg-blue-600 hover:bg-blue-700'
      },
      purple: {
        bg: isActive ? 'bg-purple-50' : 'bg-white',
        border: isActive ? 'border-purple-400' : 'border-gray-200',
        text: 'text-purple-900',
        button: 'bg-purple-600 hover:bg-purple-700'
      },
      gold: {
        bg: isActive ? 'bg-yellow-50' : 'bg-white',
        border: isActive ? 'border-yellow-400' : 'border-gray-200',
        text: 'text-yellow-900',
        button: 'bg-yellow-600 hover:bg-yellow-700'
      }
    };
    return colors[color as keyof typeof colors] || colors.gray;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="bg-white rounded-xl shadow-lg p-6 border border-gray-100"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Subscription Tiers</h3>
        <p className="text-sm text-gray-500">Compare features and upgrade your plan</p>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {tiers.map((tier, index) => {
          const isActive = tier.id === currentTier;
          const colors = getColorClasses(tier.color, isActive);
          const Icon = tier.icon;

          return (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className={`relative p-4 rounded-lg border-2 transition-all duration-200 ${colors.bg} ${colors.border}`}
            >
              {isActive && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1"
                >
                  <CheckIcon className="h-4 w-4" />
                </motion.div>
              )}

              <div className="flex items-center space-x-2 mb-3">
                <Icon className={`h-5 w-5 ${colors.text}`} />
                <h4 className={`font-semibold ${colors.text}`}>{tier.name}</h4>
              </div>

              <div className="mb-2">
                <span className={`text-2xl font-bold ${colors.text}`}>{tier.price}</span>
                {tier.price !== 'Custom' && tier.price !== '₹0' && (
                  <span className="text-sm text-gray-500">/month</span>
                )}
              </div>

              <p className="text-sm text-gray-600 mb-4">{tier.description}</p>

              {!isActive && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`w-full px-3 py-2 text-white rounded-lg transition-colors text-sm ${colors.button}`}
                >
                  {index > getCurrentTierIndex() ? 'Upgrade' : 'Downgrade'}
                </motion.button>
              )}

              {isActive && (
                <div className="w-full px-3 py-2 bg-green-100 text-green-800 rounded-lg text-center text-sm font-medium">
                  Current Plan
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-900">Features</th>
              {tiers.map((tier) => (
                <th key={tier.id} className="text-center py-3 px-4 font-semibold text-gray-900">
                  {tier.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((feature, index) => (
              <motion.tr
                key={feature.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="py-3 px-4 font-medium text-gray-900">{feature.name}</td>
                <td className="py-3 px-4 text-center">{renderFeatureValue(feature.free)}</td>
                <td className="py-3 px-4 text-center">{renderFeatureValue(feature.standard)}</td>
                <td className="py-3 px-4 text-center">{renderFeatureValue(feature.premium)}</td>
                <td className="py-3 px-4 text-center">{renderFeatureValue(feature.enterprise)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Upgrade Suggestion */}
      {currentTier !== 'enterprise' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ArrowUpIcon className="h-5 w-5 text-blue-600" />
              <div>
                <h4 className="font-medium text-blue-900">Ready to upgrade?</h4>
                <p className="text-sm text-blue-700">
                  Unlock more features and higher limits with a premium plan.
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
            >
              View Plans
            </motion.button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}