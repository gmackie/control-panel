import { describe, it, expect, beforeEach } from 'vitest';
import { ProvisioningOrchestrator, createProvisioningOrchestrator } from '../../src/lib/provisioning/orchestrator';
import type { ProvisionerConfig, ProvisioningContext } from '../../src/lib/provisioning/types';

describe('ProvisioningOrchestrator', () => {
  describe('constructor', () => {
    it('should create an instance with empty config', () => {
      const config: ProvisionerConfig = {};
      const orchestrator = new ProvisioningOrchestrator(config);
      expect(orchestrator).toBeInstanceOf(ProvisioningOrchestrator);
    });

    it('should create an instance with neon config', () => {
      const config: ProvisionerConfig = {
        neon: { apiKey: 'test-neon-key' },
      };
      const orchestrator = new ProvisioningOrchestrator(config);
      expect(orchestrator).toBeInstanceOf(ProvisioningOrchestrator);
      expect(orchestrator.getAvailableProviders()).toContain('neon');
    });

    it('should create an instance with vercel config', () => {
      const config: ProvisionerConfig = {
        vercel: { token: 'test-vercel-token' },
      };
      const orchestrator = new ProvisioningOrchestrator(config);
      expect(orchestrator).toBeInstanceOf(ProvisioningOrchestrator);
      expect(orchestrator.getAvailableProviders()).toContain('vercel');
    });
  });

  describe('provision', () => {
    it('should return success with empty results when no steps are configured', async () => {
      const orchestrator = new ProvisioningOrchestrator({});
      const context: ProvisioningContext = {
        applicationId: 'test-app-id',
        applicationName: 'Test App',
        applicationSlug: 'test-app',
      };

      const result = await orchestrator.provision(context);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should report available providers', () => {
      const orchestrator = new ProvisioningOrchestrator({
        neon: { apiKey: 'test-key' },
        vercel: { token: 'test-token' },
      });

      const providers = orchestrator.getAvailableProviders();

      expect(providers).toContain('neon');
      expect(providers).toContain('vercel');
      expect(providers.length).toBe(2);
    });
  });

  describe('createProvisioningOrchestrator', () => {
    it('should create orchestrator with default config from env', () => {
      const orchestrator = createProvisioningOrchestrator();
      expect(orchestrator).toBeInstanceOf(ProvisioningOrchestrator);
    });

    it('should create orchestrator with provided config', () => {
      const config: ProvisionerConfig = {
        neon: { apiKey: 'explicit-key' },
      };
      const orchestrator = createProvisioningOrchestrator(config);
      expect(orchestrator.getAvailableProviders()).toContain('neon');
    });
  });
});
