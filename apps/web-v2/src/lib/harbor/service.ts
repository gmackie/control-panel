/**
 * Harbor Registry Service
 * High-level service for interacting with Harbor registry
 */

import { HarborClient, HarborProject, HarborRepository, HarborTag } from './client';

export interface RegistryStats {
  totalProjects: number;
  totalRepositories: number;
  totalTags: number;
  totalSize: number;
  totalPullCount: number;
  publicProjects: number;
  privateProjects: number;
}

export interface RepositoryInfo {
  id: number;
  name: string;
  fullName: string;
  project: string;
  description?: string;
  artifactCount: number;
  pullCount: number;
  createdAt: string;
  updatedAt: string;
  size: number;
  tags: TagInfo[];
  latestTag?: TagInfo;
  vulnerabilities?: VulnerabilitySummary;
}

export interface TagInfo {
  name: string;
  digest: string;
  size: number;
  pushedAt: string;
  pulledAt?: string;
  immutable: boolean;
  architecture?: string;
  os?: string;
}

export interface ArtifactInfo {
  id: number;
  digest: string;
  shortDigest: string;
  size: number;
  pushedAt: string;
  pulledAt?: string;
  tags: string[];
  type: string;
  architecture?: string;
  os?: string;
  vulnerabilities?: VulnerabilitySummary;
  scanStatus?: string;
}

export interface VulnerabilitySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  scanStatus?: string;
}

export class HarborService {
  private client: HarborClient;

  constructor() {
    const url = process.env.HARBOR_URL || process.env.REGISTRY_URL || 'https://registry.gmac.io';
    const username = process.env.HARBOR_USERNAME || process.env.REGISTRY_USERNAME || 'admin';
    const password = process.env.HARBOR_PASSWORD || process.env.REGISTRY_PASSWORD || '';

    this.client = new HarborClient({
      baseUrl: url,
      username,
      password,
    });
  }

