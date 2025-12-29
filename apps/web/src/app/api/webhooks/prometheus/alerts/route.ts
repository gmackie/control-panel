import { NextRequest, NextResponse } from 'next/server'
import {
  storeWebhookEvent,
  storeAlert,
  updateAlertStatus,
  createNotification,
  sendSlackNotification,
} from '@/lib/webhooks/webhook-service'

interface PrometheusAlert {
  status: 'firing' | 'resolved'
  labels: {
    alertname: string
    severity: string
    instance?: string
    job?: string
    namespace?: string
    pod?: string
    service?: string
    [key: string]: string | undefined
  }
  annotations: {
    summary?: string
    description?: string
    runbook_url?: string
    [key: string]: string | undefined
  }
  startsAt: string
  endsAt: string
  generatorURL: string
  fingerprint: string
}

interface AlertmanagerWebhookPayload {
  version: string
  groupKey: string
  truncatedAlerts: number
  status: 'firing' | 'resolved'
  receiver: string
  groupLabels: Record<string, string>
  commonLabels: Record<string, string>
  commonAnnotations: Record<string, string>
  externalURL: string
  alerts: PrometheusAlert[]
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const expectedToken = `Bearer ${process.env.PROMETHEUS_BEARER_TOKEN || ''}`
    
    if (process.env.PROMETHEUS_BEARER_TOKEN && authHeader !== expectedToken) {
      console.error('Invalid Prometheus webhook authorization')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const payload: AlertmanagerWebhookPayload = await request.json()
    
    console.log(`Processing Prometheus alerts: ${payload.alerts.length} alerts (${payload.status})`)
    
    for (const alert of payload.alerts) {
      await processAlert(alert, payload)
    }
    
    await storeWebhookEvent({
      source: 'prometheus',
      eventType: 'alert',
      title: `Prometheus: ${payload.alerts.length} ${payload.status} alerts`,
      description: `Receiver: ${payload.receiver}`,
      severity: mapPrometheusSeverity(payload.commonLabels.severity),
      metadata: {
        status: payload.status,
        alertCount: payload.alerts.length,
        groupKey: payload.groupKey,
        receiver: payload.receiver,
        commonLabels: payload.commonLabels,
      },
    })
    
    return NextResponse.json({
      success: true,
      processed: payload.alerts.length,
      status: payload.status
    })
  } catch (error) {
    console.error('Error processing Prometheus webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function mapPrometheusSeverity(severity?: string): 'info' | 'warning' | 'critical' {
  switch (severity) {
    case 'critical':
      return 'critical'
    case 'warning':
      return 'warning'
    default:
      return 'info'
  }
}

async function processAlert(alert: PrometheusAlert, payload: AlertmanagerWebhookPayload) {
  const alertName = alert.labels.alertname
  const severity = mapPrometheusSeverity(alert.labels.severity)
  const status = alert.status
  
  console.log(`Alert ${status}: ${alertName} (${alert.labels.severity})`)
  
  if (status === 'firing') {
    await handleFiringAlert(alert)
  } else {
    await handleResolvedAlert(alert)
  }
  
  if (status === 'firing') {
    await storeAlert({
      fingerprint: alert.fingerprint,
      name: alertName,
      severity,
      status: 'firing',
      startsAt: new Date(alert.startsAt),
      endsAt: null,
      summary: alert.annotations.summary || alertName,
      description: alert.annotations.description,
      labels: Object.fromEntries(
        Object.entries(alert.labels).filter(([_, v]) => v !== undefined)
      ) as Record<string, string>,
    })
  } else {
    await updateAlertStatus(
      alertName,
      'resolved',
      new Date(alert.endsAt)
    )
  }
}

async function handleFiringAlert(alert: PrometheusAlert) {
  const severity = mapPrometheusSeverity(alert.labels.severity)
  const alertName = alert.labels.alertname
  const summary = alert.annotations.summary || alertName
  const description = alert.annotations.description || ''
  
  await createNotification({
    source: 'prometheus',
    category: 'alert',
    severity,
    title: `🚨 Alert: ${summary}`,
    message: description,
    appName: alert.labels.service || alert.labels.job,
    environment: alert.labels.namespace,
    links: alert.generatorURL 
      ? [{ url: alert.generatorURL, label: 'View in Prometheus' }]
      : undefined,
    groupKey: alert.fingerprint,
  })
  
  if (severity === 'critical' || severity === 'warning') {
    await sendSlackNotification({
      title: `🚨 Alert: ${summary}`,
      message: description,
      severity,
      url: alert.generatorURL,
    })
  }
  
  if (severity === 'critical') {
    console.log('Creating incident for critical alert:', summary)
  }
  
  if (alert.annotations.runbook_url) {
    console.log(`Runbook available: ${alert.annotations.runbook_url}`)
  }
}

async function handleResolvedAlert(alert: PrometheusAlert) {
  const alertName = alert.labels.alertname
  const summary = alert.annotations.summary || alertName
  
  console.log(`Alert resolved: ${alertName}`)
  
  await createNotification({
    source: 'prometheus',
    category: 'alert',
    severity: 'info',
    title: `✅ Resolved: ${summary}`,
    message: 'Alert has been resolved',
    appName: alert.labels.service || alert.labels.job,
    environment: alert.labels.namespace,
    groupKey: alert.fingerprint,
  })
  
  await sendSlackNotification({
    title: `✅ Resolved: ${summary}`,
    message: 'Alert has been resolved',
    severity: 'info',
  })
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Prometheus Alert Webhook Handler',
    status: 'active',
    features: [
      'Alert processing',
      'Severity-based routing',
      'Database persistence',
      'Resolution tracking',
      'Slack notifications'
    ]
  })
}
