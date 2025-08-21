import { Router } from 'express';
import { ContactService } from './contact.service';
import { authMiddleware } from '../auth/auth.middleware';
import subscriberManagementRoutes from './subscriber-management.routes';
import multer from 'multer';
import {
  CreateContactRequest,
  UpdateContactRequest,
  CreateContactListRequest,
  UpdateContactListRequest,
  ImportContactsRequest,
  ContactSearchFilters,
  ContactExportRequest,
  CSVImportMapping,
  SuppressionType
} from './contact.types';

const router = Router();
const contactService = new ContactService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Apply authentication middleware to all routes (except public unsubscribe)
router.use('/contacts', subscriberManagementRoutes);
router.use(authMiddleware);

// Contact CRUD Routes
router.post('/contacts', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const contactData: CreateContactRequest = req.body;
    
    const contact = await contactService.createContact(tenantId, contactData);
    res.status(201).json(contact);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/contacts/:contactId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { contactId } = req.params;
    
    const contact = await contactService.getContact(tenantId, contactId);
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/contacts/:contactId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { contactId } = req.params;
    const updates: UpdateContactRequest = req.body;
    
    const contact = await contactService.updateContact(tenantId, contactId, updates);
    res.json(contact);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/contacts/:contactId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { contactId } = req.params;
    
    await contactService.deleteContact(tenantId, contactId);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/contacts', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const filters: ContactSearchFilters = req.query;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await contactService.searchContacts(tenantId, filters, limit, offset);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Contact List Routes
router.post('/lists', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const listData: CreateContactListRequest = req.body;
    
    const list = await contactService.createContactList(tenantId, listData);
    res.status(201).json(list);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/lists', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    const lists = await contactService.getContactLists(tenantId);
    res.json(lists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/lists/:listId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { listId } = req.params;
    
    const list = await contactService.getContactList(tenantId, listId);
    
    if (!list) {
      return res.status(404).json({ error: 'Contact list not found' });
    }
    
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/lists/:listId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { listId } = req.params;
    const updates: UpdateContactListRequest = req.body;
    
    const list = await contactService.updateContactList(tenantId, listId, updates);
    res.json(list);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/lists/:listId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { listId } = req.params;
    
    await contactService.deleteContactList(tenantId, listId);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/lists/:listId/contacts', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { listId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await contactService.getContactsInList(tenantId, listId, limit, offset);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/lists/:listId/contacts/:contactId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { listId, contactId } = req.params;
    
    await contactService.addContactToList(tenantId, contactId, listId);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/lists/:listId/contacts/:contactId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { listId, contactId } = req.params;
    
    await contactService.removeContactFromList(tenantId, contactId, listId);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// CSV Import/Export Routes
router.post('/import', upload.single('csvFile'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }
    
    const mapping: CSVImportMapping = JSON.parse(req.body.mapping);
    const options: ImportContactsRequest = JSON.parse(req.body.options);
    
    const result = await contactService.importContactsFromCSV(
      tenantId,
      req.file.buffer,
      req.file.originalname,
      mapping,
      options
    );
    
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/export', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const exportRequest: ContactExportRequest = req.body;
    
    const result = await contactService.exportContacts(tenantId, exportRequest);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Suppression List Routes
router.post('/suppression', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { email, type, reason, sourceCampaignId } = req.body;
    
    await contactService.addToSuppressionList(tenantId, email, type, reason, sourceCampaignId);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/suppression', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { email, type } = req.query;
    
    await contactService.removeFromSuppressionList(tenantId, email as string, type as SuppressionType);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/suppression', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const type = req.query.type as SuppressionType;
    
    const suppressionList = await contactService.getSuppressionList(tenantId, type);
    res.json(suppressionList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/suppression/check/:email', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { email } = req.params;
    
    const isSuppressed = await contactService.isEmailSuppressed(tenantId, email);
    res.json({ email, isSuppressed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Engagement Tracking Routes
router.post('/engagement', async (req, res) => {
  try {
    const event = req.body;
    
    await contactService.recordEngagementEvent(event);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/contacts/:contactId/engagement', async (req, res) => {
  try {
    const { contactId } = req.params;
    
    const engagement = await contactService.getContactEngagement(contactId);
    res.json(engagement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;