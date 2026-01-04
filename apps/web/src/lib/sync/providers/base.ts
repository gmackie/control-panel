/**
 * Base Sync Provider Adapter Interface
 * 
 * All provider adapters must implement this interface to enable
 * bidirectional sync between Control Panel and external providers.
 */

import type {
  SyncProvider,
  ExternalTaskData,
  ExternalReleaseData,
  TaskCreateInput,
  TaskUpdateInput,
  ReleaseCreateInput,
  TaskStatus,
  TaskPriority,
} from '../types';

/**
 * Configuration required to initialize a provider adapter
 */
export interface ProviderAdapterConfig {
  provider: SyncProvider;
  // Provider-specific configuration
  config: Record<string, unknown>;
}

/**
 * Result of a sync operation on a single item
 */
export interface SyncItemResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Batch sync result
 */
export interface BatchSyncResult<T> {
  items: T[];
  errors: Array<{ id?: string; message: string }>;
  hasMore: boolean;
  cursor?: string;
}

/**
 * Abstract base class for sync provider adapters
 * 
 * Each provider (GitHub, Gitea, Linear, Notion) extends this class
 * to implement provider-specific sync logic.
 */
export abstract class SyncProviderAdapter {
  protected provider: SyncProvider;
  protected config: Record<string, unknown>;

  constructor(config: ProviderAdapterConfig) {
    this.provider = config.provider;
    this.config = config.config;
  }

  /**
   * Get the provider type
   */
  getProvider(): SyncProvider {
    return this.provider;
  }

  // ===================================
  // Task Operations
  // ===================================

  /**
   * Pull all tasks from the external provider
   * Used for initial sync or full refresh
   */
  abstract pullTasks(options?: {
    cursor?: string;
    limit?: number;
  }): Promise<BatchSyncResult<ExternalTaskData>>;

  /**
   * Pull a single task by its external ID
   */
  abstract pullTask(externalId: string): Promise<ExternalTaskData | null>;

  /**
   * Push a new task to the external provider
   * Returns the created task with its external ID
   */
  abstract pushTask(task: TaskCreateInput): Promise<SyncItemResult<ExternalTaskData>>;

  /**
   * Update an existing task in the external provider
   */
  abstract updateTask(
    externalId: string,
    task: TaskUpdateInput
  ): Promise<SyncItemResult<ExternalTaskData>>;

  /**
   * Delete a task from the external provider
   * Note: Some providers may just close/archive instead of delete
   */
  abstract deleteTask(externalId: string): Promise<SyncItemResult<void>>;

  /**
   * Close/complete a task in the external provider
   */
  abstract closeTask(externalId: string): Promise<SyncItemResult<ExternalTaskData>>;

  // ===================================
  // Release Operations (optional)
  // ===================================

  /**
   * Check if this provider supports releases
   */
  supportsReleases(): boolean {
    return false;
  }

  /**
   * Pull all releases from the external provider
   */
  async pullReleases(_options?: {
    cursor?: string;
    limit?: number;
  }): Promise<BatchSyncResult<ExternalReleaseData>> {
    return { items: [], errors: [], hasMore: false };
  }

  /**
   * Pull a single release by its external ID or tag
   */
  async pullRelease(_externalIdOrTag: string): Promise<ExternalReleaseData | null> {
    return null;
  }

  /**
   * Push a new release to the external provider
   */
  async pushRelease(
    _release: ReleaseCreateInput
  ): Promise<SyncItemResult<ExternalReleaseData>> {
    return { success: false, error: 'Releases not supported by this provider' };
  }

  /**
   * Update an existing release in the external provider
   */
  async updateRelease(
    _externalId: string,
    _release: Partial<ReleaseCreateInput>
  ): Promise<SyncItemResult<ExternalReleaseData>> {
    return { success: false, error: 'Releases not supported by this provider' };
  }

  /**
   * Delete a release from the external provider
   */
  async deleteRelease(_externalId: string): Promise<SyncItemResult<void>> {
    return { success: false, error: 'Releases not supported by this provider' };
  }

  // ===================================
  // Health Check
  // ===================================

  /**
   * Check if the provider is accessible and credentials are valid
   */
  abstract healthCheck(): Promise<boolean>;

  // ===================================
  // Status Mapping Helpers
  // ===================================

  /**
   * Map provider-specific status to unified TaskStatus
   */
  protected abstract mapToUnifiedStatus(providerStatus: string): TaskStatus;

  /**
   * Map unified TaskStatus to provider-specific status
   */
  protected abstract mapToProviderStatus(status: TaskStatus): string;

  /**
   * Map provider-specific priority to unified TaskPriority
   */
  protected mapToUnifiedPriority(providerPriority: string | number | undefined): TaskPriority | undefined {
    // Default implementation - override in subclasses for provider-specific mapping
    if (!providerPriority) return undefined;
    
    const normalizedPriority = String(providerPriority).toLowerCase();
    
    if (['urgent', 'critical', 'p0', '0', '1'].includes(normalizedPriority)) {
      return 'urgent';
    }
    if (['high', 'p1', '2'].includes(normalizedPriority)) {
      return 'high';
    }
    if (['medium', 'normal', 'p2', '3'].includes(normalizedPriority)) {
      return 'medium';
    }
    if (['low', 'p3', '4', '5'].includes(normalizedPriority)) {
      return 'low';
    }
    
    return undefined;
  }

  /**
   * Map unified TaskPriority to provider-specific priority
   */
  protected mapToProviderPriority(priority: TaskPriority | undefined): string | number | undefined {
    // Default implementation - override in subclasses for provider-specific mapping
    return priority;
  }
}

/**
 * Factory function to create provider adapters
 */
export type SyncProviderAdapterFactory = (
  config: ProviderAdapterConfig
) => SyncProviderAdapter;
