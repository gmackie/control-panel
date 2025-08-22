#!/usr/bin/env tsx

import { ClusterOrchestrator } from '../src/lib/cluster/orchestrator';
import * as readline from 'readline';
import * as fs from 'fs/promises';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('🚀 GMAC.io Cluster Setup Wizard\n');

  // Get configuration
  const hetznerToken = process.env.HETZNER_API_TOKEN || 
    await question('Enter your Hetzner API token: ');
  
  const sshKeyPath = process.env.SSH_KEY_PATH || 
    await question('Enter SSH key path [/root/.ssh/id_rsa]: ') || 
    '/root/.ssh/id_rsa';
  
  const clusterName = await question('Enter cluster name [gmac-io]: ') || 'gmac-io';
  
  const registryEnabled = (await question('Enable Docker registry? (y/n) [y]: ') || 'y').toLowerCase() === 'y';
  
  let registryConfig;
  if (registryEnabled) {
    const registryType = await question('Registry type (harbor/registry) [registry]: ') || 'registry';
    const registryUrl = await question('Registry URL [registry.gmac.io]: ') || 'registry.gmac.io';
    const registryUsername = await question('Registry username [admin]: ') || 'admin';
    const registryPassword = await question('Registry password [admin]: ') || 'admin';
    
    registryConfig = {
      enabled: true,
      type: registryType as 'harbor' | 'registry',
      url: registryUrl,
      auth: {
        username: registryUsername,
        password: registryPassword,
      },
      storage: {
        type: 'filesystem' as const,
        config: {},
      },
    };
  }

  // Create orchestrator
  const orchestrator = new ClusterOrchestrator({
    hetznerApiToken: hetznerToken,
    sshKeyPath,
    clusterName,
    kubeconfigEncryptionKey: process.env.KUBECONFIG_ENCRYPTION_KEY,
    registry: registryConfig,
  });

  try {
    console.log('\n🔧 Initializing cluster orchestrator...');
    await orchestrator.initialize();
    
    console.log('✅ Orchestrator initialized successfully!\n');

    // Check module health
    console.log('🏥 Checking module health...');
    const health = await orchestrator.healthCheck();
    
    for (const [module, status] of health) {
      console.log(`  ${status.healthy ? '✅' : '❌'} ${module}: ${status.message || 'Healthy'}`);
    }

    // Ask if user wants to create a master node
    const createMaster = (await question('\nCreate a master node? (y/n) [y]: ') || 'y').toLowerCase() === 'y';
    
    if (createMaster) {
      console.log('\n🖥️  Creating master node...');
      
      const serverType = await question('Server type [cx22]: ') || 'cx22';
      const location = await question('Location [fsn1]: ') || 'fsn1';
      
      const result = await orchestrator.onboardNode({
        serverType,
        location,
        role: 'master',
      });
      
      console.log(`\n✅ Master node created successfully!`);
      console.log(`  Node ID: ${result.nodeId}`);
      console.log(`  Node Name: ${result.nodeName}`);
      console.log(`  Node IP: ${result.nodeIP}`);
      
      // Save kubeconfig
      if (result.kubeconfig) {
        const kubeconfigPath = `${process.env.HOME}/.kube/config-${clusterName}`;
        await fs.mkdir(`${process.env.HOME}/.kube`, { recursive: true });
        await fs.writeFile(kubeconfigPath, result.kubeconfig);
        console.log(`  Kubeconfig saved to: ${kubeconfigPath}`);
      }
    }

    // Create .env file with configuration
    const envContent = `
# Cluster Configuration
HETZNER_API_TOKEN=${hetznerToken}
SSH_KEY_PATH=${sshKeyPath}
CLUSTER_NAME=${clusterName}
${registryConfig ? `
# Registry Configuration
REGISTRY_ENABLED=true
REGISTRY_TYPE=${registryConfig.type}
REGISTRY_URL=${registryConfig.url}
REGISTRY_USERNAME=${registryConfig.auth.username}
REGISTRY_PASSWORD=${registryConfig.auth.password}
` : ''}
`;

    await fs.writeFile('.env.cluster', envContent);
    console.log('\n📝 Configuration saved to .env.cluster');

    console.log('\n🎉 Cluster setup complete!');
    console.log('\nNext steps:');
    console.log('  1. Add worker nodes using the control panel');
    console.log('  2. Deploy your applications');
    console.log('  3. Set up monitoring and alerting');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main().catch(console.error);