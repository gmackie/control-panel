import { HetznerClient } from '@/lib/hetzner/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface GiteaVPSConfig {
  serverName: string;
  serverType: string;
  location: string;
  sshKeyPath: string;
  domain: string;
  email: string;
  useHttps: boolean;
  enableActions: boolean;
  enableRegistry: boolean;
}

export interface GiteaStatus {
  server: {
    id: number;
    name: string;
    status: string;
    ip: string;
    created: Date;
    type: string;
    location: string;
  };
  services: {
    gitea: ServiceStatus;
    postgres: ServiceStatus;
    runner: ServiceStatus;
    registry: ServiceStatus;
  };
  resources: {
    cpu: number;
    memory: number;
    disk: number;
  };
  version: string;
  url: string;
}

interface ServiceStatus {
  running: boolean;
  healthy: boolean;
  restartCount?: number;
  error?: string;
}

export class GiteaManager {
  private hetznerClient: HetznerClient;
  private config: GiteaVPSConfig;
  private serverIp?: string;

  constructor(hetznerToken: string, config: GiteaVPSConfig) {
    this.hetznerClient = new HetznerClient(hetznerToken);
    this.config = config;
  }

  async provisionGiteaVPS(): Promise<{ serverId: number; ip: string }> {
    // Check if server already exists
    const servers = await this.hetznerClient.listServers();
    const existingServer = servers.find(s => s.name === this.config.serverName);
    
    if (existingServer) {
      this.serverIp = existingServer.public_net.ipv4.ip;
      return {
        serverId: existingServer.id,
        ip: this.serverIp
      };
    }

    // Create new server
    const server = await this.hetznerClient.createServer({
      name: this.config.serverName,
      server_type: this.config.serverType,
      image: 'ubuntu-22.04',
      location: this.config.location,
      ssh_keys: [], // Add SSH key IDs if available
      user_data: this.generateCloudInit(),
    });

    this.serverIp = server.public_net.ipv4.ip;

    // Wait for server to be ready
    await this.waitForServer(server.id);

    return {
      serverId: server.id,
      ip: this.serverIp
    };
  }

  private generateCloudInit(): string {
    return `#cloud-config
package_update: true
package_upgrade: true
packages:
  - docker.io
  - docker-compose
  - git
  - nginx
  - certbot
  - python3-certbot-nginx
  - curl
  - htop
  - ufw

runcmd:
  # Enable swap
  - fallocate -l 4G /swapfile
  - chmod 600 /swapfile
  - mkswap /swapfile
  - swapon /swapfile
  - echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
  
  # Configure firewall
  - ufw allow 22/tcp
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw allow 222/tcp
  - ufw --force enable
  
  # Start Docker
  - systemctl enable docker
  - systemctl start docker
`;
  }

  async deployGitea(): Promise<void> {
    if (!this.serverIp) {
      throw new Error('Server IP not set. Provision server first.');
    }

    // Copy docker-compose and configuration files
    await this.copyConfigurationFiles();

    // Deploy using docker-compose
    await this.executeRemoteCommand(`
      cd /opt/gitea && \
      docker-compose up -d
    `);

    // Wait for services to be healthy
    await this.waitForServices();

    // Configure Nginx if HTTPS is enabled
    if (this.config.useHttps) {
      await this.configureNginx();
    }
  }

  private async copyConfigurationFiles(): Promise<void> {
    const dockerComposePath = path.join(process.cwd(), '..', 'docker-compose.yml');
    
    // Create directory structure
    await this.executeRemoteCommand('mkdir -p /opt/gitea');

    // Copy docker-compose file
    await execAsync(`
      scp -o StrictHostKeyChecking=no -i ${this.config.sshKeyPath} \
      ${dockerComposePath} \
      root@${this.serverIp}:/opt/gitea/docker-compose.yml
    `);

    // Create .env file with configuration
    const envContent = `
DOMAIN=${this.config.domain}
ENABLE_ACTIONS=${this.config.enableActions}
ENABLE_REGISTRY=${this.config.enableRegistry}
`;

    await this.executeRemoteCommand(`
      cat > /opt/gitea/.env << 'EOF'
${envContent}
EOF
    `);
  }

  private async configureNginx(): Promise<void> {
    const nginxConfig = `
server {
    listen 80;
    server_name ${this.config.domain};
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /v2/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Required for docker registry
        proxy_read_timeout 900;
        client_max_body_size 0;
    }
}
`;

    await this.executeRemoteCommand(`
      cat > /etc/nginx/sites-available/gitea << 'EOF'
${nginxConfig}
EOF
      ln -sf /etc/nginx/sites-available/gitea /etc/nginx/sites-enabled/
      nginx -t && systemctl reload nginx
    `);

    // Obtain SSL certificate
    if (this.config.email) {
      await this.executeRemoteCommand(`
        certbot --nginx -d ${this.config.domain} --non-interactive --agree-tos -m ${this.config.email}
      `);
    }
  }

