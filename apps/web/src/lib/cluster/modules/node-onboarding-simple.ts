import { BaseClusterModule } from './base';
import { HetznerClient } from '@/lib/hetzner/client';
import { KubeconfigManager } from './kubeconfig-manager';

interface OnboardingConfig {
  hetznerApiToken: string;
  sshKeyPath: string;
  clusterName: string;
  masterEndpoint?: string;
  k3sVersion?: string;
  networkCIDR?: string;
  registryUrl?: string;
  registryAuth?: {
    username: string;
    password: string;
  };
}

interface OnboardingResult {
  nodeId: string;
  nodeName: string;
  nodeIP: string;
  role: 'master' | 'worker';
  cloudInitScript: string;
  setupInstructions: string[];
}

export class SimpleNodeOnboardingModule extends BaseClusterModule {
  name = 'node-onboarding';
  version = '1.0.0';
  description = 'Automatic k3s node provisioning for Hetzner VPS';

  private hetznerClient: HetznerClient;
  private kubeconfigManager: KubeconfigManager;
  private config: OnboardingConfig;

  constructor(config: OnboardingConfig) {
    super();
    this.config = config;
    this.hetznerClient = new HetznerClient(config.hetznerApiToken);
    this.kubeconfigManager = new KubeconfigManager();
  }

