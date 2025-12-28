/**
 * AWS Client
 * 
 * Comprehensive AWS integration for:
 * - Cost Explorer (billing and cost data)
 * - Lambda (serverless functions)
 * - S3 (object storage)
 * - SQS (message queues)
 * - SNS (notifications)
 * - IoT (device management)
 * - CloudWatch (metrics and monitoring)
 */

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  sessionToken?: string;
}

export interface AWSResourceTag {
  Key: string;
  Value: string;
}

// ===================================
// Cost Explorer Types
// ===================================

export interface CostAndUsageResult {
  TimePeriod: {
    Start: string;
    End: string;
  };
  Total: Record<string, { Amount: string; Unit: string }>;
  Groups: Array<{
    Keys: string[];
    Metrics: Record<string, { Amount: string; Unit: string }>;
  }>;
}

export interface CostByService {
  service: string;
  cost: number;
  currency: string;
  usageQuantity?: number;
  usageUnit?: string;
}

export interface CostByApplication {
  application: string;
  cost: number;
  currency: string;
  services: CostByService[];
}

export interface CostForecast {
  startDate: string;
  endDate: string;
  meanValue: number;
  predictionIntervalLowerBound: number;
  predictionIntervalUpperBound: number;
}

// ===================================
// Lambda Types
// ===================================

export interface LambdaFunction {
  functionName: string;
  functionArn: string;
  runtime: string;
  handler: string;
  codeSize: number;
  description: string;
  timeout: number;
  memorySize: number;
  lastModified: string;
  state: 'Pending' | 'Active' | 'Inactive' | 'Failed';
  role: string;
  environment?: Record<string, string>;
  tags?: Record<string, string>;
}

export interface LambdaInvocationMetrics {
  functionName: string;
  invocations: number;
  errors: number;
  duration: {
    average: number;
    min: number;
    max: number;
  };
  throttles: number;
  concurrentExecutions: number;
  cost: number;
}

// ===================================
// S3 Types
// ===================================

export interface S3Bucket {
  name: string;
  creationDate: string;
  region: string;
  sizeBytes?: number;
  objectCount?: number;
  storageClass?: string;
  tags?: Record<string, string>;
}

export interface S3BucketMetrics {
  bucketName: string;
  sizeBytes: number;
  objectCount: number;
  requestCount: number;
  bytesDownloaded: number;
  bytesUploaded: number;
  cost: number;
}

// ===================================
// SQS Types
// ===================================

export interface SQSQueue {
  queueUrl: string;
  queueName: string;
  queueArn: string;
  approximateNumberOfMessages: number;
  approximateNumberOfMessagesNotVisible: number;
  approximateNumberOfMessagesDelayed: number;
  createdTimestamp: string;
  lastModifiedTimestamp: string;
  visibilityTimeout: number;
  delaySeconds: number;
  isFifo: boolean;
  tags?: Record<string, string>;
}

export interface SQSQueueMetrics {
  queueName: string;
  messagesSent: number;
  messagesReceived: number;
  messagesDeleted: number;
  approximateAgeOfOldestMessage: number;
  cost: number;
}

// ===================================
// SNS Types
// ===================================

export interface SNSTopic {
  topicArn: string;
  topicName: string;
  displayName?: string;
  subscriptionCount: number;
  tags?: Record<string, string>;
}

export interface SNSTopicMetrics {
  topicName: string;
  messagesPublished: number;
  deliverySuccessRate: number;
  cost: number;
}

// ===================================
// IoT Types
// ===================================

export interface IoTThing {
  thingName: string;
  thingArn: string;
  thingTypeName?: string;
  attributes: Record<string, string>;
  version: number;
  billingGroupName?: string;
}

export interface IoTMetrics {
  connectedDevices: number;
  messagesPublished: number;
  ruleActionExecutions: number;
  shadowOperations: number;
  cost: number;
}

// ===================================
// CloudWatch Types
// ===================================

export interface CloudWatchAlarm {
  alarmName: string;
  alarmArn: string;
  alarmDescription?: string;
  stateValue: 'OK' | 'ALARM' | 'INSUFFICIENT_DATA';
  stateReason: string;
  metricName: string;
  namespace: string;
  threshold: number;
  comparisonOperator: string;
  evaluationPeriods: number;
  actionsEnabled: boolean;
}

