import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deploymentIntegration } from '@/lib/deployment/deployment-integration';

// GET /api/deployments/repositories - Get all repositories from Gitea
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeDeploymentStatus = searchParams.get('deployment_status') === 'true';
    const language = searchParams.get('language');
    const searchTerm = searchParams.get('search');

    let repositories = await deploymentIntegration.fetchRepositories();

    // Apply filters
    if (language) {
      repositories = repositories.filter(repo => 
        repo.language?.toLowerCase() === language.toLowerCase()
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      repositories = repositories.filter(repo =>
        repo.name.toLowerCase().includes(term) ||
        repo.description?.toLowerCase().includes(term)
      );
    }

    // Add deployment status if requested
    if (includeDeploymentStatus) {
      const deployedApps = deploymentIntegration.getApplications();
      repositories = repositories.map(repo => ({
        ...repo,
        deployment_status: getRepositoryDeploymentStatus(repo, deployedApps),
      }));
    }

    // Get repository statistics
    const stats = {
      total: repositories.length,
      byLanguage: repositories.reduce((acc, repo) => {
        const lang = repo.language || 'unknown';
        acc[lang] = (acc[lang] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      deployed: includeDeploymentStatus 
        ? repositories.filter((repo: any) => repo.deployment_status?.is_deployed).length 
        : 0,
      recent: repositories.filter(repo => {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return new Date(repo.updated_at) > weekAgo;
      }).length,
    };

    return NextResponse.json({
      success: true,
      repositories,
      statistics: stats,
      total: repositories.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}

// Helper function to get deployment status for a repository
function getRepositoryDeploymentStatus(repository: any, deployedApps: any[]) {
  const app = deployedApps.find(app => app.repository.id === repository.id);
  
  if (!app) {
    return {
      is_deployed: false,
      environments: [],
      last_deployment: null,
    };
  }

  const deployedEnvironments = app.environments.filter((env: any) => 
    env.status === 'deployed' || env.status === 'deploying'
  );

  const lastDeployment = app.environments
    .filter((env: any) => env.last_deployed)
    .sort((a: any, b: any) => 
      new Date(b.last_deployed).getTime() - new Date(a.last_deployed).getTime()
    )[0];

  return {
    is_deployed: deployedEnvironments.length > 0,
    application_id: app.id,
    environments: deployedEnvironments.map((env: any) => ({
      name: env.name,
      status: env.status,
      url: env.url,
      version: env.version,
    })),
    last_deployment: lastDeployment ? {
      environment: lastDeployment.name,
      deployed_at: lastDeployment.last_deployed,
      version: lastDeployment.version,
    } : null,
    total_environments: app.environments.length,
    deployment_config: app.deployment_config,
  };
}