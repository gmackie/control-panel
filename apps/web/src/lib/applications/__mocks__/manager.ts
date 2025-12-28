const getApplications = jest.fn().mockResolvedValue([
  {
    id: 'app-001',
    name: 'Control Panel',
    description: 'Main control panel application',
    slug: 'control-panel',
    gitRepo: 'https://github.com/gmac/control-panel',
    status: 'deployed',
    environment: 'production',
    apiKeys: [],
    secrets: [],
    settings: {},
    environments: ['development', 'staging', 'production'],
    ownerId: 'test@gmac.io',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'app-002',
    name: 'API Gateway',
    description: 'API Gateway service',
    slug: 'api-gateway',
    gitRepo: 'https://github.com/gmac/api-gateway',
    status: 'deployed',
    environment: 'production',
    apiKeys: [],
    secrets: [],
    settings: {},
    environments: ['production'],
    ownerId: 'test@gmac.io',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]);

const createApplication = jest.fn().mockImplementation(async (data) => ({
  id: 'app-new',
  name: data.name,
  description: data.description,
  slug: data.slug || data.name?.toLowerCase().replace(/\s+/g, '-'),
  gitRepo: data.gitRepo || `https://github.com/gmac/${data.name?.toLowerCase().replace(/\s+/g, '-')}`,
  status: 'pending',
  environment: 'development',
  apiKeys: [],
  secrets: [],
  settings: data.settings || {},
  environments: data.environments || ['development'],
  ownerId: 'test@gmac.io',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}));

const getApplication = jest.fn().mockImplementation(async (id) => {
  if (id === 'app-001') {
    return {
      id: 'app-001',
      name: 'Control Panel',
      description: 'Main control panel application',
      slug: 'control-panel',
      gitRepo: 'https://github.com/gmac/control-panel',
      status: 'deployed',
      environment: 'production',
      apiKeys: [],
      secrets: [],
      settings: {},
      environments: ['development', 'staging', 'production'],
      ownerId: 'test@gmac.io',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
  return null;
});

const updateApplication = jest.fn().mockImplementation(async (id, updates) => {
  if (id === 'app-001') {
    return {
      id: 'app-001',
      name: 'Control Panel',
      description: 'Main control panel application',
      slug: 'control-panel',
      apiKeys: [],
      secrets: [],
      settings: {},
      environments: ['development', 'staging', 'production'],
      ownerId: 'test@gmac.io',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...updates
    };
  }
  return null;
});

const deleteApplication = jest.fn().mockResolvedValue(true);

const createApiKey = jest.fn().mockImplementation(async () => ({
  id: 'key-001',
  applicationId: 'app-001',
  name: 'Test API Key',
  key: 'sk_test_1234567890abcdef',
  prefix: 'sk_test_',
  hashedKey: 'hashed_key_value',
  lastUsed: null,
  createdAt: new Date().toISOString(),
  expiresAt: null
}));

const createSecret = jest.fn().mockImplementation(async (appId, data) => ({
  id: 'secret-001',
  applicationId: appId,
  name: data.name,
  value: 'encrypted_value',
  encrypted: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}));

module.exports = {
  getApplications,
  createApplication,
  getApplication,
  updateApplication,
  deleteApplication,
  createApiKey,
  createSecret
};