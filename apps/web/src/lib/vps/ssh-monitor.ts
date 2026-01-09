import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'failed' | 'unknown';
  activeState?: string;
  subState?: string;
  memory?: string;
  cpu?: string;
  uptime?: string;
  pid?: number;
  description?: string;
}

export interface NginxSite {
  name: string;
  enabled: boolean;
  serverNames: string[];
  listenPorts: number[];
  proxyPass?: string;
  sslEnabled: boolean;
  configFile: string;
}

export interface ContainerStatus {
  name: string;
  status: 'running' | 'stopped' | 'unhealthy' | 'unknown';
  health?: string;
  ports?: string;
  uptime?: string;
  image?: string;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAvg: [number, number, number];
  };
  memory: {
    total: number;
    used: number;
    available: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    available: number;
    usagePercent: number;
  };
  uptime: string;
}

export interface VPSMonitorResult {
  hostname: string;
  ip: string;
  reachable: boolean;
  responseTime: number;
  systemMetrics?: SystemMetrics;
  services: ServiceStatus[];
  containers: ContainerStatus[];
  nginxSites?: NginxSite[];
  error?: string;
}

const SSH_KEY_PATH = process.env.SSH_KEY_PATH || '/home/nextjs/.ssh/id_ed25519';
const SSH_KNOWN_HOSTS = process.env.SSH_KNOWN_HOSTS_PATH || '/home/nextjs/.ssh/known_hosts';
const SSH_OPTIONS = `-o StrictHostKeyChecking=yes -o UserKnownHostsFile=${SSH_KNOWN_HOSTS} -o ConnectTimeout=10 -o BatchMode=yes -i ${SSH_KEY_PATH}`;

async function sshExec(host: string, command: string, timeoutMs = 15000): Promise<string> {
  try {
    const sshCmd = `ssh ${SSH_OPTIONS} root@${host} "${command.replace(/"/g, '\\"')}"`;
    const { stdout } = await execAsync(sshCmd, { timeout: timeoutMs });
    return stdout.trim();
  } catch (error: any) {
    if (error.killed) {
      throw new Error('SSH command timed out');
    }
    throw error;
  }
}

async function getSystemMetrics(host: string): Promise<SystemMetrics | undefined> {
  try {
    const metricsCmd = `
      echo "===CPU===" && 
      nproc && 
      cat /proc/loadavg && 
      top -bn1 | grep "Cpu(s)" | awk '{print $2}' && 
      echo "===MEM===" && 
      free -b | grep Mem && 
      echo "===DISK===" && 
      df -B1 / | tail -1 && 
      echo "===UPTIME===" && 
      uptime -p
    `;
    
    const output = await sshExec(host, metricsCmd);
    const sections = output.split('===');
    
    const cpuSection = sections.find(s => s.startsWith('CPU'))?.split('\n').filter(Boolean) || [];
    const cores = parseInt(cpuSection[1] || '1');
    const loadAvgParts = (cpuSection[2] || '0 0 0').split(' ');
    const cpuUsage = parseFloat(cpuSection[3] || '0');
    
    const memSection = sections.find(s => s.startsWith('MEM'))?.split('\n').filter(Boolean) || [];
    const memParts = (memSection[1] || '').split(/\s+/);
    const memTotal = parseInt(memParts[1] || '0');
    const memUsed = parseInt(memParts[2] || '0');
    const memAvailable = parseInt(memParts[6] || '0');
    
    const diskSection = sections.find(s => s.startsWith('DISK'))?.split('\n').filter(Boolean) || [];
    const diskParts = (diskSection[1] || '').split(/\s+/);
    const diskTotal = parseInt(diskParts[1] || '0');
    const diskUsed = parseInt(diskParts[2] || '0');
    const diskAvailable = parseInt(diskParts[3] || '0');
    
    const uptimeSection = sections.find(s => s.startsWith('UPTIME'))?.split('\n').filter(Boolean) || [];
    const uptime = uptimeSection[1] || 'unknown';
    
    return {
      cpu: {
        usage: cpuUsage,
        cores,
        loadAvg: [
          parseFloat(loadAvgParts[0] || '0'),
          parseFloat(loadAvgParts[1] || '0'),
          parseFloat(loadAvgParts[2] || '0'),
        ],
      },
      memory: {
        total: memTotal,
        used: memUsed,
        available: memAvailable,
        usagePercent: memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0,
      },
      disk: {
        total: diskTotal,
        used: diskUsed,
        available: diskAvailable,
        usagePercent: diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0,
      },
      uptime,
    };
  } catch (error) {
    console.error(`Failed to get system metrics for ${host}:`, error);
    return undefined;
  }
}