  async initialize(): Promise<void> {
    // Test Hetzner API connection
    await this.hetznerClient.listServers();
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      await this.hetznerClient.listServers();
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        message: `Hetzner API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async onboardNode(options: {
    serverType: string;
    location: string;
    role: 'master' | 'worker';
    nodeName?: string;
    labels?: Record<string, string>;
  }): Promise<OnboardingResult> {
    const { serverType, location, role, labels } = options;
    const nodeName = options.nodeName || `${this.config.clusterName}-${role}-${Date.now()}`;

    try {
      // Step 1: Generate cloud-init script
      const cloudInitScript = await this.generateCloudInitScript(role, nodeName);

      // Step 2: Create the server
      console.log(`Creating Hetzner server: ${nodeName}`);
      const server = await this.createServer(
        nodeName, 
        serverType, 
        location, 
        role, 
        labels,
        cloudInitScript
      );

      // Step 3: Get server details
      const serverDetails = await this.hetznerClient.getServer(server.id);
      const serverIP = serverDetails.public_net.ipv4.ip;

      // Step 4: Generate setup instructions
      const setupInstructions = this.generateSetupInstructions(
        role,
        nodeName,
        serverIP
      );

      return {
        nodeId: server.id.toString(),
        nodeName,
        nodeIP: serverIP,
        role,
        cloudInitScript,
        setupInstructions,
      };
    } catch (error) {
      console.error(`Failed to provision node: ${error}`);
      throw error;
    }
  }

  private async createServer(
    name: string,
    serverType: string,
    location: string,
    role: 'master' | 'worker',
    labels: Record<string, string> | undefined,
    userData: string
  ) {
    return await this.hetznerClient.createServer({
      name,
      server_type: serverType,
      image: 'ubuntu-22.04',
      location,
      ssh_keys: await this.getSshKeyIds(),
      user_data: userData,
      labels: {
        ...labels,
        'k3s-cluster': this.config.clusterName,
        'k3s-role': role,
        'managed-by': 'gmac-control-panel',
      },
    });
  }

  private async generateCloudInitScript(
    role: 'master' | 'worker',
    nodeName: string
  ): Promise<string> {
    const k3sVersion = this.config.k3sVersion || 'stable';
    const networkCIDR = this.config.networkCIDR || '10.42.0.0/16';

    if (role === 'master') {
      return `#cloud-config
package_update: true
package_upgrade: true
packages:
  - curl
  - wget
  - git
  - htop
  - iotop
  - net-tools
  - ca-certificates
  - gnupg
  - lsb-release

write_files:
  - path: /root/install-k3s.sh
    permissions: '0755'
    content: |
      #!/bin/bash
      set -e
      
      # Wait for network to be ready
      while ! ping -c 1 google.com &> /dev/null; do
        echo "Waiting for network..."
        sleep 5
      done
      
      # Install k3s master
      curl -sfL https://get.k3s.io | \\
        INSTALL_K3S_VERSION="${k3sVersion}" \\
        K3S_NODE_NAME="${nodeName}" \\
        sh -s - server \\
          --cluster-init \\
          --tls-san $(curl -s http://169.254.169.254/hetzner/v1/metadata/public-ipv4) \\
          --tls-san ${this.config.clusterName}.gmac.io \\
          --node-external-ip $(curl -s http://169.254.169.254/hetzner/v1/metadata/public-ipv4) \\
          --flannel-backend=wireguard-native \\
          --cluster-cidr=${networkCIDR} \\
          --disable traefik \\
          --write-kubeconfig-mode 644
      
      # Save kubeconfig for external access
      cp /etc/rancher/k3s/k3s.yaml /root/kubeconfig.yaml
      sed -i "s/127.0.0.1/$(curl -s http://169.254.169.254/hetzner/v1/metadata/public-ipv4)/g" /root/kubeconfig.yaml
      
      # Save join token
      cp /var/lib/rancher/k3s/server/node-token /root/join-token.txt
      
      echo "K3s master installation complete!"
      echo "Kubeconfig: /root/kubeconfig.yaml"
      echo "Join token: /root/join-token.txt"

runcmd:
  - |
    # Configure system for k3s
    echo "net.bridge.bridge-nf-call-iptables=1" >> /etc/sysctl.conf
    echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
    sysctl -p
    
    # Disable swap
    swapoff -a
    sed -i '/ swap / s/^/#/' /etc/fstab
    
    # Set up k3s prerequisites
    modprobe br_netfilter
    modprobe overlay
    
    # Run installation script
    /root/install-k3s.sh
`;
    } else {
      // Worker node
      return `#cloud-config
package_update: true
package_upgrade: true
packages:
  - curl
  - wget
  - git
  - htop
  - iotop
  - net-tools
  - ca-certificates
  - gnupg
  - lsb-release

write_files:
  - path: /root/install-k3s.sh
    permissions: '0755'
    content: |
      #!/bin/bash
      set -e
      
      echo "Please run the following command to join this node to the cluster:"
      echo ""
      echo "curl -sfL https://get.k3s.io | \\"
      echo "  INSTALL_K3S_VERSION='${k3sVersion}' \\"
      echo "  K3S_URL='https://${this.config.masterEndpoint || 'MASTER_IP'}:6443' \\"
      echo "  K3S_TOKEN='YOUR_JOIN_TOKEN' \\"
      echo "  K3S_NODE_NAME='${nodeName}' \\"
      echo "  sh -s - \\"
      echo "    --node-external-ip $(curl -s http://169.254.169.254/hetzner/v1/metadata/public-ipv4)"

runcmd:
  - |
    # Configure system for k3s
    echo "net.bridge.bridge-nf-call-iptables=1" >> /etc/sysctl.conf
    echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
    sysctl -p
    
    # Disable swap
    swapoff -a
    sed -i '/ swap / s/^/#/' /etc/fstab
    
    # Set up k3s prerequisites
    modprobe br_netfilter
    modprobe overlay
    
    # Show instructions
    /root/install-k3s.sh
`;
    }
  }

  private generateSetupInstructions(
    role: 'master' | 'worker',
    nodeName: string,
    serverIP: string
  ): string[] {
    if (role === 'master') {
      return [
        `SSH into the server: ssh root@${serverIP}`,
        'Wait for cloud-init to complete (2-3 minutes)',
        'Retrieve kubeconfig: scp root@' + serverIP + ':/root/kubeconfig.yaml ./kubeconfig-' + nodeName + '.yaml',
        'Retrieve join token: ssh root@' + serverIP + ' cat /root/join-token.txt',
        'Use the join token to add worker nodes to this cluster',
      ];
    } else {
      return [
        `SSH into the server: ssh root@${serverIP}`,
        'Get the join token from your master node',
        'Run: curl -sfL https://get.k3s.io | K3S_URL=https://MASTER_IP:6443 K3S_TOKEN=YOUR_TOKEN sh -',
        'Verify node joined: kubectl get nodes',
      ];
    }
  }

  private async getSshKeyIds(): Promise<string[]> {
    const sshKeys = await this.hetznerClient.listSSHKeys();
    if (sshKeys.length === 0) {
      throw new Error('No SSH keys found in Hetzner account');
    }
    return sshKeys.map(key => key.id.toString());
  }
}