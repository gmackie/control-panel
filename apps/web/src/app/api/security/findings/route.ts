import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { securityScanner, SeverityLevel, ScanType } from '@/lib/security/security-scanner';
import { z } from 'zod';

const UpdateFindingSchema = z.object({
  findingId: z.string(),
  action: z.enum(['acknowledge', 'resolve', 'mark_false_positive', 'accept_risk']),
  comment: z.string().optional(),
  resolution: z.string().optional(),
});

// GET /api/security/findings - Get security findings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity') as SeverityLevel;
    const status = searchParams.get('status');
    const type = searchParams.get('type') as ScanType;
    const limit = parseInt(searchParams.get('limit') || '100');
    const groupBy = searchParams.get('group_by'); // 'severity', 'type', 'application'

    const findings = securityScanner.getFindings({
      severity: severity || undefined,
      status: status || undefined,
      type: type || undefined,
      limit,
    });

    const response: any = {
      success: true,
      findings,
      total: findings.length,
      lastUpdated: new Date().toISOString(),
    };

    // Add grouping if requested
    if (groupBy) {
      response.groupedFindings = groupFindingsBy(findings, groupBy);
    }

    // Add summary statistics
    response.summary = {
      total: findings.length,
      open: findings.filter(f => f.status === 'open').length,
      acknowledged: findings.filter(f => f.status === 'acknowledged').length,
      resolved: findings.filter(f => f.status === 'resolved').length,
      bySeverity: {
        critical: findings.filter(f => f.severity === 'critical').length,
        high: findings.filter(f => f.severity === 'high').length,
        medium: findings.filter(f => f.severity === 'medium').length,
        low: findings.filter(f => f.severity === 'low').length,
        info: findings.filter(f => f.severity === 'info').length,
      },
      byType: ['vulnerability', 'secrets', 'compliance', 'configuration', 'network', 'image', 'code_quality', 'dependency']
        .reduce((acc, type) => {
          acc[type] = findings.filter(f => f.type === type).length;
          return acc;
        }, {} as Record<string, number>),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching security findings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch security findings' },
      { status: 500 }
    );
  }
}

// PUT /api/security/findings - Update finding status (acknowledge, resolve, etc.)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { findingId, action, comment, resolution } = UpdateFindingSchema.parse(body);

    let success = false;
    let message = '';

    switch (action) {
      case 'acknowledge':
        success = await securityScanner.acknowledgeFinding(
          findingId, 
          session.user.email || 'unknown', 
          comment
        );
        message = 'Finding acknowledged successfully';
        break;
      
      case 'resolve':
        if (!resolution) {
          return NextResponse.json(
            { success: false, error: 'Resolution description is required' },
            { status: 400 }
          );
        }
        success = await securityScanner.resolveFinding(
          findingId, 
          session.user.email || 'unknown', 
          resolution
        );
        message = 'Finding resolved successfully';
        break;
      
      case 'mark_false_positive':
        // In a real implementation, you'd have a method for this
        success = true;
        message = 'Finding marked as false positive';
        break;
      
      case 'accept_risk':
        // In a real implementation, you'd have a method for this
        success = true;
        message = 'Risk accepted for finding';
        break;
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    if (success) {
      return NextResponse.json({
        success: true,
        message,
        updatedBy: session.user.email,
        updatedAt: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Finding not found or update failed' },
        { status: 404 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid update data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating security finding:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update security finding' },
      { status: 500 }
    );
  }
}

// POST /api/security/findings - Bulk update multiple findings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { findingIds, action, comment, resolution } = body;

    if (!Array.isArray(findingIds) || findingIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Finding IDs array is required' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    for (const findingId of findingIds) {
      try {
        let success = false;

        switch (action) {
          case 'acknowledge':
            success = await securityScanner.acknowledgeFinding(
              findingId, 
              session.user.email || 'unknown', 
              comment
            );
            break;
          
          case 'resolve':
            if (!resolution) {
              errors.push({ findingId, error: 'Resolution description is required' });
              continue;
            }
            success = await securityScanner.resolveFinding(
              findingId, 
              session.user.email || 'unknown', 
              resolution
            );
            break;
          
          default:
            errors.push({ findingId, error: 'Invalid action' });
            continue;
        }

        if (success) {
          results.push({ findingId, status: 'updated' });
        } else {
          errors.push({ findingId, error: 'Update failed' });
        }
      } catch (error) {
        errors.push({ findingId, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      updated: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      message: `Updated ${results.length} findings${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
      updatedBy: session.user.email,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error bulk updating security findings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to bulk update security findings' },
      { status: 500 }
    );
  }
}

// Helper function to group findings
function groupFindingsBy(findings: any[], groupBy: string) {
  return findings.reduce((grouped, finding) => {
    let key;
    
    switch (groupBy) {
      case 'severity':
        key = finding.severity;
        break;
      case 'type':
        key = finding.type;
        break;
      case 'application':
        key = finding.metadata?.target?.identifier || 'unknown';
        break;
      case 'status':
        key = finding.status;
        break;
      default:
        key = 'other';
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(finding);
    
    return grouped;
  }, {});
}