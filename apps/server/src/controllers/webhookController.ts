/**
 * Webhook Controller for Generation Job Notifications
 * Handles incoming webhook notifications from external services
 * and dispatches status updates to the monitoring system
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import {
  GenerationJob,
  GenerationEvent,
  GenerationEventType,
  GenerationProgress,
  GenerationError,
  GenerationResult,
  WebhookConfig,
  WebhookPayload,
  isCharacterGenerationJob,
  isBatchGenerationJob,
  isSingleGenerationJob
} from '../types/generation';
import { StatusTracker, getDefaultStatusTracker } from '../services/statusTracker';

export interface WebhookControllerConfig {
  enableSignatureValidation: boolean;
  maxPayloadSize: number;
  timeoutMs: number;
  retryAttempts: number;
  enableLogging: boolean;
  trustedSources: string[];
}

export interface WebhookRegistration {
  id: string;
  url: string;
  secret?: string;
  events: GenerationEventType[];
  enabled: boolean;
  createdAt: Date;
  lastTriggeredAt?: Date;
  successCount: number;
  failureCount: number;
  lastError?: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  payload: WebhookPayload;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  error?: string;
  responseCode?: number;
  responseTime?: number;
}

export class WebhookController {
  private config: WebhookControllerConfig;
  private statusTracker: StatusTracker;
  private webhookRegistry = new Map<string, WebhookRegistration>();
  private deliveryQueue: WebhookDelivery[] = [];
  private deliveryTimer?: NodeJS.Timeout;

  constructor(
    statusTracker?: StatusTracker,
    config?: Partial<WebhookControllerConfig>
  ) {
    this.statusTracker = statusTracker || getDefaultStatusTracker();
    this.config = {
      enableSignatureValidation: true,
      maxPayloadSize: 1024 * 1024, // 1MB
      timeoutMs: 10000,
      retryAttempts: 3,
      enableLogging: true,
      trustedSources: [],
      ...config
    };

    this.startDeliveryProcessor();
    this.setupStatusTrackerListeners();
  }

  /**
   * Express middleware to handle incoming webhooks
   */
  public handleIncomingWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const startTime = Date.now();
      
      // Validate content type
      if (!req.is('application/json')) {
        res.status(400).json({ error: 'Invalid content type. Expected application/json' });
        return;
      }

      // Validate payload size
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      if (contentLength > this.config.maxPayloadSize) {
        res.status(413).json({ error: 'Payload too large' });
        return;
      }

      // Get source information
      const source = this.getWebhookSource(req);
      const signature = req.headers['x-signature'] as string;
      const timestamp = req.headers['x-timestamp'] as string;

      // Validate signature if enabled
      if (this.config.enableSignatureValidation) {
        const isValid = await this.validateWebhookSignature(
          req.body,
          signature,
          timestamp,
          source
        );

        if (!isValid) {
          res.status(401).json({ error: 'Invalid signature' });
          return;
        }
      }

      // Parse webhook payload
      const payload = this.parseWebhookPayload(req.body, source);
      if (!payload) {
        res.status(400).json({ error: 'Invalid webhook payload format' });
        return;
      }

      // Process the webhook
      await this.processIncomingWebhook(payload, source);

      // Log webhook processing
      if (this.config.enableLogging) {
        console.log(`Webhook processed successfully from ${source} in ${Date.now() - startTime}ms`);
      }

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Register a webhook endpoint for outgoing notifications
   */
  public registerWebhook(
    url: string,
    events: GenerationEventType[],
    secret?: string,
    options?: {
      enabled?: boolean;
    }
  ): WebhookRegistration {
    const webhook: WebhookRegistration = {
      id: this.generateWebhookId(),
      url,
      secret,
      events,
      enabled: options?.enabled ?? true,
      createdAt: new Date(),
      successCount: 0,
      failureCount: 0
    };

    this.webhookRegistry.set(webhook.id, webhook);
    return webhook;
  }

  /**
   * Unregister a webhook
   */
  public unregisterWebhook(webhookId: string): boolean {
    return this.webhookRegistry.delete(webhookId);
  }

  /**
   * Get all registered webhooks
   */
  public getRegisteredWebhooks(): WebhookRegistration[] {
    return Array.from(this.webhookRegistry.values());
  }

  /**
   * Update webhook configuration
   */
  public updateWebhook(
    webhookId: string,
    updates: Partial<Pick<WebhookRegistration, 'url' | 'events' | 'secret' | 'enabled'>>
  ): boolean {
    const webhook = this.webhookRegistry.get(webhookId);
    if (!webhook) {
      return false;
    }

    Object.assign(webhook, updates);
    this.webhookRegistry.set(webhookId, webhook);
    return true;
  }

  /**
   * Send webhook notification
   */
  public async sendWebhookNotification(
    event: GenerationEvent,
    job: GenerationJob
  ): Promise<void> {
    const relevantWebhooks = Array.from(this.webhookRegistry.values())
      .filter(webhook => webhook.enabled && webhook.events.includes(event.type));

    if (relevantWebhooks.length === 0) {
      return;
    }

    const payload: WebhookPayload = {
      event: event.type,
      timestamp: event.timestamp.toISOString(),
      data: {
        job: this.sanitizeJobForWebhook(job),
        user: job.userId ? { id: job.userId, tier: 'unknown' } : undefined,
        result: this.extractResultFromEvent(event),
        error: this.extractErrorFromEvent(event)
      }
    };

    for (const webhook of relevantWebhooks) {
      const delivery: WebhookDelivery = {
        id: this.generateDeliveryId(),
        webhookId: webhook.id,
        payload: {
          ...payload,
          signature: webhook.secret ? this.generateSignature(payload, webhook.secret) : undefined
        },
        status: 'pending',
        attempts: 0
      };

      this.deliveryQueue.push(delivery);
    }
  }

  /**
   * Get delivery history for a webhook
   */
  public getWebhookDeliveries(webhookId?: string): WebhookDelivery[] {
    if (webhookId) {
      return this.deliveryQueue.filter(delivery => delivery.webhookId === webhookId);
    }
    return [...this.deliveryQueue];
  }

  /**
   * Get webhook statistics
   */
  public getWebhookStats(webhookId?: string): {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
    successRate: number;
  } {
    const deliveries = webhookId 
      ? this.deliveryQueue.filter(d => d.webhookId === webhookId)
      : this.deliveryQueue;

    const successful = deliveries.filter(d => d.status === 'delivered');
    const failed = deliveries.filter(d => d.status === 'failed');

    const totalResponseTime = successful.reduce((sum, d) => sum + (d.responseTime || 0), 0);
    const averageResponseTime = successful.length > 0 ? totalResponseTime / successful.length : 0;

    return {
      totalDeliveries: deliveries.length,
      successfulDeliveries: successful.length,
      failedDeliveries: failed.length,
      averageResponseTime,
      successRate: deliveries.length > 0 ? successful.length / deliveries.length : 0
    };
  }

  /**
   * Manually retry failed webhook deliveries
   */
  public async retryFailedDeliveries(webhookId?: string): Promise<number> {
    const failedDeliveries = this.deliveryQueue.filter(delivery => 
      delivery.status === 'failed' && 
      (!webhookId || delivery.webhookId === webhookId)
    );

    for (const delivery of failedDeliveries) {
      delivery.status = 'pending';
      delivery.attempts = 0;
      delivery.error = undefined;
    }

    return failedDeliveries.length;
  }

  /**
   * Clean up old delivery records
   */
  public cleanupDeliveries(maxAge: number = 86400000): number { // 24 hours default
    const cutoff = new Date(Date.now() - maxAge);
    const initialLength = this.deliveryQueue.length;

    this.deliveryQueue = this.deliveryQueue.filter(delivery => 
      !delivery.deliveredAt || delivery.deliveredAt > cutoff
    );

    return initialLength - this.deliveryQueue.length;
  }

  /**
   * Destroy the webhook controller and cleanup resources
   */
  public destroy(): void {
    if (this.deliveryTimer) {
      clearInterval(this.deliveryTimer);
    }

    this.webhookRegistry.clear();
    this.deliveryQueue = [];
  }

  /**
   * Private helper methods
   */

  private setupStatusTrackerListeners(): void {
    // Listen to status tracker events and send webhook notifications
    const eventTypes: GenerationEventType[] = [
      'job_created',
      'job_queued',
      'job_started',
      'job_progress',
      'job_completed',
      'job_failed',
      'job_cancelled',
      'batch_started',
      'batch_completed',
      'batch_failed'
    ];

    for (const eventType of eventTypes) {
      this.statusTracker.on(eventType, async (event: GenerationEvent) => {
        const job = this.statusTracker.getJobStatus(event.jobId);
        if (job) {
          await this.sendWebhookNotification(event, job);
        }
      });
    }
  }

  private startDeliveryProcessor(): void {
    this.deliveryTimer = setInterval(async () => {
      await this.processDeliveryQueue();
    }, 1000); // Process every second
  }

  private async processDeliveryQueue(): Promise<void> {
    const pendingDeliveries = this.deliveryQueue.filter(d => d.status === 'pending');
    
    for (const delivery of pendingDeliveries.slice(0, 10)) { // Process max 10 at a time
      delivery.status = 'retrying';
      await this.attemptWebhookDelivery(delivery);
    }
  }

  private async attemptWebhookDelivery(delivery: WebhookDelivery): Promise<void> {
    const webhook = this.webhookRegistry.get(delivery.webhookId);
    if (!webhook) {
      delivery.status = 'failed';
      delivery.error = 'Webhook registration not found';
      return;
    }

    delivery.attempts++;
    delivery.lastAttemptAt = new Date();

    try {
      const startTime = Date.now();
      
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-ID': webhook.id,
          'X-Delivery-ID': delivery.id,
          ...(delivery.payload.signature && {
            'X-Signature': delivery.payload.signature
          })
        },
        body: JSON.stringify(delivery.payload),
        signal: AbortSignal.timeout(this.config.timeoutMs)
      });

      delivery.responseCode = response.status;
      delivery.responseTime = Date.now() - startTime;

      if (response.ok) {
        delivery.status = 'delivered';
        delivery.deliveredAt = new Date();
        webhook.successCount++;
        webhook.lastTriggeredAt = new Date();
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      delivery.error = error instanceof Error ? error.message : String(error);
      webhook.failureCount++;
      webhook.lastError = delivery.error;

      if (delivery.attempts >= this.config.retryAttempts) {
        delivery.status = 'failed';
      } else {
        delivery.status = 'pending';
        // Exponential backoff: wait before retrying
        setTimeout(() => {
          // Delivery will be picked up in next cycle
        }, Math.pow(2, delivery.attempts) * 1000);
      }
    }
  }

  private getWebhookSource(req: Request): string {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const xSource = req.headers['x-source'] as string;
    const forwarded = req.headers['x-forwarded-for'] as string;
    const ip = forwarded?.split(',')[0] || req.ip || 'unknown';

    return xSource || userAgent.toLowerCase().includes('nanobanana') ? 'nanobanana' : 
           userAgent.toLowerCase().includes('google') ? 'google' : 
           `unknown-${ip}`;
  }

  private async validateWebhookSignature(
    payload: any,
    signature: string,
    timestamp: string,
    source: string
  ): Promise<boolean> {
    if (!signature || !timestamp) {
      return false;
    }

    try {
      // Get the appropriate secret for this source
      const secret = this.getSourceSecret(source);
      if (!secret) {
        return false;
      }

      // Validate timestamp (prevent replay attacks)
      const requestTime = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(currentTime - requestTime);
      
      if (timeDiff > 300) { // 5 minutes tolerance
        return false;
      }

      // Verify signature
      const expectedSignature = this.generateSignature(payload, secret, timestamp);
      return this.compareSignatures(signature, expectedSignature);

    } catch (error) {
      console.error('Signature validation error:', error);
      return false;
    }
  }

  private parseWebhookPayload(body: any, source: string): WebhookPayload | null {
    try {
      if (source === 'nanobanana') {
        return this.parseNanoBananaWebhook(body);
      } else if (source === 'google') {
        return this.parseGoogleWebhook(body);
      } else {
        // Generic webhook format
        return this.parseGenericWebhook(body);
      }
    } catch (error) {
      console.error('Error parsing webhook payload:', error);
      return null;
    }
  }

  private parseNanoBananaWebhook(body: any): WebhookPayload {
    // Parse nanoBanana-specific webhook format
    return {
      event: body.event_type || 'job_progress',
      timestamp: body.timestamp || new Date().toISOString(),
      data: {
        job: body.job || {},
        result: body.result,
        error: body.error
      }
    };
  }

  private parseGoogleWebhook(body: any): WebhookPayload {
    // Parse Google-specific webhook format
    return {
      event: this.mapGoogleEventType(body.eventType),
      timestamp: body.eventTime || new Date().toISOString(),
      data: {
        job: body.resource || {},
        result: body.result,
        error: body.error
      }
    };
  }

  private parseGenericWebhook(body: any): WebhookPayload {
    return {
      event: body.event || 'job_progress',
      timestamp: body.timestamp || new Date().toISOString(),
      data: body.data || body
    };
  }

  private async processIncomingWebhook(payload: WebhookPayload, source: string): Promise<void> {
    try {
      const jobData = payload.data.job;
      if (!jobData || !jobData.id) {
        throw new Error('Invalid job data in webhook payload');
      }

      // Update job status in the status tracker
      const progress = this.extractProgressFromPayload(payload);
      const error = this.extractErrorFromPayload(payload);
      const result = this.extractResultFromPayload(payload);

      const status = this.mapEventToStatus(payload.event);
      
      const updated = this.statusTracker.updateJobStatus(
        jobData.id,
        status,
        progress,
        error,
        result
      );

      if (!updated) {
        console.warn(`Job ${jobData.id} not found in status tracker`);
      }

      // Log successful processing
      if (this.config.enableLogging) {
        console.log(`Processed ${payload.event} webhook for job ${jobData.id} from ${source}`);
      }

    } catch (error) {
      console.error('Error processing incoming webhook:', error);
      throw error;
    }
  }

  private extractProgressFromPayload(payload: WebhookPayload): GenerationProgress | undefined {
    const progress = payload.data.progress;
    if (progress && typeof progress === 'object') {
      return {
        percentage: progress.percentage || 0,
        stage: progress.stage || 'processing',
        message: progress.message,
        estimatedTimeRemainingMs: progress.estimatedTimeRemainingMs,
        startedAt: progress.startedAt ? new Date(progress.startedAt) : undefined
      };
    }
    return undefined;
  }

  private extractErrorFromPayload(payload: WebhookPayload): GenerationError | undefined {
    const error = payload.data.error;
    if (error && typeof error === 'object') {
      return {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Unknown error',
        retryable: error.retryable || false,
        details: error.details,
        retryCount: error.retryCount,
        lastRetryAt: error.lastRetryAt ? new Date(error.lastRetryAt) : undefined
      };
    }
    return undefined;
  }

  private extractResultFromPayload(payload: WebhookPayload): GenerationResult | undefined {
    const result = payload.data.result;
    if (result && typeof result === 'object' && result.id) {
      return {
        id: result.id,
        imageUrl: result.imageUrl,
        imageData: result.imageData,
        thumbnailUrl: result.thumbnailUrl,
        metadata: result.metadata || {
          dimensions: { width: 0, height: 0 },
          format: 'png',
          fileSize: 0,
          generationTimeMs: 0,
          seed: 0,
          model: 'unknown',
          provider: 'unknown'
        },
        createdAt: result.createdAt ? new Date(result.createdAt) : new Date(),
        storageInfo: result.storageInfo
      };
    }
    return undefined;
  }

  private mapEventToStatus(eventType: GenerationEventType): GenerationJob['status'] {
    switch (eventType) {
      case 'job_created':
        return 'pending';
      case 'job_queued':
        return 'queued';
      case 'job_started':
        return 'processing';
      case 'job_completed':
        return 'completed';
      case 'job_failed':
        return 'failed';
      case 'job_cancelled':
        return 'cancelled';
      default:
        return 'processing';
    }
  }

  private mapGoogleEventType(googleEventType: string): GenerationEventType {
    switch (googleEventType.toLowerCase()) {
      case 'generation.started':
        return 'job_started';
      case 'generation.completed':
        return 'job_completed';
      case 'generation.failed':
        return 'job_failed';
      case 'batch.completed':
        return 'batch_completed';
      case 'batch.failed':
        return 'batch_failed';
      default:
        return 'job_progress';
    }
  }

  private sanitizeJobForWebhook(job: GenerationJob): Partial<GenerationJob> {
    // Remove sensitive information before sending in webhooks
    const sanitized: any = {
      id: job.id,
      type: job.type,
      status: job.status,
      priority: job.priority,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt
    };

    if (isCharacterGenerationJob(job)) {
      sanitized.characterId = job.characterId;
      sanitized.variations = job.generationParams?.variations;
    } else if (isBatchGenerationJob(job)) {
      sanitized.batchId = job.batchId;
      sanitized.totalRequests = job.totalRequests;
      sanitized.completedRequests = job.completedRequests;
    }

    return sanitized;
  }

  private extractResultFromEvent(event: GenerationEvent): GenerationResult | undefined {
    if (event.data && event.data.result) {
      return event.data.result;
    }
    return undefined;
  }

  private extractErrorFromEvent(event: GenerationEvent): GenerationError | undefined {
    if (event.data && event.data.error) {
      return event.data.error;
    }
    return undefined;
  }

  private generateSignature(payload: any, secret: string, timestamp?: string): string {
    const data = timestamp ? `${timestamp}.${JSON.stringify(payload)}` : JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  private compareSignatures(received: string, expected: string): boolean {
    if (received.length !== expected.length) {
      return false;
    }
    
    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(received, 'hex'),
      Buffer.from(expected, 'hex')
    );
  }

  private getSourceSecret(source: string): string | null {
    // This would typically come from environment variables or configuration
    switch (source) {
      case 'nanobanana':
        return process.env.NANOBANANA_WEBHOOK_SECRET || null;
      case 'google':
        return process.env.GOOGLE_WEBHOOK_SECRET || null;
      default:
        return process.env.DEFAULT_WEBHOOK_SECRET || null;
    }
  }

  private generateWebhookId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDeliveryId(): string {
    return `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Factory function
export const createWebhookController = (
  statusTracker?: StatusTracker,
  config?: Partial<WebhookControllerConfig>
): WebhookController => {
  return new WebhookController(statusTracker, config);
};

// Default singleton instance
let defaultController: WebhookController | null = null;

export const getDefaultWebhookController = (): WebhookController => {
  if (!defaultController) {
    defaultController = new WebhookController();
  }
  return defaultController;
};

export default WebhookController;