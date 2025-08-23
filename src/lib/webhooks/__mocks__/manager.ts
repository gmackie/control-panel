const handleWebhook = jest.fn().mockResolvedValue({
  success: true,
  processed: true,
  message: 'Webhook processed successfully'
});

const validateWebhookSignature = jest.fn().mockReturnValue(true);

const getWebhookLogs = jest.fn().mockResolvedValue([
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

const retryWebhook = jest.fn().mockResolvedValue({
  success: true,
  retried: true
});

module.exports = {
  handleWebhook,
  validateWebhookSignature,
  getWebhookLogs,
  retryWebhook
};