  async getStatus(): Promise<GiteaStatus> {
    if (!this.serverIp) {
      throw new Error('Server IP not set');
    }

    // Get server info from Hetzner
    const servers = await this.hetznerClient.listServers();
    const server = servers.find(s => s.name === this.config.serverName);
    
    if (!server) {
      throw new Error('Server not found');
    }

    // Get service status
    const servicesOutput = await this.executeRemoteCommand(`
      cd /opt/gitea && docker-compose ps --format json
    `);

    const services = this.parseServiceStatus(servicesOutput);

    // Get resource usage
    const resources = await this.getResourceUsage();

    // Get Gitea version
    const versionOutput = await this.executeRemoteCommand(`
      docker exec gitea gitea --version || echo "unknown"
    `);

    return {
      server: {
        id: server.id,
        name: server.name,
        status: server.status,
        ip: server.public_net.ipv4.ip,
        created: new Date(server.created),
        type: server.server_type.name,
        location: server.datacenter.location.name,
      },
      services,
      resources,
      version: versionOutput.trim().split(' ')[2] || 'unknown',
      url: `${this.config.useHttps ? 'https' : 'http'}://${this.config.domain}`,
    };
  }

  private parseServiceStatus(output: string): GiteaStatus['services'] {
    const services: GiteaStatus['services'] = {
      gitea: { running: false, healthy: false },
      postgres: { running: false, healthy: false },
      runner: { running: false, healthy: false },
      registry: { running: false, healthy: false },
    };

    try {
      const lines = output.trim().split('\n');
      for (const line of lines) {
        if (!line) continue;
        const service = JSON.parse(line);
        const name = service.Service;
        const status = {
          running: service.State === 'running',
          healthy: service.Health === 'healthy' || service.State === 'running',
        };

        if (name.includes('gitea')) services.gitea = status;
        else if (name.includes('postgres')) services.postgres = status;
        else if (name.includes('runner')) services.runner = status;
        else if (name.includes('registry')) services.registry = status;
      }
    } catch (error) {
      console.error('Error parsing service status:', error);
    }

    return services;
  }

  private async getResourceUsage(): Promise<{ cpu: number; memory: number; disk: number }> {
    const output = await this.executeRemoteCommand(`
      echo "CPU:$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)"
      echo "MEM:$(free | grep Mem | awk '{print ($3/$2) * 100.0}')"
      echo "DISK:$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')"
    `);

    const metrics: any = {};
    output.trim().split('\n').forEach(line => {
      const [key, value] = line.split(':');
      metrics[key.toLowerCase()] = parseFloat(value) || 0;
    });

    return {
      cpu: metrics.cpu || 0,
      memory: metrics.mem || 0,
      disk: metrics.disk || 0,
    };
  }

  async restartService(service: 'gitea' | 'postgres' | 'runner' | 'registry'): Promise<void> {
    await this.executeRemoteCommand(`
      cd /opt/gitea && docker-compose restart ${service}
    `);
  }

  async getLogs(service: string, lines: number = 100): Promise<string> {
    return await this.executeRemoteCommand(`
      cd /opt/gitea && docker-compose logs --tail=${lines} ${service}
    `);
  }

  async updateGitea(version?: string): Promise<void> {
    // Pull latest images
    await this.executeRemoteCommand(`
      cd /opt/gitea && \
      docker-compose pull && \
      docker-compose up -d
    `);
  }

  async backupGitea(): Promise<{ path: string; size: number }> {
    const backupPath = `/opt/gitea/backups/gitea-backup-${Date.now()}.tar.gz`;
    
    await this.executeRemoteCommand(`
      mkdir -p /opt/gitea/backups && \
      docker exec gitea su git -c "gitea dump -c /data/gitea/conf/app.ini -f ${backupPath}"
    `);

    const sizeOutput = await this.executeRemoteCommand(`
      stat -c%s ${backupPath}
    `);

    return {
      path: backupPath,
      size: parseInt(sizeOutput.trim()),
    };
  }

  private async executeRemoteCommand(command: string): Promise<string> {
    if (!this.serverIp) {
      throw new Error('Server IP not set');
    }

    const { stdout, stderr } = await execAsync(`
      ssh -o StrictHostKeyChecking=no -i ${this.config.sshKeyPath} \
      root@${this.serverIp} "${command}"
    `);

    if (stderr && !stderr.includes('Warning')) {
      console.error('Remote command stderr:', stderr);
    }

    return stdout;
  }

  private async waitForServer(serverId: number, timeout: number = 300): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout * 1000) {
      const server = await this.hetznerClient.getServer(serverId);
      
      if (server.status === 'running') {
        // Try SSH connection
        try {
          await this.executeRemoteCommand('echo "Server ready"');
          return;
        } catch (error) {
          // SSH not ready yet
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('Server provisioning timeout');
  }

  private async waitForServices(timeout: number = 300): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout * 1000) {
      try {
        const status = await this.getStatus();
        
        if (status.services.gitea.running && status.services.postgres.running) {
          return;
        }
      } catch (error) {
        // Services not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('Services startup timeout');
  }
}