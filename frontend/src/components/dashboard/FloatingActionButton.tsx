'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { 
  PlusIcon, 
  PaperAirplaneIcon, 
  DocumentTextIcon, 
  UserGroupIcon,
  SparklesIcon 
} from '@heroicons/react/24/outline';

export default function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    {
      name: 'Send Email',
      icon: PaperAirplaneIcon,
      color: 'bg-blue-500 hover:bg-blue-600',
      action: () => console.log('Send email')
    },
    {
      name: 'Create Template',
      icon: DocumentTextIcon,
      color: 'bg-purple-500 hover:bg-purple-600',
      action: () => console.log('Create template')
    },
    {
      name: 'Import Contacts',
      icon: UserGroupIcon,
      color: 'bg-green-500 hover:bg-green-600',
      action: () => console.log('Import contacts')
    },
    {
      name: 'AI Generate',
      icon: SparklesIcon,
      color: 'bg-orange-500 hover:bg-orange-600',
      action: () => console.log('AI generate')
    }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-16 right-0 space-y-3"
          >
            {actions.map((action, index) => (
              <motion.button
                key={action.name}
                initial={{ opacity: 0, x: 20, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 20, y: 20 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.1, x: -5 }}
                whileTap={{ scale: 0.9 }}
                onClick={action.action}
                className={`flex items-center space-x-3 px-4 py-3 ${action.color} text-white rounded-full shadow-lg transition-all duration-200 group`}
              >
                <action.icon className="h-5 w-5" />
                <span className="text-sm font-medium whitespace-nowrap">{action.name}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg flex items-center justify-center"
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <PlusIcon className="h-6 w-6" />
        </motion.div>
      </motion.button>
    </div>
  );
}