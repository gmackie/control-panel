import { z } from 'zod';

// Security scan types and schemas
export const ScanType = z.enum([
  'vulnerability', 'secrets', 'compliance', 'configuration', 
  'network', 'image', 'code_quality', 'dependency'
]);
export type ScanType = z.infer<typeof ScanType>;

export const SeverityLevel = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type SeverityLevel = z.infer<typeof SeverityLevel>;

export const ScanStatus = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);
export type ScanStatus = z.infer<typeof ScanStatus>;

export const ComplianceFramework = z.enum([
  'cis', 'nist', 'pci_dss', 'hipaa', 'gdpr', 'sox', 'iso27001', 'owasp'
]);
export type ComplianceFramework = z.infer<typeof ComplianceFramework>;

// Security finding schema
export const SecurityFindingSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  severity: SeverityLevel,
  type: ScanType,
  category: z.string(), // e.g., 'SQL Injection', 'Weak Crypto', 'Exposed Secrets'
  cvss: z.number().min(0).max(10).optional(),
  cve: z.string().optional(),
  cwe: z.string().optional(),
  source: z.object({
    file: z.string().optional(),
    line: z.number().optional(),
    function: z.string().optional(),
    component: z.string().optional(),
    image: z.string().optional(),
    layer: z.string().optional(),
  }).optional(),
  remediation: z.object({
    description: z.string(),
    effort: z.enum(['low', 'medium', 'high']),
    automated: z.boolean().default(false),
    links: z.array(z.string()).default([]),
  }),
  compliance: z.array(z.object({
    framework: ComplianceFramework,
    control: z.string(),
    requirement: z.string(),
  })).default([]),
  firstDetected: z.date(),
  lastSeen: z.date(),
  status: z.enum(['open', 'acknowledged', 'resolved', 'false_positive', 'risk_accepted']).default('open'),
  assignee: z.string().optional(),
  metadata: z.record(z.any()).default({}),
});

export type SecurityFinding = z.infer<typeof SecurityFindingSchema>;

// Security scan schema
export const SecurityScanSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ScanType,
  target: z.object({
    type: z.enum(['application', 'image', 'infrastructure', 'code']),
    identifier: z.string(), // application name, image tag, git repo, etc.
    version: z.string().optional(),
    environment: z.string().optional(),
  }),
  framework: ComplianceFramework.optional(),
  status: ScanStatus,
  startedAt: z.date(),
  completedAt: z.date().optional(),
  duration: z.number().optional(), // in seconds
  triggeredBy: z.string(),
  findings: z.array(SecurityFindingSchema).default([]),
  summary: z.object({
    total: z.number(),
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
    info: z.number(),
  }).default({ total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }),
  configuration: z.object({
    scanDepth: z.enum(['surface', 'standard', 'deep']).default('standard'),
    includeTests: z.boolean().default(false),
    followRedirects: z.boolean().default(true),
    timeout: z.number().default(3600), // 1 hour
    maxFindings: z.number().default(1000),
    excludePatterns: z.array(z.string()).default([]),
  }).default({}),
  logs: z.array(z.string()).default([]),
  metrics: z.object({
    filesScanned: z.number().default(0),
    linesOfCode: z.number().default(0),
    dependencies: z.number().default(0),
    endpoints: z.number().default(0),
  }).default({}),
});

export type SecurityScan = z.infer<typeof SecurityScanSchema>;

// Compliance report schema
export const ComplianceReportSchema = z.object({
  id: z.string(),
  framework: ComplianceFramework,
  version: z.string(),
  scope: z.object({
    applications: z.array(z.string()),
    environments: z.array(z.string()),
    timeframe: z.object({
      start: z.date(),
      end: z.date(),
    }),
  }),
  controls: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    status: z.enum(['compliant', 'non_compliant', 'partially_compliant', 'not_assessed']),
    score: z.number().min(0).max(100),
    findings: z.array(z.string()), // finding IDs
    evidence: z.array(z.string()).default([]),
    exceptions: z.array(z.string()).default([]),
  })),
  overallScore: z.number().min(0).max(100),
  generatedAt: z.date(),
  generatedBy: z.string(),
});

export type ComplianceReport = z.infer<typeof ComplianceReportSchema>;

