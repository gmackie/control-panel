/**
 * Provider Adapters Index
 * 
 * Exports all sync provider adapters for external use.
 */

export { SyncProviderAdapter, type ProviderAdapterConfig, type BatchSyncResult, type SyncItemResult } from './base';
export { GitHubSyncAdapter, type GitHubAdapterConfig } from './github';
export { GiteaSyncAdapter, type GiteaAdapterConfig } from './gitea';
export { LinearSyncAdapter, type LinearAdapterConfig } from './linear';
export { NotionSyncAdapter, type NotionAdapterConfig } from './notion';