// ===================================
// AWS Client Implementation
// ===================================

export class AWSClient {
  private credentials: AWSCredentials;
  private baseHeaders: Record<string, string>;

  constructor(credentials: AWSCredentials) {
    this.credentials = credentials;
    this.baseHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * AWS Signature Version 4 signing
   * Note: In production, use @aws-sdk packages for proper signing
   */
  private async signRequest(
    _method: string,
    service: string,
    path: string,
    _body?: string,
    queryParams?: Record<string, string>
  ): Promise<{ url: string; headers: Record<string, string> }> {
    const host = `${service}.${this.credentials.region}.amazonaws.com`;
    const endpoint = `https://${host}${path}`;
    
    // For simplicity, we'll use the AWS SDK approach in production
    // This is a placeholder for the signing logic - method and body will be used for proper signing
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    
    const headers: Record<string, string> = {
      ...this.baseHeaders,
      'Host': host,
      'X-Amz-Date': date,
    };

    if (this.credentials.sessionToken) {
      headers['X-Amz-Security-Token'] = this.credentials.sessionToken;
    }

    let url = endpoint;
    if (queryParams) {
      const params = new URLSearchParams(queryParams);
      url += `?${params.toString()}`;
    }

    return { url, headers };
  }

  // ===================================
  // Cost Explorer Methods
  // ===================================

  /**
   * Get cost and usage data for a time period
   */
  async getCostAndUsage(options: {
    startDate: string;
    endDate: string;
    granularity: 'DAILY' | 'MONTHLY' | 'HOURLY';
    groupBy?: Array<{ Type: 'DIMENSION' | 'TAG'; Key: string }>;
    filter?: Record<string, unknown>;
  }): Promise<CostAndUsageResult[]> {
    try {
      // In production, use @aws-sdk/client-cost-explorer
      const response = await this.makeRequest('ce', 'POST', '/', {
        Action: 'GetCostAndUsage',
        TimePeriod: {
          Start: options.startDate,
          End: options.endDate,
        },
        Granularity: options.granularity,
        Metrics: ['UnblendedCost', 'UsageQuantity'],
        GroupBy: options.groupBy,
        Filter: options.filter,
      });

      return response.ResultsByTime || [];
    } catch (error) {
      console.error('Error fetching AWS cost and usage:', error);
      return [];
    }
  }

  /**
   * Get costs grouped by service
   */
  async getCostsByService(startDate: string, endDate: string): Promise<CostByService[]> {
    const results = await this.getCostAndUsage({
      startDate,
      endDate,
      granularity: 'MONTHLY',
      groupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
    });

    const costs: CostByService[] = [];
    for (const result of results) {
      for (const group of result.Groups || []) {
        const service = group.Keys[0];
        const cost = parseFloat(group.Metrics.UnblendedCost?.Amount || '0');
        const usage = parseFloat(group.Metrics.UsageQuantity?.Amount || '0');
        
        costs.push({
          service,
          cost,
          currency: group.Metrics.UnblendedCost?.Unit || 'USD',
          usageQuantity: usage,
          usageUnit: group.Metrics.UsageQuantity?.Unit,
        });
      }
    }

    return costs.sort((a, b) => b.cost - a.cost);
  }

  /**
   * Get costs grouped by application tag
   */
  async getCostsByApplication(startDate: string, endDate: string, tagKey: string = 'Application'): Promise<CostByApplication[]> {
    const results = await this.getCostAndUsage({
      startDate,
      endDate,
      granularity: 'MONTHLY',
      groupBy: [
        { Type: 'TAG', Key: tagKey },
        { Type: 'DIMENSION', Key: 'SERVICE' },
      ],
    });

    const appCosts = new Map<string, CostByApplication>();
    
    for (const result of results) {
      for (const group of result.Groups || []) {
        const [appTag, service] = group.Keys;
        const appName = appTag.replace(`${tagKey}$`, '') || 'Untagged';
        const cost = parseFloat(group.Metrics.UnblendedCost?.Amount || '0');
        
        if (!appCosts.has(appName)) {
          appCosts.set(appName, {
            application: appName,
            cost: 0,
            currency: group.Metrics.UnblendedCost?.Unit || 'USD',
            services: [],
          });
        }
        
        const app = appCosts.get(appName)!;
        app.cost += cost;
        app.services.push({
          service,
          cost,
          currency: group.Metrics.UnblendedCost?.Unit || 'USD',
        });
      }
    }

    return Array.from(appCosts.values()).sort((a, b) => b.cost - a.cost);
  }

  /**
   * Get cost forecast
   */
  async getCostForecast(startDate: string, endDate: string, granularity: 'DAILY' | 'MONTHLY' = 'MONTHLY'): Promise<CostForecast | null> {
    try {
      const response = await this.makeRequest('ce', 'POST', '/', {
        Action: 'GetCostForecast',
        TimePeriod: {
          Start: startDate,
          End: endDate,
        },
        Metric: 'UNBLENDED_COST',
        Granularity: granularity,
      });

      if (response.Total) {
        return {
          startDate,
          endDate,
          meanValue: parseFloat(response.Total.Amount || '0'),
          predictionIntervalLowerBound: parseFloat(response.ForecastResultsByTime?.[0]?.PredictionIntervalLowerBound || '0'),
          predictionIntervalUpperBound: parseFloat(response.ForecastResultsByTime?.[0]?.PredictionIntervalUpperBound || '0'),
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching cost forecast:', error);
      return null;
    }
  }

  // ===================================
  // Lambda Methods
  // ===================================

  /**
   * List Lambda functions
   */
  async listLambdaFunctions(): Promise<LambdaFunction[]> {
    try {
      const response = await this.makeRequest('lambda', 'GET', '/2015-03-31/functions');
      
      return (response.Functions || []).map((fn: any) => ({
        functionName: fn.FunctionName,
        functionArn: fn.FunctionArn,
        runtime: fn.Runtime,
        handler: fn.Handler,
        codeSize: fn.CodeSize,
        description: fn.Description || '',
        timeout: fn.Timeout,
        memorySize: fn.MemorySize,
        lastModified: fn.LastModified,
        state: fn.State || 'Active',
        role: fn.Role,
        environment: fn.Environment?.Variables,
        tags: fn.Tags,
      }));
    } catch (error) {
      console.error('Error listing Lambda functions:', error);
      return [];
    }
  }

  /**
   * Get Lambda function metrics
   */
  async getLambdaMetrics(functionName: string, startTime: Date, endTime: Date): Promise<LambdaInvocationMetrics | null> {
    try {
      // Get metrics from CloudWatch
      const metrics = await this.getCloudWatchMetrics({
        namespace: 'AWS/Lambda',
        metricNames: ['Invocations', 'Errors', 'Duration', 'Throttles', 'ConcurrentExecutions'],
        dimensions: [{ Name: 'FunctionName', Value: functionName }],
        startTime,
        endTime,
        period: 3600, // 1 hour
      });

      // Calculate cost (Lambda pricing: $0.20 per 1M requests + compute cost)
      const invocations = metrics.Invocations?.sum || 0;
      const durationMs = metrics.Duration?.sum || 0;
      const memoryMB = 128; // Default, should get from function config
      const gbSeconds = (durationMs / 1000) * (memoryMB / 1024);
      const computeCost = gbSeconds * 0.0000166667;
      const requestCost = (invocations / 1000000) * 0.20;

      return {
        functionName,
        invocations,
        errors: metrics.Errors?.sum || 0,
        duration: {
          average: metrics.Duration?.average || 0,
          min: metrics.Duration?.min || 0,
          max: metrics.Duration?.max || 0,
        },
        throttles: metrics.Throttles?.sum || 0,
        concurrentExecutions: metrics.ConcurrentExecutions?.max || 0,
        cost: computeCost + requestCost,
      };
    } catch (error) {
      console.error(`Error getting Lambda metrics for ${functionName}:`, error);
      return null;
    }
  }

  /**
   * Invoke Lambda function
   */
  async invokeLambda(functionName: string, payload: unknown, invocationType: 'RequestResponse' | 'Event' = 'RequestResponse'): Promise<{ statusCode: number; payload: unknown }> {
    try {
      const response = await this.makeRequest(
        'lambda',
        'POST',
        `/2015-03-31/functions/${functionName}/invocations`,
        JSON.stringify(payload),
        { 'X-Amz-Invocation-Type': invocationType }
      );

      return {
        statusCode: response.StatusCode || 200,
        payload: response,
      };
    } catch (error) {
      console.error(`Error invoking Lambda ${functionName}:`, error);
      throw error;
    }
  }

  // ===================================
  // S3 Methods
  // ===================================

  /**
   * List S3 buckets
   */
  async listS3Buckets(): Promise<S3Bucket[]> {
    try {
      const response = await this.makeRequest('s3', 'GET', '/');
      
      const buckets: S3Bucket[] = [];
      for (const bucket of response.Buckets || []) {
        buckets.push({
          name: bucket.Name,
          creationDate: bucket.CreationDate,
          region: this.credentials.region,
        });
      }

      return buckets;
    } catch (error) {
      console.error('Error listing S3 buckets:', error);
      return [];
    }
  }

  /**
   * Get S3 bucket metrics
   */
  async getS3BucketMetrics(bucketName: string, startTime: Date, endTime: Date): Promise<S3BucketMetrics | null> {
    try {
      const metrics = await this.getCloudWatchMetrics({
        namespace: 'AWS/S3',
        metricNames: ['BucketSizeBytes', 'NumberOfObjects', 'AllRequests', 'BytesDownloaded', 'BytesUploaded'],
        dimensions: [
          { Name: 'BucketName', Value: bucketName },
          { Name: 'StorageType', Value: 'StandardStorage' },
        ],
        startTime,
        endTime,
        period: 86400, // 1 day
      });

      const sizeBytes = metrics.BucketSizeBytes?.average || 0;
      // S3 pricing: ~$0.023 per GB/month for standard storage
      const storageCost = (sizeBytes / (1024 * 1024 * 1024)) * 0.023;

      return {
        bucketName,
        sizeBytes,
        objectCount: metrics.NumberOfObjects?.average || 0,
        requestCount: metrics.AllRequests?.sum || 0,
        bytesDownloaded: metrics.BytesDownloaded?.sum || 0,
        bytesUploaded: metrics.BytesUploaded?.sum || 0,
        cost: storageCost,
      };
    } catch (error) {
      console.error(`Error getting S3 metrics for ${bucketName}:`, error);
      return null;
    }
  }

  // ===================================
  // SQS Methods
  // ===================================

  /**
   * List SQS queues
   */
  async listSQSQueues(): Promise<SQSQueue[]> {
    try {
      const response = await this.makeRequest('sqs', 'GET', '/', {
        Action: 'ListQueues',
      });

      const queues: SQSQueue[] = [];
      for (const queueUrl of response.QueueUrls || []) {
        const queueName = queueUrl.split('/').pop() || '';
        
        // Get queue attributes
        const attrs = await this.getSQSQueueAttributes(queueUrl);
        
        queues.push({
          queueUrl,
          queueName,
          queueArn: attrs.QueueArn || '',
          approximateNumberOfMessages: parseInt(attrs.ApproximateNumberOfMessages || '0'),
          approximateNumberOfMessagesNotVisible: parseInt(attrs.ApproximateNumberOfMessagesNotVisible || '0'),
          approximateNumberOfMessagesDelayed: parseInt(attrs.ApproximateNumberOfMessagesDelayed || '0'),
          createdTimestamp: attrs.CreatedTimestamp || '',
          lastModifiedTimestamp: attrs.LastModifiedTimestamp || '',
          visibilityTimeout: parseInt(attrs.VisibilityTimeout || '30'),
          delaySeconds: parseInt(attrs.DelaySeconds || '0'),
          isFifo: queueName.endsWith('.fifo'),
        });
      }

      return queues;
    } catch (error) {
      console.error('Error listing SQS queues:', error);
      return [];
    }
  }

  private async getSQSQueueAttributes(queueUrl: string): Promise<Record<string, string>> {
    try {
      const response = await this.makeRequest('sqs', 'GET', '/', {
        Action: 'GetQueueAttributes',
        QueueUrl: queueUrl,
        'AttributeName.1': 'All',
      });

      return response.Attributes || {};
    } catch {
      return {};
    }
  }

  // ===================================
  // SNS Methods
  // ===================================

  /**
   * List SNS topics
   */
  async listSNSTopics(): Promise<SNSTopic[]> {
    try {
      const response = await this.makeRequest('sns', 'GET', '/', {
        Action: 'ListTopics',
      });

      const topics: SNSTopic[] = [];
      for (const topic of response.Topics || []) {
        const topicArn = topic.TopicArn;
        const topicName = topicArn.split(':').pop() || '';
        
        // Get topic attributes
        const attrs = await this.getSNSTopicAttributes(topicArn);
        
        topics.push({
          topicArn,
          topicName,
          displayName: attrs.DisplayName,
          subscriptionCount: parseInt(attrs.SubscriptionsConfirmed || '0'),
        });
      }

      return topics;
    } catch (error) {
      console.error('Error listing SNS topics:', error);
      return [];
    }
  }

  private async getSNSTopicAttributes(topicArn: string): Promise<Record<string, string>> {
    try {
      const response = await this.makeRequest('sns', 'GET', '/', {
        Action: 'GetTopicAttributes',
        TopicArn: topicArn,
      });

      return response.Attributes || {};
    } catch {
      return {};
    }
  }

  // ===================================
  // IoT Methods
  // ===================================

  /**
   * List IoT things
   */
  async listIoTThings(): Promise<IoTThing[]> {
    try {
      const response = await this.makeRequest('iot', 'GET', '/things');
      
      return (response.things || []).map((thing: any) => ({
        thingName: thing.thingName,
        thingArn: thing.thingArn,
        thingTypeName: thing.thingTypeName,
        attributes: thing.attributes || {},
        version: thing.version,
        billingGroupName: thing.billingGroupName,
      }));
    } catch (error) {
      console.error('Error listing IoT things:', error);
      return [];
    }
  }

  /**
   * Get IoT metrics
   */
  async getIoTMetrics(startTime: Date, endTime: Date): Promise<IoTMetrics> {
    try {
      const metrics = await this.getCloudWatchMetrics({
        namespace: 'AWS/IoT',
        metricNames: ['Connect.Success', 'PublishIn.Success', 'RuleMessageThrottled', 'GetThingShadow.Accepted'],
        dimensions: [],
        startTime,
        endTime,
        period: 3600,
      });

      // Estimate cost based on usage (simplified)
      const messagesPublished = metrics['PublishIn.Success']?.sum || 0;
      const messageCost = (messagesPublished / 1000000) * 1.00; // $1 per million messages

      return {
        connectedDevices: metrics['Connect.Success']?.sum || 0,
        messagesPublished,
        ruleActionExecutions: metrics['RuleMessageThrottled']?.sum || 0,
        shadowOperations: metrics['GetThingShadow.Accepted']?.sum || 0,
        cost: messageCost,
      };
    } catch (error) {
      console.error('Error getting IoT metrics:', error);
      return {
        connectedDevices: 0,
        messagesPublished: 0,
        ruleActionExecutions: 0,
        shadowOperations: 0,
        cost: 0,
      };
    }
  }

  // ===================================
  // CloudWatch Methods
  // ===================================

  /**
   * Get CloudWatch metrics
   */
  async getCloudWatchMetrics(options: {
    namespace: string;
    metricNames: string[];
    dimensions: Array<{ Name: string; Value: string }>;
    startTime: Date;
    endTime: Date;
    period: number;
    statistics?: string[];
  }): Promise<Record<string, { sum?: number; average?: number; min?: number; max?: number }>> {
    try {
      const results: Record<string, { sum?: number; average?: number; min?: number; max?: number }> = {};
      
      for (const metricName of options.metricNames) {
        const response = await this.makeRequest('monitoring', 'GET', '/', {
          Action: 'GetMetricStatistics',
          Namespace: options.namespace,
          MetricName: metricName,
          StartTime: options.startTime.toISOString(),
          EndTime: options.endTime.toISOString(),
          Period: options.period.toString(),
          'Statistics.member.1': 'Sum',
          'Statistics.member.2': 'Average',
          'Statistics.member.3': 'Minimum',
          'Statistics.member.4': 'Maximum',
          ...options.dimensions.reduce((acc, dim, i) => ({
            ...acc,
            [`Dimensions.member.${i + 1}.Name`]: dim.Name,
            [`Dimensions.member.${i + 1}.Value`]: dim.Value,
          }), {}),
        });

        const datapoints = response.Datapoints || [];
        if (datapoints.length > 0) {
          results[metricName] = {
            sum: datapoints.reduce((acc: number, dp: any) => acc + (dp.Sum || 0), 0),
            average: datapoints.reduce((acc: number, dp: any) => acc + (dp.Average || 0), 0) / datapoints.length,
            min: Math.min(...datapoints.map((dp: any) => dp.Minimum || 0)),
            max: Math.max(...datapoints.map((dp: any) => dp.Maximum || 0)),
          };
        }
      }

      return results;
    } catch (error) {
      console.error('Error getting CloudWatch metrics:', error);
      return {};
    }
  }

  /**
   * List CloudWatch alarms
   */
  async listCloudWatchAlarms(): Promise<CloudWatchAlarm[]> {
    try {
      const response = await this.makeRequest('monitoring', 'GET', '/', {
        Action: 'DescribeAlarms',
      });

      return (response.MetricAlarms || []).map((alarm: any) => ({
        alarmName: alarm.AlarmName,
        alarmArn: alarm.AlarmArn,
        alarmDescription: alarm.AlarmDescription,
        stateValue: alarm.StateValue,
        stateReason: alarm.StateReason,
        metricName: alarm.MetricName,
        namespace: alarm.Namespace,
        threshold: alarm.Threshold,
        comparisonOperator: alarm.ComparisonOperator,
        evaluationPeriods: alarm.EvaluationPeriods,
        actionsEnabled: alarm.ActionsEnabled,
      }));
    } catch (error) {
      console.error('Error listing CloudWatch alarms:', error);
      return [];
    }
  }

  // ===================================
  // Helper Methods
  // ===================================

  private async makeRequest(
    service: string,
    method: string,
    path: string,
    body?: unknown,
    additionalHeaders?: Record<string, string>
  ): Promise<any> {
    // In production, use the official AWS SDK for proper request signing
    // This is a simplified implementation for development/testing
    
    const { url, headers } = await this.signRequest(
      method,
      service,
      path,
      body ? JSON.stringify(body) : undefined
    );

    const response = await fetch(url, {
      method,
      headers: {
        ...headers,
        ...additionalHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AWS API error: ${response.status} ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    
    return response.text();
  }

  /**
   * Test AWS credentials
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Try to list S3 buckets as a simple connectivity test
      await this.listS3Buckets();
      return { success: true, message: 'AWS connection successful' };
    } catch (error: any) {
      return { success: false, message: error.message || 'AWS connection failed' };
    }
  }

  /**
   * Get comprehensive AWS cost summary
   */
  async getCostSummary(): Promise<{
    currentMonth: number;
    lastMonth: number;
    forecast: number;
    byService: CostByService[];
    byApplication: CostByApplication[];
    currency: string;
  }> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    const forecastEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const [currentMonthCosts, lastMonthCosts, byService, byApplication, forecast] = await Promise.all([
      this.getCostsByService(currentMonthStart, currentMonthEnd),
      this.getCostsByService(lastMonthStart, lastMonthEnd),
      this.getCostsByService(currentMonthStart, currentMonthEnd),
      this.getCostsByApplication(currentMonthStart, currentMonthEnd),
      this.getCostForecast(now.toISOString().split('T')[0], forecastEnd),
    ]);

    return {
      currentMonth: currentMonthCosts.reduce((sum, c) => sum + c.cost, 0),
      lastMonth: lastMonthCosts.reduce((sum, c) => sum + c.cost, 0),
      forecast: forecast?.meanValue || 0,
      byService,
      byApplication,
      currency: 'USD',
    };
  }
}

// Factory function to create AWS client from environment
export function createAWSClient(credentials?: Partial<AWSCredentials>): AWSClient | null {
  const accessKeyId = credentials?.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = credentials?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
  const region = credentials?.region || process.env.AWS_REGION || 'us-east-1';

  if (!accessKeyId || !secretAccessKey) {
    console.warn('AWS credentials not configured');
    return null;
  }

  return new AWSClient({
    accessKeyId,
    secretAccessKey,
    region,
    sessionToken: credentials?.sessionToken || process.env.AWS_SESSION_TOKEN,
  });
}

export default AWSClient;