export class SecurityScanner {
  private scans = new Map<string, SecurityScan>();
  private findings = new Map<string, SecurityFinding>();
  private complianceReports = new Map<string, ComplianceReport>();
  private activeScans = new Set<string>();

  // Scan management
  async startScan(scanConfig: Omit<SecurityScan, 'id' | 'startedAt' | 'findings' | 'summary' | 'logs' | 'metrics'>): Promise<SecurityScan> {
    const scan: SecurityScan = {
      ...scanConfig,
      id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startedAt: new Date(),
      findings: [],
      summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      logs: [],
      metrics: { filesScanned: 0, linesOfCode: 0, dependencies: 0, endpoints: 0 },
    };

    this.scans.set(scan.id, scan);
    this.activeScans.add(scan.id);

    // Start scan execution
    this.executeScan(scan).catch(error => {
      console.error(`Scan ${scan.id} failed:`, error);
      scan.status = 'failed';
      scan.logs.push(`Error: ${error.message}`);
      this.activeScans.delete(scan.id);
    });

    return scan;
  }

  private async executeScan(scan: SecurityScan): Promise<void> {
    try {
      scan.status = 'running';
      scan.logs.push(`Starting ${scan.type} scan for ${scan.target.identifier}`);

      switch (scan.type) {
        case 'vulnerability':
          await this.performVulnerabilityScan(scan);
          break;
        case 'secrets':
          await this.performSecretsScan(scan);
          break;
        case 'compliance':
          await this.performComplianceScan(scan);
          break;
        case 'configuration':
          await this.performConfigurationScan(scan);
          break;
        case 'network':
          await this.performNetworkScan(scan);
          break;
        case 'image':
          await this.performImageScan(scan);
          break;
        case 'code_quality':
          await this.performCodeQualityScan(scan);
          break;
        case 'dependency':
          await this.performDependencyScan(scan);
          break;
      }

      scan.status = 'completed';
      scan.completedAt = new Date();
      scan.duration = Math.floor((scan.completedAt.getTime() - scan.startedAt.getTime()) / 1000);
      
      // Update summary
      this.updateScanSummary(scan);
      
      scan.logs.push(`Scan completed. Found ${scan.summary.total} findings.`);
    } catch (error) {
      scan.status = 'failed';
      scan.logs.push(`Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.activeScans.delete(scan.id);
    }
  }

  private async performVulnerabilityScan(scan: SecurityScan): Promise<void> {
    scan.logs.push('Performing vulnerability scan...');
    
    // Simulate vulnerability scanning
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const mockVulnerabilities = [
      {
        title: 'SQL Injection in User Login',
        description: 'The login endpoint is vulnerable to SQL injection attacks due to insufficient input validation.',
        severity: 'high' as SeverityLevel,
        category: 'SQL Injection',
        cvss: 8.1,
        cve: 'CVE-2024-1234',
        cwe: 'CWE-89',
        source: {
          file: 'src/auth/login.ts',
          line: 45,
          function: 'authenticateUser',
        },
        remediation: {
          description: 'Use parameterized queries or prepared statements to prevent SQL injection.',
          effort: 'medium' as const,
          automated: false,
          links: ['https://owasp.org/www-community/attacks/SQL_Injection'],
        },
        compliance: [
          { framework: 'owasp' as ComplianceFramework, control: 'A03', requirement: 'Injection Prevention' }
        ],
      },
      {
        title: 'Weak Cryptographic Hash',
        description: 'Application uses MD5 for password hashing, which is cryptographically weak.',
        severity: 'medium' as SeverityLevel,
        category: 'Weak Cryptography',
        cwe: 'CWE-327',
        source: {
          file: 'src/utils/crypto.ts',
          line: 12,
          function: 'hashPassword',
        },
        remediation: {
          description: 'Replace MD5 with bcrypt, scrypt, or Argon2 for password hashing.',
          effort: 'low' as const,
          automated: true,
          links: ['https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html'],
        },
        compliance: [
          { framework: 'nist' as ComplianceFramework, control: 'SC-13', requirement: 'Cryptographic Protection' }
        ],
      }
    ];

    for (const vuln of mockVulnerabilities) {
      const finding = this.createFinding(scan, vuln);
      scan.findings.push(finding);
      this.findings.set(finding.id, finding);
    }

    scan.metrics.filesScanned = 156;
    scan.metrics.linesOfCode = 12543;
    scan.logs.push(`Scanned ${scan.metrics.filesScanned} files (${scan.metrics.linesOfCode} lines of code)`);
  }

  private async performSecretsScan(scan: SecurityScan): Promise<void> {
    scan.logs.push('Scanning for exposed secrets...');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockSecrets = [
      {
        title: 'AWS Access Key Exposed',
        description: 'AWS access key found in source code. This could lead to unauthorized cloud resource access.',
        severity: 'critical' as SeverityLevel,
        category: 'Exposed Secrets',
        source: {
          file: 'src/config/aws.ts',
          line: 8,
        },
        remediation: {
          description: 'Remove hardcoded credentials and use environment variables or AWS IAM roles.',
          effort: 'low' as const,
          automated: true,
          links: ['https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html'],
        },
        compliance: [
          { framework: 'cis' as ComplianceFramework, control: '1.12', requirement: 'Secure credential storage' }
        ],
      }
    ];

    for (const secret of mockSecrets) {
      const finding = this.createFinding(scan, secret);
      scan.findings.push(finding);
      this.findings.set(finding.id, finding);
    }

    scan.logs.push('Secrets scan completed');
  }

  private async performComplianceScan(scan: SecurityScan): Promise<void> {
    scan.logs.push(`Performing ${scan.framework} compliance scan...`);
    
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Mock compliance findings
    const mockFindings = [
      {
        title: 'Missing Security Headers',
        description: 'Application does not implement required security headers (CSP, HSTS, X-Frame-Options).',
        severity: 'medium' as SeverityLevel,
        category: 'Security Configuration',
        remediation: {
          description: 'Implement security headers using a middleware or reverse proxy configuration.',
          effort: 'low' as const,
          automated: true,
          links: ['https://owasp.org/www-project-secure-headers/'],
        },
        compliance: [
          { framework: scan.framework || 'owasp' as ComplianceFramework, control: 'A05', requirement: 'Security Misconfiguration' }
        ],
      }
    ];

    for (const finding of mockFindings) {
      const secFinding = this.createFinding(scan, finding);
      scan.findings.push(secFinding);
      this.findings.set(secFinding.id, secFinding);
    }

    scan.logs.push('Compliance scan completed');
  }

  private async performConfigurationScan(scan: SecurityScan): Promise<void> {
    scan.logs.push('Scanning infrastructure configuration...');
    
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    scan.metrics.endpoints = 15;
    scan.logs.push(`Scanned ${scan.metrics.endpoints} endpoints`);
  }

  private async performNetworkScan(scan: SecurityScan): Promise<void> {
    scan.logs.push('Performing network security scan...');
    
    await new Promise(resolve => setTimeout(resolve, 3500));
    
    scan.logs.push('Network scan completed');
  }

  private async performImageScan(scan: SecurityScan): Promise<void> {
    scan.logs.push(`Scanning container image: ${scan.target.identifier}`);
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const mockImageVulns = [
      {
        title: 'High Severity CVE in Base Image',
        description: 'Container base image contains known vulnerabilities.',
        severity: 'high' as SeverityLevel,
        category: 'Container Vulnerability',
        cve: 'CVE-2024-5678',
        source: {
          image: scan.target.identifier,
          layer: 'sha256:abc123def456',
          component: 'libc6',
        },
        remediation: {
          description: 'Update base image to latest patch version.',
          effort: 'low' as const,
          automated: true,
          links: ['https://snyk.io/vuln/SNYK-DEBIAN-LIBC6-1234567'],
        },
        compliance: [],
      }
    ];

    for (const vuln of mockImageVulns) {
      const finding = this.createFinding(scan, vuln);
      scan.findings.push(finding);
      this.findings.set(finding.id, finding);
    }

    scan.logs.push('Image scan completed');
  }

  private async performCodeQualityScan(scan: SecurityScan): Promise<void> {
    scan.logs.push('Analyzing code quality and security patterns...');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    scan.logs.push('Code quality scan completed');
  }

  private async performDependencyScan(scan: SecurityScan): Promise<void> {
    scan.logs.push('Scanning dependencies for known vulnerabilities...');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    scan.metrics.dependencies = 234;
    scan.logs.push(`Scanned ${scan.metrics.dependencies} dependencies`);
  }

  private createFinding(scan: SecurityScan, data: any): SecurityFinding {
    const now = new Date();
    return {
      id: `finding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: data.title,
      description: data.description,
      severity: data.severity,
      type: scan.type,
      category: data.category,
      cvss: data.cvss,
      cve: data.cve,
      cwe: data.cwe,
      source: data.source,
      remediation: data.remediation,
      compliance: data.compliance || [],
      firstDetected: now,
      lastSeen: now,
      status: 'open',
      metadata: {
        scanId: scan.id,
        target: scan.target,
      },
    };
  }

  private updateScanSummary(scan: SecurityScan): void {
    scan.summary = scan.findings.reduce((summary, finding) => {
      summary.total++;
      summary[finding.severity]++;
      return summary;
    }, { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 });
  }

  async cancelScan(scanId: string): Promise<boolean> {
    const scan = this.scans.get(scanId);
    if (!scan || !this.activeScans.has(scanId)) {
      return false;
    }

    scan.status = 'cancelled';
    scan.completedAt = new Date();
    scan.duration = Math.floor((scan.completedAt.getTime() - scan.startedAt.getTime()) / 1000);
    scan.logs.push('Scan cancelled by user');
    
    this.activeScans.delete(scanId);
    return true;
  }

  // Finding management
  async acknowledgeFinding(findingId: string, acknowledgedBy: string, comment?: string): Promise<boolean> {
    const finding = this.findings.get(findingId);
    if (!finding) return false;

    finding.status = 'acknowledged';
    finding.assignee = acknowledgedBy;
    if (comment) {
      finding.metadata.acknowledgmentComment = comment;
    }
    finding.metadata.acknowledgedAt = new Date();
    
    return true;
  }

  async resolveFinding(findingId: string, resolvedBy: string, resolution: string): Promise<boolean> {
    const finding = this.findings.get(findingId);
    if (!finding) return false;

    finding.status = 'resolved';
    finding.metadata.resolvedBy = resolvedBy;
    finding.metadata.resolution = resolution;
    finding.metadata.resolvedAt = new Date();
    
    return true;
  }

  // Compliance reporting
  async generateComplianceReport(
    framework: ComplianceFramework,
    scope: {
      applications: string[];
      environments: string[];
      timeframe: { start: Date; end: Date };
    }
  ): Promise<ComplianceReport> {
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get relevant findings for the scope
    const relevantFindings = Array.from(this.findings.values()).filter(finding => {
      return finding.compliance.some(comp => comp.framework === framework) &&
        finding.firstDetected >= scope.timeframe.start &&
        finding.firstDetected <= scope.timeframe.end;
    });

    // Mock compliance controls for demonstration
    const controls = this.getComplianceControls(framework, relevantFindings);
    
    const overallScore = controls.reduce((sum, control) => sum + control.score, 0) / controls.length;

    const report: ComplianceReport = {
      id: reportId,
      framework,
      version: '1.0',
      scope,
      controls,
      overallScore,
      generatedAt: new Date(),
      generatedBy: 'system',
    };

    this.complianceReports.set(reportId, report);
    return report;
  }

  private getComplianceControls(framework: ComplianceFramework, findings: SecurityFinding[]) {
    // Mock controls based on framework
    const controlMap: Record<ComplianceFramework, any[]> = {
      owasp: [
        { id: 'A01', title: 'Broken Access Control', baseScore: 85 },
        { id: 'A02', title: 'Cryptographic Failures', baseScore: 90 },
        { id: 'A03', title: 'Injection', baseScore: 75 },
        { id: 'A04', title: 'Insecure Design', baseScore: 88 },
        { id: 'A05', title: 'Security Misconfiguration', baseScore: 80 },
      ],
      nist: [
        { id: 'AC-1', title: 'Access Control Policy', baseScore: 92 },
        { id: 'SC-13', title: 'Cryptographic Protection', baseScore: 87 },
        { id: 'SI-10', title: 'Information Input Validation', baseScore: 82 },
      ],
      cis: [
        { id: '1.1', title: 'Inventory and Control of Hardware Assets', baseScore: 95 },
        { id: '1.2', title: 'Inventory and Control of Software Assets', baseScore: 90 },
        { id: '3.1', title: 'Secure Configuration', baseScore: 85 },
      ],
      pci_dss: [],
      hipaa: [],
      gdpr: [],
      sox: [],
      iso27001: [],
    };

    return (controlMap[framework] || []).map(control => {
      const relatedFindings = findings.filter(f => 
        f.compliance.some(c => c.control === control.id)
      );
      
      const criticalFindings = relatedFindings.filter(f => f.severity === 'critical').length;
      const highFindings = relatedFindings.filter(f => f.severity === 'high').length;
      
      // Reduce score based on findings
      let score = control.baseScore;
      score -= criticalFindings * 15;
      score -= highFindings * 10;
      score = Math.max(0, score);

      const status = score >= 90 ? 'compliant' as const : 
                    score >= 70 ? 'partially_compliant' as const : 'non_compliant' as const;

      return {
        id: control.id,
        title: control.title,
        description: `Compliance control for ${control.title}`,
        status,
        score: Math.round(score),
        findings: relatedFindings.map(f => f.id),
        evidence: [],
        exceptions: [],
      };
    });
  }

  // Getters
  getScan(id: string): SecurityScan | null {
    return this.scans.get(id) || null;
  }

  getScans(filters?: {
    type?: ScanType;
    status?: ScanStatus;
    target?: string;
    limit?: number;
  }): SecurityScan[] {
    let scans = Array.from(this.scans.values());

    if (filters) {
      if (filters.type) {
        scans = scans.filter(s => s.type === filters.type);
      }
      if (filters.status) {
        scans = scans.filter(s => s.status === filters.status);
      }
      if (filters.target) {
        scans = scans.filter(s => s.target.identifier.includes(filters.target!));
      }
    }

    scans.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    if (filters?.limit) {
      scans = scans.slice(0, filters.limit);
    }

    return scans;
  }

  getFindings(filters?: {
    severity?: SeverityLevel;
    status?: string;
    type?: ScanType;
    limit?: number;
  }): SecurityFinding[] {
    let findings = Array.from(this.findings.values());

    if (filters) {
      if (filters.severity) {
        findings = findings.filter(f => f.severity === filters.severity);
      }
      if (filters.status) {
        findings = findings.filter(f => f.status === filters.status);
      }
      if (filters.type) {
        findings = findings.filter(f => f.type === filters.type);
      }
    }

    findings.sort((a, b) => {
      const severityOrder = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
      const aSeverity = severityOrder[a.severity];
      const bSeverity = severityOrder[b.severity];
      
      if (aSeverity !== bSeverity) {
        return bSeverity - aSeverity;
      }
      
      return b.firstDetected.getTime() - a.firstDetected.getTime();
    });

    if (filters?.limit) {
      findings = findings.slice(0, filters.limit);
    }

    return findings;
  }

  getComplianceReport(id: string): ComplianceReport | null {
    return this.complianceReports.get(id) || null;
  }

  getSecurityStatistics() {
    const scans = Array.from(this.scans.values());
    const findings = Array.from(this.findings.values());
    
    return {
      scans: {
        total: scans.length,
        active: this.activeScans.size,
        byType: Object.fromEntries(
          ['vulnerability', 'secrets', 'compliance', 'configuration', 'network', 'image', 'code_quality', 'dependency']
            .map(type => [type, scans.filter(s => s.type === type).length])
        ),
        byStatus: Object.fromEntries(
          ['pending', 'running', 'completed', 'failed', 'cancelled']
            .map(status => [status, scans.filter(s => s.status === status).length])
        ),
      },
      findings: {
        total: findings.length,
        open: findings.filter(f => f.status === 'open').length,
        bySeverity: {
          critical: findings.filter(f => f.severity === 'critical').length,
          high: findings.filter(f => f.severity === 'high').length,
          medium: findings.filter(f => f.severity === 'medium').length,
          low: findings.filter(f => f.severity === 'low').length,
          info: findings.filter(f => f.severity === 'info').length,
        },
        byType: Object.fromEntries(
          ['vulnerability', 'secrets', 'compliance', 'configuration', 'network', 'image', 'code_quality', 'dependency']
            .map(type => [type, findings.filter(f => f.type === type).length])
        ),
      },
      compliance: {
        reports: this.complianceReports.size,
        frameworks: Array.from(new Set(Array.from(this.complianceReports.values()).map(r => r.framework))),
      },
    };
  }
}

// Singleton instance
export const securityScanner = new SecurityScanner();