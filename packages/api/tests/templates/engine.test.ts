import { describe, it, expect } from 'vitest';
import { createTemplateEngine } from '../../src/lib/templates/engine';
import type { TemplateSource } from '../../src/lib/templates/types';

const TEMPLATE_PATH = '/Volumes/dev/vercel-neon-expo-template';

describe('TemplateEngine', () => {
  const engine = createTemplateEngine('/tmp/template-engine-test');

  describe('loadTemplateMetadata', () => {
    it('should load template config from local source', async () => {
      const source: TemplateSource = {
        type: 'local',
        url: TEMPLATE_PATH,
        path: TEMPLATE_PATH,
      };

      const metadata = await engine.loadTemplateMetadata(source);

      expect(metadata.config).toBeDefined();
      expect(metadata.config.name).toBe('Vercel + Expo App Template');
      expect(metadata.config.version).toBe('1.0.0');
      expect(metadata.config.features.web).toBe(true);
      expect(metadata.config.features.mobile).toBe(true);
      expect(metadata.config.supportedProviders.git).toContain('github');
      expect(metadata.config.supportedProviders.deploy).toContain('vercel');
      expect(metadata.config.supportedProviders.database).toContain('neon');
    });

    it('should load placeholders config', async () => {
      const source: TemplateSource = {
        type: 'local',
        url: TEMPLATE_PATH,
        path: TEMPLATE_PATH,
      };

      const metadata = await engine.loadTemplateMetadata(source);

      expect(metadata.placeholders).toBeDefined();
      expect(metadata.placeholders.placeholders['{{APP_NAME}}']).toBeDefined();
      expect(metadata.placeholders.placeholders['{{APP_SLUG}}']).toBeDefined();
      expect(metadata.placeholders.placeholders['{{PACKAGE_SCOPE}}']).toBeDefined();
    });

    it('should load integration modules', async () => {
      const source: TemplateSource = {
        type: 'local',
        url: TEMPLATE_PATH,
        path: TEMPLATE_PATH,
      };

      const metadata = await engine.loadTemplateMetadata(source);

      expect(metadata.integrations).toBeDefined();
      expect(metadata.integrations.length).toBeGreaterThan(0);

      const neon = metadata.integrations.find(i => i.id === 'neon');
      expect(neon).toBeDefined();
      expect(neon?.category).toBe('database');

      const clerk = metadata.integrations.find(i => i.id === 'clerk');
      expect(clerk).toBeDefined();
      expect(clerk?.category).toBe('auth');

      const stripe = metadata.integrations.find(i => i.id === 'stripe');
      expect(stripe).toBeDefined();
      expect(stripe?.category).toBe('payments');
    });
  });

  describe('buildPlaceholderValues', () => {
    it('should build placeholder values from input', async () => {
      const source: TemplateSource = {
        type: 'local',
        url: TEMPLATE_PATH,
        path: TEMPLATE_PATH,
      };

      const metadata = await engine.loadTemplateMetadata(source);
      
      const input = {
        templateId: 'test',
        appName: 'My Test App',
        appSlug: 'my-test-app',
        description: 'A test application',
        modules: ['neon', 'clerk'],
        gitProvider: 'github' as const,
        deployProvider: 'vercel' as const,
        dbProvider: 'neon' as const,
      };

      const values = (engine as any).buildPlaceholderValues(input, metadata.placeholders);

      expect(values['{{APP_NAME}}']).toBe('My Test App');
      expect(values['{{APP_SLUG}}']).toBe('my-test-app');
      expect(values['{{PACKAGE_SCOPE}}']).toBe('@my-test-app');
    });
  });
});