  /**
   * Get overall registry statistics
   */
  async getStats(): Promise<RegistryStats> {
    try {
      const stats = await this.client.getStatistics();
      const projects = await this.client.listProjects();
      
      // Calculate total tags and size
      let totalTags = 0;
      let totalSize = 0;
      let totalPullCount = 0;

      for (const project of projects) {
        try {
          const repos = await this.client.listRepositories(project.name);
          for (const repo of repos) {
            totalPullCount += repo.pull_count;
            
            // Get artifacts to count tags and size
            const repoName = repo.name.split('/').slice(1).join('/');
            try {
              const artifacts = await this.client.listArtifacts(project.name, repoName, {
                withTag: true,
                pageSize: 100,
              });
              
              for (const artifact of artifacts) {
                totalSize += artifact.size;
                if (artifact.tags) {
                  totalTags += artifact.tags.length;
                }
              }
            } catch {
              // Skip if artifacts fail
            }
          }
        } catch {
          // Skip if repos fail
        }
      }

      return {
        totalProjects: stats.total_project_count,
        totalRepositories: stats.total_repo_count,
        totalTags,
        totalSize,
        totalPullCount,
        publicProjects: stats.public_project_count,
        privateProjects: stats.private_project_count,
      };
    } catch (error) {
      console.error('Error getting registry stats:', error);
      throw error;
    }
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<HarborProject[]> {
    return this.client.listProjects();
  }

  /**
   * List all repositories with details
   */
  async listAllRepositories(): Promise<RepositoryInfo[]> {
    const projects = await this.client.listProjects();
    const repositories: RepositoryInfo[] = [];

    for (const project of projects) {
      try {
        const repos = await this.client.listRepositories(project.name);
        
        for (const repo of repos) {
          const repoInfo = await this.getRepositoryInfo(project.name, repo);
          repositories.push(repoInfo);
        }
      } catch (error) {
        console.error(`Error listing repos for project ${project.name}:`, error);
      }
    }

    return repositories;
  }

  /**
   * Get detailed repository info including tags and artifacts
   */
  private async getRepositoryInfo(projectName: string, repo: HarborRepository): Promise<RepositoryInfo> {
    const repoName = repo.name.split('/').slice(1).join('/');
    const tags: TagInfo[] = [];
    let totalSize = 0;
    let latestTag: TagInfo | undefined;
    let vulnerabilities: VulnerabilitySummary | undefined;

    try {
      const artifacts = await this.client.listArtifacts(projectName, repoName, {
        withTag: true,
        withScanOverview: true,
        pageSize: 50,
      });

      for (const artifact of artifacts) {
        totalSize += artifact.size;
        
        // Extract vulnerability info from first scanned artifact
        if (!vulnerabilities && artifact.scan_overview) {
          const scanKey = Object.keys(artifact.scan_overview)[0];
          if (scanKey) {
            const scan = artifact.scan_overview[scanKey];
            vulnerabilities = {
              critical: scan.summary?.summary?.Critical || 0,
              high: scan.summary?.summary?.High || 0,
              medium: scan.summary?.summary?.Medium || 0,
              low: scan.summary?.summary?.Low || 0,
              total: scan.summary?.total || 0,
              scanStatus: scan.scan_status,
            };
          }
        }

        // Get platform info from references
        let architecture: string | undefined;
        let os: string | undefined;
        if (artifact.references && artifact.references.length > 0) {
          const ref = artifact.references.find((r: { platform?: { architecture?: string; os?: string } }) => 
            r.platform?.architecture && r.platform.architecture !== 'unknown'
          );
          if (ref?.platform) {
            architecture = ref.platform.architecture;
            os = ref.platform.os;
          }
        }

        if (artifact.tags && artifact.tags.length > 0) {
          for (const tag of artifact.tags) {
            const tagInfo: TagInfo = {
              name: tag.name,
              digest: artifact.digest,
              size: artifact.size,
              pushedAt: tag.push_time,
              pulledAt: tag.pull_time !== '0001-01-01T00:00:00.000Z' ? tag.pull_time : undefined,
              immutable: tag.immutable,
              architecture,
              os,
            };
            tags.push(tagInfo);

            if (tag.name === 'latest') {
              latestTag = tagInfo;
            }
          }
        }
      }

      // If no 'latest' tag, use most recent
      if (!latestTag && tags.length > 0) {
        latestTag = tags.sort((a, b) => 
          new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime()
        )[0];
      }
    } catch (error) {
      console.error(`Error getting artifacts for ${repo.name}:`, error);
    }

    return {
      id: repo.id,
      name: repoName,
      fullName: repo.name,
      project: projectName,
      description: repo.description,
      artifactCount: repo.artifact_count,
      pullCount: repo.pull_count,
      createdAt: repo.creation_time,
      updatedAt: repo.update_time,
      size: totalSize,
      tags,
      latestTag,
      vulnerabilities,
    };
  }

  /**
   * Get repository by name
   */
  async getRepository(projectName: string, repoName: string): Promise<RepositoryInfo> {
    const repo = await this.client.getRepository(projectName, repoName);
    return this.getRepositoryInfo(projectName, repo);
  }

  /**
   * List artifacts in a repository
   */
  async listArtifacts(projectName: string, repoName: string): Promise<ArtifactInfo[]> {
    const artifacts = await this.client.listArtifacts(projectName, repoName, {
      withTag: true,
      withScanOverview: true,
      pageSize: 50,
    });

    return artifacts.map(artifact => {
      // Get platform info
      let architecture: string | undefined;
      let os: string | undefined;
      if (artifact.references && artifact.references.length > 0) {
        const ref = artifact.references.find((r: { platform?: { architecture?: string; os?: string } }) => 
          r.platform?.architecture && r.platform.architecture !== 'unknown'
        );
        if (ref?.platform) {
          architecture = ref.platform.architecture;
          os = ref.platform.os;
        }
      }

      // Get vulnerability info
      let vulnerabilities: VulnerabilitySummary | undefined;
      let scanStatus: string | undefined;
      if (artifact.scan_overview) {
        const scanKey = Object.keys(artifact.scan_overview)[0];
        if (scanKey) {
          const scan = artifact.scan_overview[scanKey];
          scanStatus = scan.scan_status;
          vulnerabilities = {
            critical: scan.summary?.summary?.Critical || 0,
            high: scan.summary?.summary?.High || 0,
            medium: scan.summary?.summary?.Medium || 0,
            low: scan.summary?.summary?.Low || 0,
            total: scan.summary?.total || 0,
            scanStatus: scan.scan_status,
          };
        }
      }

      return {
        id: artifact.id,
        digest: artifact.digest,
        shortDigest: artifact.digest.substring(7, 19),
        size: artifact.size,
        pushedAt: artifact.push_time,
        pulledAt: artifact.pull_time !== '0001-01-01T00:00:00.000Z' ? artifact.pull_time : undefined,
        tags: artifact.tags?.map((t: HarborTag) => t.name) || [],
        type: artifact.type,
        architecture,
        os,
        vulnerabilities,
        scanStatus,
      };
    });
  }

  /**
   * Delete an image tag
   */
  async deleteTag(projectName: string, repoName: string, reference: string, tagName: string): Promise<void> {
    await this.client.deleteTag(projectName, repoName, reference, tagName);
  }

  /**
   * Trigger a vulnerability scan
   */
  async scanArtifact(projectName: string, repoName: string, reference: string): Promise<void> {
    await this.client.scanArtifact(projectName, repoName, reference);
  }

  /**
   * Add a tag to an artifact
   */
  async addTag(projectName: string, repoName: string, reference: string, tagName: string): Promise<void> {
    await this.client.createTag(projectName, repoName, reference, { name: tagName });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const health = await this.client.getHealth();
      return { healthy: health.status === 'healthy' };
    } catch (error) {
      return { healthy: false, message: String(error) };
    }
  }
}

// Export singleton instance
export const harborService = new HarborService();