async function getSystemdServices(host: string, serviceNames: string[]): Promise<ServiceStatus[]> {
  if (serviceNames.length === 0) return [];
  
  try {
    const servicesStr = serviceNames.join(' ');
    const cmd = `systemctl show ${servicesStr} --property=Id,ActiveState,SubState,MainPID,MemoryCurrent,Description 2>/dev/null | paste - - - - - -`;
    
    const output = await sshExec(host, cmd);
    const results: ServiceStatus[] = [];
    
    for (const line of output.split('\n')) {
      if (!line.trim()) continue;
      
      const parts = line.split('\t');
      const props: Record<string, string> = {};
      
      for (const part of parts) {
        const [key, ...rest] = part.split('=');
        if (key && rest.length > 0) props[key] = rest.join('=');
      }
      
      if (props.Id) {
        const status: ServiceStatus['status'] = 
          props.ActiveState === 'active' ? 'running' :
          props.ActiveState === 'failed' ? 'failed' :
          props.ActiveState === 'inactive' ? 'stopped' : 'unknown';
        
        results.push({
          name: props.Id.replace('.service', ''),
          status,
          activeState: props.ActiveState,
          subState: props.SubState,
          pid: props.MainPID ? parseInt(props.MainPID) : undefined,
          memory: props.MemoryCurrent && props.MemoryCurrent !== '[not set]' 
            ? formatBytes(parseInt(props.MemoryCurrent)) 
            : undefined,
          description: props.Description || undefined,
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error(`Failed to get systemd services for ${host}:`, error);
    return serviceNames.map(name => ({
      name: name.replace('.service', ''),
      status: 'unknown' as const,
    }));
  }
}

async function getNginxSites(host: string): Promise<NginxSite[]> {
  try {
    const cmd = `
      sites_dir="/etc/nginx/sites-enabled"
      if [ -d "$sites_dir" ]; then
        for site in "$sites_dir"/*; do
          if [ -f "$site" ]; then
            name=$(basename "$site")
            echo "===SITE==="
            echo "name:$name"
            echo "file:$site"
            # Extract server_name
            grep -E "^\\s*server_name" "$site" 2>/dev/null | head -1 | sed 's/server_name//;s/;//;s/^\\s*//' | tr -d '\\n'
            echo ""
            # Extract listen ports
            echo "listen:$(grep -oE 'listen\\s+[0-9]+' "$site" 2>/dev/null | awk '{print $2}' | sort -u | tr '\\n' ',')"
            # Check SSL
            echo "ssl:$(grep -q 'ssl_certificate' "$site" && echo 'yes' || echo 'no')"
            # Extract proxy_pass
            proxy=$(grep -oE 'proxy_pass\\s+[^;]+' "$site" 2>/dev/null | head -1 | awk '{print $2}')
            echo "proxy:$proxy"
          fi
        done
      fi
    `;
    
    const output = await sshExec(host, cmd);
    const sites: NginxSite[] = [];
    
    const siteBlocks = output.split('===SITE===').filter(Boolean);
    for (const block of siteBlocks) {
      const lines = block.trim().split('\n');
      const props: Record<string, string> = {};
      
      for (const line of lines) {
        const [key, ...rest] = line.split(':');
        if (key && rest.length > 0) {
          props[key.trim()] = rest.join(':').trim();
        }
      }
      
      if (props.name) {
        const listenPorts = props.listen 
          ? props.listen.split(',').filter(Boolean).map(p => parseInt(p))
          : [80];
        
        sites.push({
          name: props.name,
          enabled: true,
          serverNames: props.server_name ? props.server_name.split(/\s+/).filter(Boolean) : [],
          listenPorts,
          proxyPass: props.proxy || undefined,
          sslEnabled: props.ssl === 'yes',
          configFile: props.file || `/etc/nginx/sites-enabled/${props.name}`,
        });
      }
    }
    
    return sites;
  } catch (error) {
    console.error(`Failed to get nginx sites for ${host}:`, error);
    return [];
  }
}

async function getDockerContainers(host: string): Promise<ContainerStatus[]> {
  try {
    const cmd = `docker ps -a --format '{{.Names}}|{{.Status}}|{{.Ports}}|{{.Image}}' 2>/dev/null`;
    const output = await sshExec(host, cmd);
    
    if (!output.trim()) return [];
    
    return output.split('\n').filter(Boolean).map(line => {
      const [name, statusStr, ports, image] = line.split('|');
      
      let status: ContainerStatus['status'] = 'unknown';
      let health: string | undefined;
      let uptime: string | undefined;
      
      if (statusStr) {
        if (statusStr.includes('Up')) {
          status = statusStr.includes('unhealthy') ? 'unhealthy' : 'running';
          const uptimeMatch = statusStr.match(/Up\s+(.+?)(\s+\(|$)/);
          if (uptimeMatch) uptime = uptimeMatch[1];
          const healthMatch = statusStr.match(/\(([^)]+)\)/);
          if (healthMatch) health = healthMatch[1];
        } else if (statusStr.includes('Exited')) {
          status = 'stopped';
        }
      }
      
      return {
        name,
        status,
        health,
        ports: ports || undefined,
        uptime,
        image,
      };
    });
  } catch (error) {
    console.error(`Failed to get docker containers for ${host}:`, error);
    return [];
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export interface VPSConfig {
  hostname: string;
  ip: string;
  systemdServices?: string[];
  checkDocker?: boolean;
  checkNginx?: boolean;
}

export async function monitorVPS(config: VPSConfig): Promise<VPSMonitorResult> {
  const startTime = Date.now();
  const result: VPSMonitorResult = {
    hostname: config.hostname,
    ip: config.ip,
    reachable: false,
    responseTime: 0,
    services: [],
    containers: [],
  };
  
  try {
    await sshExec(config.ip, 'echo ok', 5000);
    result.reachable = true;
    result.responseTime = Date.now() - startTime;
    
    const [metrics, services, containers, nginxSites] = await Promise.all([
      getSystemMetrics(config.ip),
      config.systemdServices ? getSystemdServices(config.ip, config.systemdServices) : Promise.resolve([]),
      config.checkDocker !== false ? getDockerContainers(config.ip) : Promise.resolve([]),
      config.checkNginx ? getNginxSites(config.ip) : Promise.resolve([]),
    ]);
    
    result.systemMetrics = metrics;
    result.services = services;
    result.containers = containers;
    if (nginxSites.length > 0) {
      result.nginxSites = nginxSites;
    }
    
  } catch (error: any) {
    result.responseTime = Date.now() - startTime;
    result.error = error.message || 'SSH connection failed';
  }
  
  return result;
}

export const VPS_CONFIGS: Record<string, VPSConfig> = {
  'git.gmac.io': {
    hostname: 'git.gmac.io',
    ip: '5.78.128.106',
    systemdServices: [
      'gitea.service',
      'gitea-actions-runner.service',
      'gitea-actions-runner-2.service',
      'gitea-actions-runner-3.service',
      'gitea-actions-runner-4.service',
      'gitea-actions-runner-5.service',
      'nginx.service',
      'docker.service',
    ],
    checkDocker: true,
    checkNginx: true,
  },
  'claude.gmac.io': {
    hostname: 'claude.gmac.io',
    ip: '5.78.130.199',
    systemdServices: [
      'nginx.service',
      'docker.service',
      'vault-agent.service',
    ],
    checkDocker: true,
    checkNginx: true,
  },
  'gmac.io': {
    hostname: 'gmac.io',
    ip: '5.78.106.236',
    systemdServices: [
      'k3s.service',
    ],
    checkDocker: false,
    checkNginx: false,
  },
};

export async function monitorAllVPS(): Promise<VPSMonitorResult[]> {
  const configs = Object.values(VPS_CONFIGS);
  return Promise.all(configs.map(config => monitorVPS(config)));
}
