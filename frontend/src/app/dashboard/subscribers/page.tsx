'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UsersIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ClockIcon,
  EnvelopeIcon,
  EyeIcon,
  CursorArrowRaysIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { contactApi } from '../../../lib/contactApi';
import {
  Contact,
  ContactList,
  ContactSearchFilters,
  SuppressionEntry,
  ContactEngagementSummary,
  EmailHistoryEntry,
  SubscriptionStatus,
  SuppressionType
} from '../../../types/contact';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { Pagination } from '../../../components/ui/Pagination';
import EngagementChart from '../../../components/dashboard/EngagementChart';
import ContactEngagementVisualization from '../../../components/dashboard/ContactEngagementVisualization';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface TabType {
  id: 'contacts' | 'lists' | 'suppression' | 'history';
  name: string;
  icon: any;
  count?: number;
}

export default function SubscribersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType['id']>('contacts');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Contacts state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [contactsPage, setContactsPage] = useState(1);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  
  // Lists state
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [selectedList, setSelectedList] = useState<ContactList | null>(null);
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState('');
  
  // Suppression state
  const [suppressionEntries, setSuppressionEntries] = useState<SuppressionEntry[]>([]);
  const [suppressionFilter, setSuppressionFilter] = useState<SuppressionType | 'all'>('all');
  
  // History state
  const [emailHistory, setEmailHistory] = useState<EmailHistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  
  // Engagement state
  const [selectedContactEngagement, setSelectedContactEngagement] = useState<ContactEngagementSummary | null>(null);
  const [showEngagementModal, setShowEngagementModal] = useState(false);
  
  // Unsubscribe confirmation state
  const [showUnsubscribeModal, setShowUnsubscribeModal] = useState(false);
  const [contactToUnsubscribe, setContactToUnsubscribe] = useState<Contact | null>(null);

  const itemsPerPage = 20;

  const tabs: TabType[] = [
    { id: 'contacts', name: 'Contacts', icon: UsersIcon, count: contactsTotal },
    { id: 'lists', name: 'Lists', icon: UsersIcon, count: contactLists.length },
    { id: 'suppression', name: 'Suppression', icon: ExclamationTriangleIcon, count: suppressionEntries.length },
    { id: 'history', name: 'Email History', icon: ClockIcon, count: historyTotal }
  ];

  useEffect(() => {
    loadData();
  }, [activeTab, contactsPage, historyPage, searchQuery, suppressionFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'contacts':
          await loadContacts();
          break;
        case 'lists':
          await loadContactLists();
          break;
        case 'suppression':
          await loadSuppressionList();
          break;
        case 'history':
          await loadEmailHistory();
          break;
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    const filters: ContactSearchFilters = {};
    if (searchQuery) {
      filters.email = searchQuery;
    }
    
    const offset = (contactsPage - 1) * itemsPerPage;
    const result = await contactApi.getContacts(filters, itemsPerPage, offset);
    setContacts(result.contacts);
    setContactsTotal(result.total);
  };

  const loadContactLists = async () => {
    const lists = await contactApi.getContactLists();
    setContactLists(lists);
  };

  const loadSuppressionList = async () => {
    const type = suppressionFilter === 'all' ? undefined : suppressionFilter as SuppressionType;
    const entries = await contactApi.getSuppressionList(type);
    setSuppressionEntries(entries);
  };

  const loadEmailHistory = async () => {
    const offset = (historyPage - 1) * itemsPerPage;
    const result = await contactApi.getEmailHistory(undefined, itemsPerPage, offset);
    setEmailHistory(result.history);
    setHistoryTotal(result.total);
  };

  const handleUnsubscribeContact = async (contact: Contact) => {
    setContactToUnsubscribe(contact);
    setShowUnsubscribeModal(true);
  };

  const confirmUnsubscribe = async () => {
    if (!contactToUnsubscribe) return;
    
    try {
      await contactApi.updateContact(contactToUnsubscribe.id, {
        subscriptionStatus: SubscriptionStatus.UNSUBSCRIBED
      });
      
      await contactApi.addToSuppressionList(
        contactToUnsubscribe.email,
        SuppressionType.UNSUBSCRIBE,
        'Manual unsubscribe from dashboard'
      );
      
      toast.success('Contact unsubscribed successfully');
      setShowUnsubscribeModal(false);
      setContactToUnsubscribe(null);
      loadData();
    } catch (error) {
      toast.error('Failed to unsubscribe contact');
    }
  };

  const handleViewEngagement = async (contact: Contact) => {
    try {
      const engagement = await contactApi.getContactEngagement(contact.id);
      setSelectedContactEngagement(engagement);
      setShowEngagementModal(true);
    } catch (error) {
      toast.error('Failed to load engagement data');
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    
    try {
      await contactApi.createContactList({ name: newListName.trim() });
      toast.success('List created successfully');
      setShowCreateList(false);
      setNewListName('');
      loadContactLists();
    } catch (error) {
      toast.error('Failed to create list');
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm('Are you sure you want to delete this list?')) return;
    
    try {
      await contactApi.deleteContactList(listId);
      toast.success('List deleted successfully');
      loadContactLists();
    } catch (error) {
      toast.error('Failed to delete list');
    }
  };

  const getStatusBadgeColor = (status: SubscriptionStatus) => {
    switch (status) {
      case SubscriptionStatus.SUBSCRIBED:
        return 'bg-green-100 text-green-800';
      case SubscriptionStatus.UNSUBSCRIBED:
        return 'bg-gray-100 text-gray-800';
      case SubscriptionStatus.BOUNCED:
        return 'bg-red-100 text-red-800';
      case SubscriptionStatus.COMPLAINED:
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEngagementScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Subscribers & History
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your contacts, lists, and view email engagement history
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                  {tab.count !== undefined && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="bg-gray-100 text-gray-600 rounded-full px-2 py-1 text-xs"
                    >
                      {tab.count}
                    </motion.span>
                  )}
                </motion.button>
              ))}
            </nav>
          </div>
        </motion.div>

        {/* Search and Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 flex flex-col sm:flex-row gap-4 justify-between"
        >
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            {activeTab === 'lists' && (
              <Button
                onClick={() => setShowCreateList(true)}
                className="flex items-center space-x-2"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Create List</span>
              </Button>
            )}
            
            {activeTab === 'suppression' && (
              <select
                value={suppressionFilter}
                onChange={(e) => setSuppressionFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="unsubscribe">Unsubscribed</option>
                <option value="bounce">Bounced</option>
                <option value="complaint">Complaints</option>
                <option value="manual">Manual</option>
              </select>
            )}
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-white/20"
        >
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6"
              >
                <LoadingSkeleton 
                  type={activeTab === 'lists' ? 'card' : 'table'} 
                  rows={activeTab === 'lists' ? 6 : 8}
                />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {activeTab === 'contacts' && (
                  <ContactsTab
                    contacts={contacts}
                    onUnsubscribe={handleUnsubscribeContact}
                    onViewEngagement={handleViewEngagement}
                  />
                )}
                
                {activeTab === 'lists' && (
                  <ListsTab
                    lists={contactLists}
                    onDeleteList={handleDeleteList}
                  />
                )}
                
                {activeTab === 'suppression' && (
                  <SuppressionTab entries={suppressionEntries} />
                )}
                
                {activeTab === 'history' && (
                  <HistoryTab history={emailHistory} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Pagination */}
          {!loading && (activeTab === 'contacts' || activeTab === 'history') && (
            <div className="px-6 py-4 border-t border-gray-200">
              <Pagination
                currentPage={activeTab === 'contacts' ? contactsPage : historyPage}
                totalPages={Math.ceil((activeTab === 'contacts' ? contactsTotal : historyTotal) / itemsPerPage)}
                onPageChange={(page) => {
                  if (activeTab === 'contacts') {
                    setContactsPage(page);
                  } else {
                    setHistoryPage(page);
                  }
                }}
              />
            </div>
          )}
        </motion.div>
      </div>

      {/* Unsubscribe Confirmation Modal */}
      <AnimatePresence>
        {showUnsubscribeModal && (
          <UnsubscribeModal
            contact={contactToUnsubscribe}
            onConfirm={confirmUnsubscribe}
            onCancel={() => {
              setShowUnsubscribeModal(false);
              setContactToUnsubscribe(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Engagement Modal */}
      <AnimatePresence>
        {showEngagementModal && selectedContactEngagement && (
          <EngagementModal
            engagement={selectedContactEngagement}
            onClose={() => {
              setShowEngagementModal(false);
              setSelectedContactEngagement(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Create List Modal */}
      <AnimatePresence>
        {showCreateList && (
          <CreateListModal
            value={newListName}
            onChange={setNewListName}
            onConfirm={handleCreateList}
            onCancel={() => {
              setShowCreateList(false);
              setNewListName('');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Contacts Tab Component
function ContactsTab({ 
  contacts, 
  onUnsubscribe, 
  onViewEngagement 
}: { 
  contacts: Contact[];
  onUnsubscribe: (contact: Contact) => void;
  onViewEngagement: (contact: Contact) => void;
}) {
  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white/50 divide-y divide-gray-200">
            <AnimatePresence>
              {contacts.map((contact, index) => (
                <motion.tr
                  key={contact.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {contact.firstName || contact.lastName 
                          ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                          : 'No name'
                        }
                      </div>
                      <div className="text-sm text-gray-500">{contact.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(contact.subscriptionStatus)}`}
                    >
                      {contact.subscriptionStatus}
                    </motion.span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {contact.source}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(contact.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onViewEngagement(contact)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded"
                        title="View Engagement"
                      >
                        <ChartBarIcon className="h-4 w-4" />
                      </motion.button>
                      {contact.subscriptionStatus === SubscriptionStatus.SUBSCRIBED && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => onUnsubscribe(contact)}
                          className="text-red-600 hover:text-red-900 p-1 rounded"
                          title="Unsubscribe"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </motion.button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      
      {contacts.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No contacts found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by importing contacts or adding them manually.
          </p>
        </motion.div>
      )}
    </div>
  );
}

// Lists Tab Component
function ListsTab({ 
  lists, 
  onDeleteList 
}: { 
  lists: ContactList[];
  onDeleteList: (listId: string) => void;
}) {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {lists.map((list, index) => (
            <motion.div
              key={list.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -4 }}
              className="bg-white/70 backdrop-blur-sm rounded-lg p-6 border border-white/20 shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {list.name}
                  </h3>
                  {list.description && (
                    <p className="text-sm text-gray-600 mb-3">
                      {list.description}
                    </p>
                  )}
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <UsersIcon className="h-4 w-4 mr-1" />
                      {list.contactCount} contacts
                    </span>
                    <span>
                      {new Date(list.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onDeleteList(list.id)}
                  className="text-red-600 hover:text-red-900 p-1 rounded"
                  title="Delete List"
                >
                  <TrashIcon className="h-4 w-4" />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {lists.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No lists found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create your first contact list to organize your subscribers.
          </p>
        </motion.div>
      )}
    </div>
  );
}

// Suppression Tab Component
function SuppressionTab({ entries }: { entries: SuppressionEntry[] }) {
  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reason
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white/50 divide-y divide-gray-200">
            <AnimatePresence>
              {entries.map((entry, index) => (
                <motion.tr
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {entry.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        entry.suppressionType === 'unsubscribe' ? 'bg-gray-100 text-gray-800' :
                        entry.suppressionType === 'bounce' ? 'bg-red-100 text-red-800' :
                        entry.suppressionType === 'complaint' ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {entry.suppressionType}
                    </motion.span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.reason || 'No reason provided'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      
      {entries.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No suppressed contacts</h3>
          <p className="mt-1 text-sm text-gray-500">
            Contacts who unsubscribe or bounce will appear here.
          </p>
        </motion.div>
      )}
    </div>
  );
}

// History Tab Component
function HistoryTab({ history }: { history: EmailHistoryEntry[] }) {
  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sent Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white/50 divide-y divide-gray-200">
            <AnimatePresence>
              {history.map((entry, index) => (
                <motion.tr
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {entry.subject}
                        </div>
                        {entry.campaignId && (
                          <div className="text-sm text-gray-500">
                            Campaign: {entry.campaignId}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        entry.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        entry.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                        entry.status === 'bounced' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {entry.status}
                    </motion.span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {entry.eventType === 'opened' && <EyeIcon className="h-4 w-4 text-blue-500 mr-2" />}
                      {entry.eventType === 'clicked' && <CursorArrowRaysIcon className="h-4 w-4 text-green-500 mr-2" />}
                      {entry.eventType === 'delivered' && <EnvelopeIcon className="h-4 w-4 text-green-500 mr-2" />}
                      <span className="text-sm text-gray-900">{entry.eventType}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(entry.sentAt).toLocaleString()}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      
      {history.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No email history</h3>
          <p className="mt-1 text-sm text-gray-500">
            Email sending history will appear here once you start sending campaigns.
          </p>
        </motion.div>
      )}
    </div>
  );
}

// Unsubscribe Confirmation Modal
function UnsubscribeModal({ 
  contact, 
  onConfirm, 
  onCancel 
}: { 
  contact: Contact | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!contact) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-lg p-6 max-w-md w-full"
      >
        <div className="flex items-center mb-4">
          <ExclamationTriangleIcon className="h-6 w-6 text-orange-500 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">
            Confirm Unsubscribe
          </h3>
        </div>
        
        <p className="text-gray-600 mb-6">
          Are you sure you want to unsubscribe <strong>{contact.email}</strong>? 
          This action will add them to the suppression list and they won't receive future emails.
        </p>
        
        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Unsubscribe
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Engagement Modal
function EngagementModal({ 
  engagement, 
  onClose 
}: { 
  engagement: ContactEngagementSummary;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-lg p-6 max-w-lg w-full"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Contact Engagement
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <ContactEngagementVisualization engagement={engagement} />
        
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Create List Modal
function CreateListModal({ 
  value, 
  onChange, 
  onConfirm, 
  onCancel 
}: { 
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-lg p-6 max-w-md w-full"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Create New List
        </h3>
        
        <Input
          label="List Name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter list name..."
          className="mb-6"
        />
        
        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={onConfirm}
            disabled={!value.trim()}
          >
            Create List
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function getStatusBadgeColor(status: SubscriptionStatus) {
  switch (status) {
    case SubscriptionStatus.SUBSCRIBED:
      return 'bg-green-100 text-green-800';
    case SubscriptionStatus.UNSUBSCRIBED:
      return 'bg-gray-100 text-gray-800';
    case SubscriptionStatus.BOUNCED:
      return 'bg-red-100 text-red-800';
    case SubscriptionStatus.COMPLAINED:
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getEngagementScoreColor(score: number) {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}