import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { securityScanner } from '@/lib/security/security-scanner';

interface RouteParams {
  params: { id: string };
}

// GET /api/security/scans/[id] - Get specific security scan with detailed results
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scan = securityScanner.getScan(params.id);
    
    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const includeLogs = searchParams.get('logs') === 'true';
    const includeFindings = searchParams.get('findings') === 'true';

    const response: any = {
      success: true,
      scan: {
        ...scan,
        logs: includeLogs ? scan.logs : [],
        findings: includeFindings ? scan.findings : scan.findings.slice(0, 10), // First 10 by default
      },
      lastUpdated: new Date().toISOString(),
    };

    if (includeFindings && scan.findings.length > 10) {
      response.pagination = {
        total: scan.findings.length,
        showing: scan.findings.length,
        hasMore: false,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching security scan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch security scan' },
      { status: 500 }
    );
  }
}

// DELETE /api/security/scans/[id] - Cancel a running scan
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scan = securityScanner.getScan(params.id);
    
    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    if (!['pending', 'running'].includes(scan.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot cancel scan with status: ${scan.status}` },
        { status: 400 }
      );
    }

    const success = await securityScanner.cancelScan(params.id);
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Scan cancelled successfully',
        cancelledBy: session.user.email,
        cancelledAt: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to cancel scan' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error cancelling security scan:', error);
    return NextResponse.json(
      { error: 'Failed to cancel security scan' },
      { status: 500 }
    );
  }
}