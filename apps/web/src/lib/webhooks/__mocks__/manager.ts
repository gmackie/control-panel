import { vi } from 'vitest'

export const handleWebhook = vi.fn().mockResolvedValue({
  success: true,
  processed: true,
  message: 'Webhook processed successfully'
});

export const validateWebhookSignature = vi.fn().mockReturnValue(true);

export const getWebhookLogs = vi.fn().mockResolvedValue([
  {
    id: 'log-1',
    webhookId: 'webhook-1',
    timestamp: new Date().toISOString(),
    status: 'success',
    payload: {},
    response: { success: true }
  },
  {
    id: 'log-2',
    webhookId: 'webhook-2',
    timestamp: new Date().toISOString(),
    status: 'failed',
    payload: {},
    error: 'Invalid signature'
  }
]);

export const retryWebhook = vi.fn().mockResolvedValue({
  success: true,
  retried: true
});
