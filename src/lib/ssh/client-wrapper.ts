// This is a wrapper to prevent SSH client from being imported on the client side
export interface SSHConnectionOptions {
  privateKey: string;
  username?: string;
  port?: number;
  timeout?: number;
}

export interface SSHExecuteResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface ISSHClient {
  execute(host: string, command: string, options: SSHConnectionOptions): Promise<SSHExecuteResult>;
  executeScript(host: string, script: string, options: SSHConnectionOptions): Promise<SSHExecuteResult>;
  uploadFile(host: string, localPath: string, remotePath: string, options: SSHConnectionOptions): Promise<void>;
  downloadFile(host: string, remotePath: string, localPath: string, options: SSHConnectionOptions): Promise<void>;
  verifyKeyExists(keyPath: string): Promise<boolean>;
  addToKnownHosts(host: string): Promise<void>;
  disconnect(host: string, port?: number): Promise<void>;
  disconnectAll(): Promise<void>;
}

// Server-side implementation
export async function createSSHClient(): Promise<ISSHClient> {
  if (typeof window !== 'undefined') {
    throw new Error('SSH client cannot be used on the client side');
  }
  
  // Mock implementation for now
  return {
    async execute(host: string, command: string, options: SSHConnectionOptions): Promise<SSHExecuteResult> {
      console.log(`Would execute on ${host}: ${command}`);
      return { stdout: '', stderr: '', code: 0 };
    },
    async executeScript(host: string, script: string, options: SSHConnectionOptions): Promise<SSHExecuteResult> {
      console.log(`Would execute script on ${host}`);
      return { stdout: '', stderr: '', code: 0 };
    },
    async uploadFile(host: string, localPath: string, remotePath: string, options: SSHConnectionOptions): Promise<void> {
      console.log(`Would upload ${localPath} to ${host}:${remotePath}`);
    },
    async downloadFile(host: string, remotePath: string, localPath: string, options: SSHConnectionOptions): Promise<void> {
      console.log(`Would download ${host}:${remotePath} to ${localPath}`);
    },
    async verifyKeyExists(keyPath: string): Promise<boolean> {
      return true; // Mock: assume key exists
    },
    async addToKnownHosts(host: string): Promise<void> {
      console.log(`Would add ${host} to known hosts`);
    },
    async disconnect(host: string, port?: number): Promise<void> {
      console.log(`Would disconnect from ${host}`);
    },
    async disconnectAll(): Promise<void> {
      console.log('Would disconnect all');
    },
  };
}