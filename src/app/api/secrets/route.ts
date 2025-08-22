import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

interface Secret {
  id: string;
  name: string;
  type: 'api_key' | 'database' | 'certificate' | 'token' | 'credential' | 'ssh_key';
  environment: 'production' | 'staging' | 'development' | 'all';
  status: 'active' | 'expired' | 'rotating' | 'disabled';
  encrypted: boolean;
  value?: string;
  maskedValue: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  rotationEnabled: boolean;
  rotationInterval?: number;
  lastRotated?: Date;
  usedBy: string[];
  tags: string[];
  metadata: {
    description: string;
    owner: string;
    criticality: 'low' | 'medium' | 'high' | 'critical';
    compliance?: string[];
  };
}

const generateMockSecrets = (): Secret[] => {
  const now = new Date();
  const secrets: Secret[] = [
    {
      id: 'secret-001',
      name: 'GitHub OAuth App Secret',
      type: 'credential',
      environment: 'production',
      status: 'active',
      encrypted: true,
      value: 'ghp_EXAMPLE_TOKEN_PLACEHOLDER_DO_NOT_USE_00',
      maskedValue: 'ghp_123...678',
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
      rotationEnabled: true,
      rotationInterval: 90,
      lastRotated: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      usedBy: ['control-panel', 'gitea-server'],
      tags: ['oauth', 'github', 'production'],
      metadata: {
        description: 'OAuth application secret for GitHub authentication',
        owner: 'platform-team',
        criticality: 'high',
        compliance: ['SOC2', 'PCI']
      }
    },
    {
      id: 'secret-002',
      name: 'Turso Database Token',
      type: 'database',
      environment: 'production',
      status: 'active',
      encrypted: true,
      value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      maskedValue: 'eyJhbGc...cCI6Ik',
      createdAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      rotationEnabled: false,
      usedBy: ['control-panel', 'api-server'],
      tags: ['database', 'sqlite', 'turso'],
      metadata: {
        description: 'Database access token for Turso SQLite database',
        owner: 'platform-team',
        criticality: 'critical',
        compliance: ['GDPR', 'SOC2']
      }
    },
    {
      id: 'secret-003',
      name: 'Stripe API Key',
      type: 'api_key',
      environment: 'production',
      status: 'active',
      encrypted: true,
      value: 'sk_test_EXAMPLE_KEY_PLACEHOLDER_0000000',
      maskedValue: 'sk_live_123...def',
      createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      rotationEnabled: true,
      rotationInterval: 30,
      lastRotated: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      usedBy: ['payment-service', 'billing-service'],
      tags: ['payment', 'stripe', 'api'],
      metadata: {
        description: 'Stripe live API key for payment processing',
        owner: 'billing-team',
        criticality: 'critical',
        compliance: ['PCI-DSS', 'SOC2']
      }
    },
    {
      id: 'secret-004',
      name: 'Harbor Registry Admin Password',
      type: 'credential',
      environment: 'production',
      status: 'active',
      encrypted: true,
      value: 'HarborAdmin2024!@#$',
      maskedValue: '***************',
      createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      rotationEnabled: true,
      rotationInterval: 60,
      lastRotated: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      usedBy: ['harbor-registry', 'ci-pipeline'],
      tags: ['registry', 'harbor', 'admin'],
      metadata: {
        description: 'Administrator password for Harbor container registry',
        owner: 'infrastructure-team',
        criticality: 'high',
        compliance: ['SOC2']
      }
    },
    {
      id: 'secret-005',
      name: 'Kubernetes Service Account Token',
      type: 'token',
      environment: 'production',
      status: 'active',
      encrypted: true,
      value: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1Njc4OTAifQ...',
      maskedValue: 'eyJhbGc...jEyMzQ',
      createdAt: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      rotationEnabled: false,
      usedBy: ['monitoring-agent', 'log-collector'],
      tags: ['kubernetes', 'serviceaccount', 'token'],
      metadata: {
        description: 'Service account token for K3s cluster operations',
        owner: 'platform-team',
        criticality: 'high',
        compliance: ['SOC2']
      }
    },
    {
      id: 'secret-006',
      name: 'SendGrid API Key',
      type: 'api_key',
      environment: 'production',
      status: 'active',
      encrypted: true,
      value: 'SG.1234567890abcdef.1234567890abcdef1234567890abcdef',
      maskedValue: 'SG.123...def',
      createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      rotationEnabled: true,
      rotationInterval: 45,
      lastRotated: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      usedBy: ['notification-service', 'user-service'],
      tags: ['email', 'sendgrid', 'api'],
      metadata: {
        description: 'SendGrid API key for transactional email delivery',
        owner: 'application-team',
        criticality: 'medium',
        compliance: ['GDPR']
      }
    },
    {
      id: 'secret-007',
      name: 'Twilio Account SID',
      type: 'credential',
      environment: 'production',
      status: 'active',
      encrypted: true,
      value: 'AC_EXAMPLE_SID_PLACEHOLDER_00000000',
      maskedValue: 'AC123...def',
      createdAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      rotationEnabled: false,
      usedBy: ['sms-service', 'notification-service'],
      tags: ['sms', 'twilio', 'communication'],
      metadata: {
        description: 'Twilio account SID for SMS and communication services',
        owner: 'application-team',
        criticality: 'medium',
        compliance: ['GDPR']
      }
    },
    {
      id: 'secret-008',
      name: 'SSL Certificate (Wildcard)',
      type: 'certificate',
      environment: 'production',
      status: 'active',
      encrypted: true,
      value: '-----BEGIN CERTIFICATE-----\nMIIFXTCCA0WgAwIBAgIUQ...',
      maskedValue: '-----BEGIN CERTIFICATE-----\nMII...END CERTIFICATE-----',
      createdAt: new Date(now.getTime() - 300 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(now.getTime() + 65 * 24 * 60 * 60 * 1000),
      rotationEnabled: true,
      rotationInterval: 365,
      lastRotated: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      usedBy: ['nginx-proxy', 'api-gateway'],
      tags: ['ssl', 'certificate', 'tls'],
      metadata: {
        description: 'Wildcard SSL certificate for *.gmac.io domain',
        owner: 'infrastructure-team',
        criticality: 'critical',
        compliance: ['SOC2', 'PCI']
      }
    },
    {
      id: 'secret-009',
      name: 'OpenRouter API Key (Staging)',
      type: 'api_key',
      environment: 'staging',
      status: 'expired',
      encrypted: true,
      value: 'or-1234567890abcdef1234567890abcdef',
      maskedValue: 'or-123...def',
      createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      rotationEnabled: false,
      usedBy: ['ai-service-staging'],
      tags: ['ai', 'openrouter', 'staging'],
      metadata: {
        description: 'OpenRouter API key for AI model access in staging environment',
        owner: 'ml-team',
        criticality: 'low',
        compliance: []
      }
    },
    {
      id: 'secret-010',
      name: 'SSH Deploy Key',
      type: 'ssh_key',
      environment: 'all',
      status: 'rotating',
      encrypted: true,
      value: '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZ...',
      maskedValue: '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnN...KEY-----',
      createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      rotationEnabled: true,
      rotationInterval: 30,
      usedBy: ['ci-pipeline', 'deployment-service'],
      tags: ['ssh', 'deploy', 'ci-cd'],
      metadata: {
        description: 'SSH private key for repository deployment access',
        owner: 'platform-team',
        criticality: 'high',
        compliance: ['SOC2']
      }
    }
  ];

  return secrets;
};

export async function GET(request: NextRequest) {
  try {
    const secrets = generateMockSecrets();

    return NextResponse.json({
      success: true,
      secrets,
      summary: {
        total: secrets.length,
        active: secrets.filter(s => s.status === 'active').length,
        expired: secrets.filter(s => s.status === 'expired').length,
        rotating: secrets.filter(s => s.status === 'rotating').length,
        disabled: secrets.filter(s => s.status === 'disabled').length,
        byEnvironment: {
          production: secrets.filter(s => s.environment === 'production').length,
          staging: secrets.filter(s => s.environment === 'staging').length,
          development: secrets.filter(s => s.environment === 'development').length,
          all: secrets.filter(s => s.environment === 'all').length,
        },
        byCriticality: {
          critical: secrets.filter(s => s.metadata.criticality === 'critical').length,
          high: secrets.filter(s => s.metadata.criticality === 'high').length,
          medium: secrets.filter(s => s.metadata.criticality === 'medium').length,
          low: secrets.filter(s => s.metadata.criticality === 'low').length,
        }
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error("Failed to fetch secrets:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch secrets" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, ...data } = await request.json();

    if (action === 'create') {
      const newSecret: Secret = {
        id: randomUUID(),
        name: data.name,
        type: data.type,
        environment: data.environment,
        status: 'active',
        encrypted: true,
        value: data.value,
        maskedValue: `***${data.value?.slice(-3) || '***'}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        rotationEnabled: data.rotationEnabled || false,
        rotationInterval: data.rotationInterval,
        usedBy: [],
        tags: data.tags || [],
        metadata: {
          description: data.description,
          owner: data.owner || 'platform-team',
          criticality: data.criticality || 'medium',
          compliance: data.compliance || []
        }
      };

      return NextResponse.json({
        success: true,
        secret: newSecret,
        message: 'Secret created successfully'
      });
    }

    if (action === 'update') {
      const { secretId, ...updates } = data;
      
      return NextResponse.json({
        success: true,
        secretId,
        updates,
        message: 'Secret updated successfully'
      });
    }

    if (action === 'rotate') {
      const { secretId } = data;
      
      return NextResponse.json({
        success: true,
        secretId,
        rotatedAt: new Date().toISOString(),
        message: 'Secret rotation initiated'
      });
    }

    if (action === 'delete') {
      const { secretId } = data;
      
      return NextResponse.json({
        success: true,
        secretId,
        message: 'Secret deleted successfully'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing secret request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process secret request' },
      { status: 500 }
    );
  }
}