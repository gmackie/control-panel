import { NextRequest, NextResponse } from 'next/server'

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
    
    // Verify authorization if token is configured
    if (process.env.PROMETHEUS_BEARER_TOKEN && authHeader !== expectedToken) {
      console.error('Invalid Prometheus webhook authorization')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const payload: AlertmanagerWebhookPayload = await request.json()
    
    console.log(`Processing Prometheus alerts: ${payload.alerts.length} alerts (${payload.status})`)
    
    // Process each alert
    for (const alert of payload.alerts) {
      await processAlert(alert, payload)
    }
    
    // Store webhook event
    await storeWebhookEvent({
      source: 'prometheus',
      event: 'alert',
      status: payload.status,
      alertCount: payload.alerts.length,
      payload,
      timestamp: new Date()
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

async function processAlert(alert: PrometheusAlert, payload: AlertmanagerWebhookPayload) {
  const alertName = alert.labels.alertname
  const severity = alert.labels.severity
  const status = alert.status
  
  console.log(`Alert ${status}: ${alertName} (${severity})`)
  
  // Handle different alert types
  if (status === 'firing') {
    await handleFiringAlert(alert, payload)
  } else {
    await handleResolvedAlert(alert, payload)
  }
  
  // Store alert in database
  await storeAlert({
    fingerprint: alert.fingerprint,
    name: alertName,
    severity,
    status,
    labels: alert.labels,
    annotations: alert.annotations,
    startsAt: new Date(alert.startsAt),
    endsAt: alert.endsAt ? new Date(alert.endsAt) : null,
    generatorURL: alert.generatorURL
  })
}

async function handleFiringAlert(alert: PrometheusAlert, payload: AlertmanagerWebhookPayload) {
  const severity = alert.labels.severity
  const alertName = alert.labels.alertname
  const summary = alert.annotations.summary || alertName
  const description = alert.annotations.description || ''
  
  // Determine notification channels based on severity
  const channels = getNotificationChannels(severity)
  
  // Send notifications
  for (const channel of channels) {
    await sendNotification(channel, {
      title: `🚨 Alert: ${summary}`,
      message: description,
      severity,
      labels: alert.labels,
      url: alert.generatorURL,
      timestamp: new Date(alert.startsAt)
    })
  }
  
  // Create incident if critical
  if (severity === 'critical') {
    await createIncident({
      title: summary,
      description,
      severity: 'critical',
      alertFingerprint: alert.fingerprint,
      labels: alert.labels
    })
  }
  
  // Execute runbook if available
  if (alert.annotations.runbook_url) {
    console.log(`Runbook available: ${alert.annotations.runbook_url}`)
    // TODO: Trigger automated runbook execution if configured
  }
}

async function handleResolvedAlert(alert: PrometheusAlert, payload: AlertmanagerWebhookPayload) {
  const alertName = alert.labels.alertname
  const summary = alert.annotations.summary || alertName
  
  console.log(`Alert resolved: ${alertName}`)
  
  // Send resolution notification
  const channels = getNotificationChannels(alert.labels.severity)
  for (const channel of channels) {
    await sendNotification(channel, {
      title: `✅ Resolved: ${summary}`,
      message: 'Alert has been resolved',
      severity: 'info',
      labels: alert.labels,
      url: alert.generatorURL,
      timestamp: new Date()
    })
  }
  
  // Close related incident if exists
  await closeIncident(alert.fingerprint)
}

function getNotificationChannels(severity: string): string[] {
  switch (severity) {
    case 'critical':
      return ['pagerduty', 'slack', 'email']
    case 'warning':
      return ['slack', 'email']
    case 'info':
      return ['slack']
    default:
      return ['slack']
  }
}

async function sendNotification(channel: string, notification: any) {
  console.log(`Sending ${channel} notification:`, notification.title)
  
  // TODO: Implement actual notification sending
  switch (channel) {
    case 'slack':
      // Send to Slack
      break
    case 'email':
      // Send email
      break
    case 'pagerduty':
      // Trigger PagerDuty
      break
  }
}

async function createIncident(incident: any) {
  console.log('Creating incident:', incident.title)
  // TODO: Create incident in incident management system
}

async function closeIncident(alertFingerprint: string) {
  console.log('Closing incident for alert:', alertFingerprint)
  // TODO: Close incident in incident management system
}

async function storeAlert(alert: any) {
  console.log('Storing alert:', alert.name, alert.status)
  // TODO: Store alert in database
}

async function storeWebhookEvent(event: any) {
  console.log('Storing webhook event:', event.source, event.status)
  // TODO: Store in database for audit and monitoring
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Prometheus Alert Webhook Handler',
    status: 'active',
    features: [
      'Alert processing',
      'Severity-based routing',
      'Incident creation',
      'Resolution tracking',
      'Multi-channel notifications'
    ]
  })
}