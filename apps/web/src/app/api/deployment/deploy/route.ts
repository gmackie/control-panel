import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      appName, 
      domain, 
      port = 3000, 
      gitRepo,
      deploymentType = 'gitea' // 'gitea', 'direct', 'quick'
    } = body;

    if (!appName) {
      return NextResponse.json(
        { error: 'App name is required' },
        { status: 400 }
      );
    }

    // Path to deployment scripts
    const scriptsPath = path.join(process.cwd(), 'deployment-system');
    
    let command: string;
    let scriptPath: string;

    switch (deploymentType) {
      case 'direct':
        // Direct deployment without git
        scriptPath = path.join(scriptsPath, 'direct-deploy.sh');
        command = `${scriptPath} ${appName} ${domain || `${appName}.gmac.io`} nginx:alpine`;
        break;
      
      case 'quick':
        // Quick deployment for existing repos
        scriptPath = path.join(scriptsPath, 'quick-deploy.sh');
        command = `${scriptPath} ${appName} ${domain || `${appName}.gmac.io`} ${port}`;
        break;
      
      case 'gitea':
      default:
        // Full deployment with git repo
        if (!gitRepo) {
          return NextResponse.json(
            { error: 'Git repository path is required for gitea deployment' },
            { status: 400 }
          );
        }
        scriptPath = path.join(scriptsPath, 'one-click-deploy.sh');
        command = `${scriptPath} ${gitRepo} ${appName} ${domain || `${appName}.gmac.io`} ${port}`;
        break;
    }

    // Check if script exists
    try {
      await fs.access(scriptPath);
    } catch {
      return NextResponse.json(
        { error: `Deployment script not found: ${scriptPath}` },
        { status: 500 }
      );
    }

    // Execute deployment
    const { stdout, stderr } = await execAsync(command, {
      env: {
        ...process.env,
        KUBECONFIG: '/Users/mackieg/.kube/config-hetzner'
      }
    });

    // Parse output for important information
    const output = stdout + stderr;
    const deploymentInfo = {
      appName,
      domain: domain || `${appName}.gmac.io`,
      port,
      url: `https://${domain || `${appName}.gmac.io`}`,
      argocdUrl: `https://cd.gmac.io/applications/${appName}`,
      logs: output,
      status: 'deployed'
    };

    return NextResponse.json(deploymentInfo);

  } catch (error) {
    console.error('Deployment error:', error);
    return NextResponse.json(
      { 
        error: 'Deployment failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        logs: error instanceof Error && 'stdout' in error ? (error as any).stdout : ''
      },
      { status: 500 }
    );
  }
}