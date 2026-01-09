import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAWSClientAsync } from '@/lib/aws/client';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const awsClient = await createAWSClientAsync();
    if (!awsClient) {
      return NextResponse.json(
        { error: 'AWS credentials not configured. Add integration in Settings > Integrations Hub.' },
        { status: 500 }
      );
    }

    const [
      lambdaFunctions,
      s3Buckets,
      sqsQueues,
      snsTopics,
      iotThings,
      cloudWatchAlarms,
      costSummary,
    ] = await Promise.all([
      awsClient.listLambdaFunctions(),
      awsClient.listS3Buckets(),
      awsClient.listSQSQueues(),
      awsClient.listSNSTopics(),
      awsClient.listIoTThings(),
      awsClient.listCloudWatchAlarms(),
      awsClient.getCostSummary(),
    ]);

    const lambdaSummary = lambdaFunctions.map(fn => ({
      name: fn.functionName,
      arn: fn.functionArn,
      runtime: fn.runtime,
      memorySize: fn.memorySize,
      timeout: fn.timeout,
      codeSize: fn.codeSize,
      state: fn.state,
      lastModified: fn.lastModified,
      description: fn.description,
      handler: fn.handler,
    }));

    const s3Summary = s3Buckets.map(bucket => ({
      name: bucket.name,
      region: bucket.region,
      creationDate: bucket.creationDate,
      sizeBytes: bucket.sizeBytes,
      objectCount: bucket.objectCount,
    }));

    const sqsSummary = sqsQueues.map(queue => ({
      name: queue.queueName,
      url: queue.queueUrl,
      messagesAvailable: queue.approximateNumberOfMessages,
      messagesInFlight: queue.approximateNumberOfMessagesNotVisible,
      messagesDelayed: queue.approximateNumberOfMessagesDelayed,
      isFifo: queue.isFifo,
      visibilityTimeout: queue.visibilityTimeout,
      delaySeconds: queue.delaySeconds,
    }));

    const snsSummary = snsTopics.map(topic => ({
      name: topic.topicName,
      arn: topic.topicArn,
      displayName: topic.displayName,
      subscriptionCount: topic.subscriptionCount,
    }));

    const iotSummary = iotThings.map(thing => ({
      name: thing.thingName,
      arn: thing.thingArn,
      typeName: thing.thingTypeName,
      attributes: thing.attributes,
    }));

    const alarmsSummary = cloudWatchAlarms.map(alarm => ({
      name: alarm.alarmName,
      arn: alarm.alarmArn,
      description: alarm.alarmDescription,
      state: alarm.stateValue,
      stateReason: alarm.stateReason,
      metric: alarm.metricName,
      namespace: alarm.namespace,
      threshold: alarm.threshold,
      comparison: alarm.comparisonOperator,
      actionsEnabled: alarm.actionsEnabled,
    }));

    return NextResponse.json({
      lambda: lambdaSummary,
      s3: s3Summary,
      sqs: sqsSummary,
      sns: snsSummary,
      iot: iotSummary,
      alarms: alarmsSummary,
      costs: {
        currentMonth: costSummary.currentMonth,
        lastMonth: costSummary.lastMonth,
        forecast: costSummary.forecast,
        byService: costSummary.byService,
        byApplication: costSummary.byApplication,
        currency: costSummary.currency,
      },
      summary: {
        lambda: {
          total: lambdaFunctions.length,
          active: lambdaFunctions.filter(fn => fn.state === 'Active').length,
          inactive: lambdaFunctions.filter(fn => fn.state !== 'Active').length,
        },
        s3: {
          total: s3Buckets.length,
        },
        sqs: {
          total: sqsQueues.length,
          fifo: sqsQueues.filter(q => q.isFifo).length,
          standard: sqsQueues.filter(q => !q.isFifo).length,
          totalMessages: sqsQueues.reduce((sum, q) => sum + q.approximateNumberOfMessages, 0),
        },
        sns: {
          total: snsTopics.length,
          totalSubscriptions: snsTopics.reduce((sum, t) => sum + t.subscriptionCount, 0),
        },
        iot: {
          total: iotThings.length,
        },
        alarms: {
          total: cloudWatchAlarms.length,
          ok: cloudWatchAlarms.filter(a => a.stateValue === 'OK').length,
          alarm: cloudWatchAlarms.filter(a => a.stateValue === 'ALARM').length,
          insufficientData: cloudWatchAlarms.filter(a => a.stateValue === 'INSUFFICIENT_DATA').length,
        },
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching AWS resources:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
