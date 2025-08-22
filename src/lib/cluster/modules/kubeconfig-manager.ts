import { BaseClusterModule } from './base';
import * as crypto from 'crypto';
import * as yaml from 'js-yaml';

interface KubeconfigData {
  apiVersion: string;
  clusters: Array<{
    cluster: {
      'certificate-authority-data': string;
      server: string;
    };
    name: string;
  }>;
  contexts: Array<{
    context: {
      cluster: string;
      user: string;
    };
    name: string;
  }>;
  'current-context': string;
  kind: string;
  users: Array<{
    name: string;
    user: {
      'client-certificate-data'?: string;
      'client-key-data'?: string;
      token?: string;
    };
  }>;
}

export class KubeconfigManager extends BaseClusterModule {
  name = 'kubeconfig-manager';
  version = '1.0.0';
  description = 'Manages KUBECONFIG secrets for cluster access';

  private configs: Map<string, string> = new Map();
  private encryptionKey: string;

  constructor(encryptionKey?: string) {
    super();
    this.encryptionKey = encryptionKey || process.env.KUBECONFIG_ENCRYPTION_KEY || '';
    if (!this.encryptionKey) {
      console.warn('No encryption key provided, kubeconfigs will be stored in plaintext');
    }
  }

  async initialize(): Promise<void> {
    // Load existing kubeconfigs from database or secret store
    await this.loadKubeconfigs();
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Check if we can access at least one cluster
      for (const [clusterName, kubeconfig] of this.configs) {
        const kubectl = this.getKubectlCommand(clusterName, kubeconfig);
        await kubectl('get nodes --no-headers | wc -l');
      }
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: `Failed to access clusters: ${error}`,
      };
    }
  }

  async storeKubeconfig(clusterName: string, kubeconfig: string): Promise<void> {
    // Validate kubeconfig
    this.validateKubeconfig(kubeconfig);
    
    // Encrypt if encryption key is available
    const configToStore = this.encryptionKey
      ? await this.encrypt(kubeconfig)
      : kubeconfig;
    
    // Store in memory
    this.configs.set(clusterName, configToStore);
    
    // Persist to database or secret store
    await this.persistKubeconfig(clusterName, configToStore);
  }

  async getKubeconfig(clusterName: string): Promise<string | undefined> {
    const encrypted = this.configs.get(clusterName);
    if (!encrypted) {
      return undefined;
    }
    
    return this.encryptionKey
      ? await this.decrypt(encrypted)
      : encrypted;
  }

  async removeKubeconfig(clusterName: string): Promise<void> {
    this.configs.delete(clusterName);
    await this.deletePersistedKubeconfig(clusterName);
  }

  async listClusters(): Promise<string[]> {
    return Array.from(this.configs.keys());
  }

  getKubectlCommand(
    clusterName: string,
    kubeconfig?: string
  ): (command: string) => Promise<string> {
    return async (command: string): Promise<string> => {
      const config = kubeconfig || await this.getKubeconfig(clusterName);
      if (!config) {
        throw new Error(`No kubeconfig found for cluster: ${clusterName}`);
      }
      
      // Create temporary kubeconfig file
      const tempFile = `/tmp/kubeconfig-${clusterName}-${Date.now()}.yaml`;
      const fs = require('fs').promises;
      
      try {
        await fs.writeFile(tempFile, config, { mode: 0o600 });
        
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        const { stdout, stderr } = await execAsync(
          `KUBECONFIG=${tempFile} kubectl ${command}`
        );
        
        if (stderr) {
          console.warn(`kubectl stderr: ${stderr}`);
        }
        
        return stdout;
      } finally {
        // Clean up temp file
        try {
          await fs.unlink(tempFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }

  async mergeKubeconfigs(configs: string[]): Promise<string> {
    const parsed = configs.map(config => 
      yaml.load(config) as KubeconfigData
    );
    
    const merged: KubeconfigData = {
      apiVersion: 'v1',
      kind: 'Config',
      'current-context': parsed[0]['current-context'],
      clusters: [],
      contexts: [],
      users: [],
    };
    
    // Merge all configs
    for (const config of parsed) {
      merged.clusters.push(...config.clusters);
      merged.contexts.push(...config.contexts);
      merged.users.push(...config.users);
    }
    
    // Remove duplicates
    merged.clusters = this.uniqueBy(merged.clusters, 'name');
    merged.contexts = this.uniqueBy(merged.contexts, 'name');
    merged.users = this.uniqueBy(merged.users, 'name');
    
    return yaml.dump(merged);
  }

  async rotateCredentials(clusterName: string): Promise<void> {
    const kubeconfig = await this.getKubeconfig(clusterName);
    if (!kubeconfig) {
      throw new Error(`No kubeconfig found for cluster: ${clusterName}`);
    }
    
    // This would typically involve:
    // 1. Creating new service account
    // 2. Generating new credentials
    // 3. Updating kubeconfig
    // 4. Testing new credentials
    // 5. Removing old credentials
    
    // For now, just log the action
    console.log(`Rotating credentials for cluster: ${clusterName}`);
  }

  private validateKubeconfig(kubeconfig: string): void {
    try {
      const parsed = yaml.load(kubeconfig) as KubeconfigData;
      
      if (!parsed.clusters || parsed.clusters.length === 0) {
        throw new Error('No clusters defined in kubeconfig');
      }
      
      if (!parsed.users || parsed.users.length === 0) {
        throw new Error('No users defined in kubeconfig');
      }
      
      if (!parsed.contexts || parsed.contexts.length === 0) {
        throw new Error('No contexts defined in kubeconfig');
      }
    } catch (error) {
      throw new Error(`Invalid kubeconfig: ${error}`);
    }
  }

  private async encrypt(data: string): Promise<string> {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(64);
    const key = crypto.pbkdf2Sync(this.encryptionKey, salt, 100000, 32, 'sha256');
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    });
  }

  private async decrypt(encryptedData: string): Promise<string> {
    const { encrypted, salt, iv, authTag } = JSON.parse(encryptedData);
    const algorithm = 'aes-256-gcm';
    
    const key = crypto.pbkdf2Sync(
      this.encryptionKey,
      Buffer.from(salt, 'hex'),
      100000,
      32,
      'sha256'
    );
    
    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private async loadKubeconfigs(): Promise<void> {
    // In production, this would load from database or secret store
    // For now, we'll use environment variables or local storage
    
    const k3sToken = process.env.K3S_SA_TOKEN;
    const k8sApiUrl = process.env.K8S_API_URL;
    
    if (k3sToken && k8sApiUrl) {
      // Create a basic kubeconfig from service account token
      const kubeconfig = this.createKubeconfigFromToken(
        'default',
        k8sApiUrl,
        k3sToken
      );
      
      await this.storeKubeconfig('default', kubeconfig);
    }
  }

  private createKubeconfigFromToken(
    clusterName: string,
    apiUrl: string,
    token: string
  ): string {
    const kubeconfig: KubeconfigData = {
      apiVersion: 'v1',
      kind: 'Config',
      'current-context': clusterName,
      clusters: [{
        name: clusterName,
        cluster: {
          server: apiUrl,
          'certificate-authority-data': '', // Would need to fetch this
        },
      }],
      contexts: [{
        name: clusterName,
        context: {
          cluster: clusterName,
          user: 'sa-user',
        },
      }],
      users: [{
        name: 'sa-user',
        user: {
          token,
        },
      }],
    };
    
    return yaml.dump(kubeconfig);
  }

  private async persistKubeconfig(clusterName: string, kubeconfig: string): Promise<void> {
    // In production, store in database or Kubernetes secret
    // For now, just log
    console.log(`Persisting kubeconfig for cluster: ${clusterName}`);
  }

  private async deletePersistedKubeconfig(clusterName: string): Promise<void> {
    // In production, delete from database or Kubernetes secret
    console.log(`Deleting persisted kubeconfig for cluster: ${clusterName}`);
  }

  private uniqueBy<T>(array: T[], key: keyof T): T[] {
    const seen = new Set();
    return array.filter(item => {
      const value = item[key];
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  }
}