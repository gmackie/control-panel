/**
 * Task Sync Module
 * 
 * Provides bidirectional sync between Control Panel and external providers:
 * - GitHub Issues
 * - Gitea Issues
 * - Linear Issues
 * - Notion Tasks
 * 
 * Control Panel is the source of truth - conflicts are resolved in favor of local data.
 */

// Types
export * from './types';

// Provider Adapters
export * from './providers';

// Sync Engine
export { TaskSyncEngine, taskSyncEngine } from './task-sync-engine';
