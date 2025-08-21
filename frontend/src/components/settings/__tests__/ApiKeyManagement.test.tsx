import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ApiKeyManagement from '../ApiKeyManagement';
import { settingsApi } from '../../../lib/settingsApi';

// Mock the settings API
jest.mock('../../../lib/settingsApi');
const mockSettingsApi = settingsApi as jest.Mocked<typeof settingsApi>;

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe('ApiKeyManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders API key management interface', async () => {
    // Mock API responses
    mockSettingsApi.listApiKeys.mockResolvedValue([]);
    mockSettingsApi.getAvailableScopes.mockResolvedValue({
      availableScopes: ['email:send', 'email:read'],
      limits: { maxKeys: 3, rateLimits: { hourly: 500, daily: 1000, monthly: 30000 } },
      currentTier: 'paid_standard'
    });

    render(<ApiKeyManagement />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    // Check if the create button is present
    expect(screen.getByText('Create API Key')).toBeInTheDocument();
    
    // Check if tier information is displayed
    expect(screen.getByText('PAID STANDARD Tier')).toBeInTheDocument();
  });

  it('displays existing API keys', async () => {
    const mockApiKeys = [
      {
        id: '1',
        name: 'Test API Key',
        scopes: ['email:send'],
        isActive: true,
        createdAt: new Date('2024-01-01'),
        lastUsedAt: new Date('2024-01-15')
      }
    ];

    mockSettingsApi.listApiKeys.mockResolvedValue(mockApiKeys);
    mockSettingsApi.getAvailableScopes.mockResolvedValue({
      availableScopes: ['email:send', 'email:read'],
      limits: { maxKeys: 3, rateLimits: { hourly: 500, daily: 1000, monthly: 30000 } },
      currentTier: 'paid_standard'
    });

    render(<ApiKeyManagement />);

    await waitFor(() => {
      expect(screen.getByText('Test API Key')).toBeInTheDocument();
    });

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('email:send')).toBeInTheDocument();
  });

  it('opens create API key form when create button is clicked', async () => {
    mockSettingsApi.listApiKeys.mockResolvedValue([]);
    mockSettingsApi.getAvailableScopes.mockResolvedValue({
      availableScopes: ['email:send', 'email:read'],
      limits: { maxKeys: 3, rateLimits: { hourly: 500, daily: 1000, monthly: 30000 } },
      currentTier: 'paid_standard'
    });

    render(<ApiKeyManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create API Key')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create API Key'));

    await waitFor(() => {
      expect(screen.getByText('Create New API Key')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('API Key Name')).toBeInTheDocument();
    expect(screen.getByText('Scopes (Select at least one)')).toBeInTheDocument();
  });
});