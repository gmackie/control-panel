import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { securityScanner, ScanType, ComplianceFramework } from '@/lib/security/security-scanner';
import { z } from 'zod';

const CreateScanSchema = z.object({
  name: z.string().min(1),
  type: ScanType,
  target: z.object({
    type: z.enum(['application', 'image', 'infrastructure', 'code']),
    identifier: z.string().min(1),
    version: z.string().optional(),
    environment: z.string().optional(),
  }),
  framework: ComplianceFramework.optional(),
  configuration: z.object({
    scanDepth: z.enum(['surface', 'standard', 'deep']).default('standard'),
    includeTests: z.boolean().default(false),
    followRedirects: z.boolean().default(true),
    timeout: z.number().default(3600),
    maxFindings: z.number().default(1000),
    excludePatterns: z.array(z.string()).default([]),
  }).default({}),
  autoStart: z.boolean().default(true),
});

// GET /api/security/scans - Get security scans
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as ScanType;
    const status = searchParams.get('status');
    const target = searchParams.get('target');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeStats = searchParams.get('stats') === 'true';

    const scans = securityScanner.getScans({
      type: type || undefined,
      status: status as any,
      target: target || undefined,
      limit,
    });

    const response: any = {
      success: true,
      scans,
      total: scans.length,
      lastUpdated: new Date().toISOString(),
    };

    if (includeStats) {
      response.statistics = securityScanner.getSecurityStatistics();
    }

    // Initialize with sample scans if none exist
    if (scans.length === 0) {
      await initializeSampleScans();
      response.scans = securityScanner.getScans({ limit });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching security scans:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch security scans' },
      { status: 500 }
    );
  }
}

// POST /api/security/scans - Create and optionally start a security scan
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const scanData = CreateScanSchema.parse(body);

    const scan = await securityScanner.startScan({
      ...scanData,
      status: scanData.autoStart ? 'pending' : 'pending',
      triggeredBy: session.user.email || 'unknown',
    });

    return NextResponse.json({
      success: true,
      scan,
      message: `Security scan ${scanData.autoStart ? 'created and started' : 'created'} successfully`,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid scan configuration', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating security scan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create security scan' },
      { status: 500 }
    );
  }
}

// Initialize sample security scans
async function initializeSampleScans() {
  try {
    // Vulnerability scan
    await securityScanner.startScan({
      name: 'Control Panel Vulnerability Assessment',
      type: 'vulnerability',
      target: {
        type: 'application',
        identifier: 'control-panel',
        version: 'v1.2.3',
        environment: 'production',
      },
      status: 'completed',
      triggeredBy: 'graeme@gmac.io',
      configuration: {
        scanDepth: 'standard',
        includeTests: false,
        followRedirects: true,
        timeout: 3600,
        maxFindings: 1000,
        excludePatterns: ['*/node_modules/*', '*/test/*'],
      },
    });

    // Container image scan
    await securityScanner.startScan({
      name: 'Control Panel Image Security Scan',
      type: 'image',
      target: {
        type: 'image',
        identifier: 'control-panel:v1.2.3-abc123',
        version: 'v1.2.3',
        environment: 'production',
      },
      status: 'running',
      triggeredBy: 'graeme@gmac.io',
      configuration: {
        scanDepth: 'deep',
        timeout: 1800,
        maxFindings: 500,
        includeTests: false,
        followRedirects: true,
        excludePatterns: [],
      },
    });

    // Secrets scan
    await securityScanner.startScan({
      name: 'Repository Secrets Scan',
      type: 'secrets',
      target: {
        type: 'code',
        identifier: 'control-panel-repo',
        version: 'main',
      },
      status: 'pending',
      triggeredBy: 'system',
      configuration: {
        scanDepth: 'standard',
        excludePatterns: ['*.log', '*.tmp'],
        timeout: 900,
        includeTests: false,
        followRedirects: false,
        maxFindings: 100,
      },
    });

    // Compliance scan
    await securityScanner.startScan({
      name: 'OWASP Top 10 Compliance Check',
      type: 'compliance',
      target: {
        type: 'application',
        identifier: 'control-panel',
        environment: 'production',
      },
      framework: 'owasp',
      status: 'completed',
      triggeredBy: 'graeme@gmac.io',
      configuration: {
        scanDepth: 'standard',
        timeout: 2400,
        includeTests: true,
        followRedirects: true,
        maxFindings: 200,
        excludePatterns: [],
      },
    });

    // Infrastructure configuration scan
    await securityScanner.startScan({
      name: 'Kubernetes Security Posture',
      type: 'configuration',
      target: {
        type: 'infrastructure',
        identifier: 'k8s-cluster-prod',
        environment: 'production',
      },
      framework: 'cis',
      status: 'failed',
      triggeredBy: 'system',
      configuration: {
        scanDepth: 'deep',
        timeout: 1800,
        includeTests: false,
        followRedirects: false,
        maxFindings: 50,
        excludePatterns: ['*.yaml', '*.yml'],
      },
    });
  } catch (error) {
    console.error('Error initializing sample scans:', error);
  }
}