/**
 * Metrics Collector Utility for Generation System
 * Collects, aggregates, and reports metrics for API usage, performance, and system health
 * Integrates with all monitoring components for comprehensive analytics
 */

import { EventEmitter } from 'events';
import {
  GenerationJob,
  GenerationEvent,
  GenerationAnalytics,
  QueueMetrics,
  CacheMetrics,
  SystemHealthStatus,
  isCharacterGenerationJob,
  isBatchGenerationJob,
  isSingleGenerationJob,
  isCompletedJob,
  isFailedJob,
  isPendingJob
} from '../types/generation';

export interface MetricsConfig {
  retentionPeriodMs: number;
  aggregationIntervalMs: number;
  enableRealTimeMetrics: boolean;
  maxMetricPoints: number;
  enableCostTracking: boolean;
  enablePerformanceMetrics: boolean;
  enableUserMetrics: boolean;
  exportIntervalMs: number;
  enableAlerts: boolean;
}

export interface MetricPoint {
  timestamp: Date;
  value: number;
  tags?: Record<string, string>;
  metadata?: any;
}

export interface TimeSeries {
  name: string;
  points: MetricPoint[];
  unit: string;
  description: string;
}

export interface ApiUsageMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  rateLimitHits: number;
  circuitBreakerActivations: number;
}

export interface CostMetrics {
  totalCost: number;
  costPerGeneration: number;
  costByProvider: Record<string, number>;
  costByUser: Record<string, number>;
  costByJobType: Record<string, number>;
  monthlyBurn: number;
  costEfficiency: number; // cost per successful generation
}

export interface PerformanceMetrics {
  averageGenerationTime: number;
  medianGenerationTime: number;
  p95GenerationTime: number;
  p99GenerationTime: number;
  throughputPerHour: number;
  concurrentJobs: number;
  queueDepth: number;
  processingRate: number;
  successRate: number;
}

export interface UserMetrics {
  activeUsers: number;
  totalUsers: number;
  generationsPerUser: Record<string, number>;
  usersByTier: Record<string, number>;
  retentionRate: number;
  newUserRate: number;
  churnRate: number;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIO: number;
  activeConnections: number;
  healthScore: number;
  uptime: number;
  errorCount: number;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  duration: number; // Alert must persist for this duration
  enabled: boolean;
  lastTriggered?: Date;
  description: string;
}

export interface Alert {
  id: string;
  rule: AlertRule;
  value: number;
  triggeredAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  message: string;
}

export class MetricsCollector extends EventEmitter {
  private config: MetricsConfig;
  private timeSeries = new Map<string, TimeSeries>();
  private metricBuffer = new Map<string, MetricPoint[]>();
  private aggregationTimer?: NodeJS.Timeout;
  private exportTimer?: NodeJS.Timeout;
  private alertRules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, Alert>();
  private lastAggregation = new Date();

  // Cached metrics for performance
  private cachedApiMetrics?: ApiUsageMetrics;
  private cachedCostMetrics?: CostMetrics;
  private cachedPerformanceMetrics?: PerformanceMetrics;
  private cachedUserMetrics?: UserMetrics;
  private cachedSystemMetrics?: SystemMetrics;
  private cacheTimestamp = new Date(0);
  private cacheValidityMs = 5000; // 5 seconds

  constructor(config?: Partial<MetricsConfig>) {
    super();
    
    this.config = {
      retentionPeriodMs: 86400000 * 7, // 7 days
      aggregationIntervalMs: 60000, // 1 minute
      enableRealTimeMetrics: true,
      maxMetricPoints: 10000,
      enableCostTracking: true,
      enablePerformanceMetrics: true,
      enableUserMetrics: true,
      exportIntervalMs: 300000, // 5 minutes
      enableAlerts: true,
      ...config
    };

    this.startAggregation();
    this.startExport();
    this.setupDefaultAlerts();
  }

  /**
   * Record a metric point
   */
  public recordMetric(
    name: string,
    value: number,
    unit: string = 'count',
    tags?: Record<string, string>,
    metadata?: any
  ): void {
    const point: MetricPoint = {
      timestamp: new Date(),
      value,
      tags,
      metadata
    };

    // Add to buffer for real-time processing
    if (!this.metricBuffer.has(name)) {
      this.metricBuffer.set(name, []);
    }
    this.metricBuffer.get(name)!.push(point);

    // Create or update time series
    if (!this.timeSeries.has(name)) {
      this.timeSeries.set(name, {
        name,
        points: [],
        unit,
        description: metadata?.description || name
      });
    }

    const series = this.timeSeries.get(name)!;
    series.points.push(point);

    // Limit series size
    if (series.points.length > this.config.maxMetricPoints) {
      series.points = series.points.slice(-this.config.maxMetricPoints);
    }

    // Emit real-time event if enabled
    if (this.config.enableRealTimeMetrics) {
      this.emit('metric_recorded', { name, point });
    }

    // Check alerts
    if (this.config.enableAlerts) {
      this.checkAlerts(name, value);
    }
  }

  /**
   * Record generation job metrics
   */
  public recordJobMetrics(job: GenerationJob, event: GenerationEvent): void {
    const baseMetrics = {
      job_type: job.type,
      priority: job.priority,
      status: job.status,
      user_id: job.userId || 'anonymous'
    };

    // Record basic job events
    this.recordMetric('generation.jobs.total', 1, 'count', baseMetrics);
    this.recordMetric(`generation.jobs.${event.type}`, 1, 'count', baseMetrics);

    // Record timing metrics
    if (job.completedAt && job.createdAt) {
      const duration = job.completedAt.getTime() - job.createdAt.getTime();
      this.recordMetric('generation.duration', duration, 'ms', baseMetrics);
      
      if (isCompletedJob(job)) {
        this.recordMetric('generation.success_duration', duration, 'ms', baseMetrics);
      }
    }

    // Record cost metrics if enabled
    if (this.config.enableCostTracking && event.data?.result?.metadata?.cost) {
      this.recordMetric('generation.cost', event.data.result.metadata.cost, 'usd', baseMetrics);
    }

    // Record specific metrics by job type
    if (isCharacterGenerationJob(job)) {
      this.recordCharacterMetrics(job, event);
    } else if (isBatchGenerationJob(job)) {
      this.recordBatchMetrics(job, event);
    } else if (isSingleGenerationJob(job)) {
      this.recordSingleMetrics(job, event);
    }

    // Record error metrics
    if (job.error) {
      this.recordMetric('generation.errors', 1, 'count', {
        ...baseMetrics,
        error_code: job.error.code,
        error_retryable: job.error.retryable.toString()
      });
    }

    // Performance tracking
    if (this.config.enablePerformanceMetrics && event.data?.result?.metadata) {
      const metadata = event.data.result.metadata;
      this.recordMetric('generation.model_time', metadata.generationTimeMs, 'ms', {
        ...baseMetrics,
        model: metadata.model,
        provider: metadata.provider
      });
    }

    // User metrics
    if (this.config.enableUserMetrics && job.userId) {
      this.recordMetric('users.generations', 1, 'count', {
        user_id: job.userId,
        job_type: job.type
      });
    }
  }

  /**
   * Record API usage metrics
   */
  public recordApiMetrics(
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    requestSize?: number,
    responseSize?: number
  ): void {
    const tags = {
      endpoint,
      method,
      status_code: statusCode.toString(),
      status_class: Math.floor(statusCode / 100).toString() + 'xx'
    };

    this.recordMetric('api.requests', 1, 'count', tags);
    this.recordMetric('api.response_time', responseTime, 'ms', tags);

    if (requestSize) {
      this.recordMetric('api.request_size', requestSize, 'bytes', tags);
    }

    if (responseSize) {
      this.recordMetric('api.response_size', responseSize, 'bytes', tags);
    }

    // Success/error tracking
    if (statusCode >= 200 && statusCode < 300) {
      this.recordMetric('api.success', 1, 'count', tags);
    } else {
      this.recordMetric('api.errors', 1, 'count', tags);
    }
  }

  /**
   * Get time series data
   */
  public getTimeSeries(name: string, since?: Date): TimeSeries | null {
    const series = this.timeSeries.get(name);
    if (!series) {
      return null;
    }

    if (since) {
      const filteredPoints = series.points.filter(point => point.timestamp >= since);
      return {
        ...series,
        points: filteredPoints
      };
    }

    return series;
  }

  /**
   * Get all metrics names
   */
  public getMetricNames(): string[] {
    return Array.from(this.timeSeries.keys());
  }

  /**
   * Get aggregated API usage metrics
   */
  public getApiUsageMetrics(refresh = false): ApiUsageMetrics {
    if (!refresh && this.isMetricsCacheValid()) {
      return this.cachedApiMetrics!;
    }

    const apiSeries = this.getMetricsStartingWith('api.');
    const totalRequests = this.sumMetricSeries(apiSeries.get('api.requests'));
    const successRequests = this.sumMetricSeries(apiSeries.get('api.success'));
    const errorRequests = this.sumMetricSeries(apiSeries.get('api.errors'));
    
    const responseTimeSeries = apiSeries.get('api.response_time');
    const responseTimes = responseTimeSeries?.points.map(p => p.value) || [];

    const metrics: ApiUsageMetrics = {
      totalRequests: totalRequests,
      successfulRequests: successRequests,
      failedRequests: errorRequests,
      averageResponseTime: this.calculateAverage(responseTimes),
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(responseTimes, 99),
      requestsPerSecond: this.calculateRate(totalRequests, '1h'),
      errorRate: totalRequests > 0 ? errorRequests / totalRequests : 0,
      rateLimitHits: this.sumMetricSeries(apiSeries.get('api.rate_limit_hits')),
      circuitBreakerActivations: this.sumMetricSeries(apiSeries.get('api.circuit_breaker_activations'))
    };

    this.cachedApiMetrics = metrics;
    return metrics;
  }

  /**
   * Get cost metrics
   */
  public getCostMetrics(refresh = false): CostMetrics {
    if (!refresh && this.isMetricsCacheValid()) {
      return this.cachedCostMetrics!;
    }

    const costSeries = this.getMetricsStartingWith('generation.cost');
    const totalCost = this.sumMetricSeries(costSeries.get('generation.cost'));
    const totalGenerations = this.sumMetricSeries(this.timeSeries.get('generation.jobs.total'));
    
    const costByProvider: Record<string, number> = {};
    const costByUser: Record<string, number> = {};
    const costByJobType: Record<string, number> = {};

    // Aggregate costs by tags
    costSeries.get('generation.cost')?.points.forEach(point => {
      if (point.tags) {
        if (point.tags.provider) {
          costByProvider[point.tags.provider] = (costByProvider[point.tags.provider] || 0) + point.value;
        }
        if (point.tags.user_id) {
          costByUser[point.tags.user_id] = (costByUser[point.tags.user_id] || 0) + point.value;
        }
        if (point.tags.job_type) {
          costByJobType[point.tags.job_type] = (costByJobType[point.tags.job_type] || 0) + point.value;
        }
      }
    });

    const successfulGenerations = this.sumMetricSeries(this.timeSeries.get('generation.jobs.job_completed'));

    const metrics: CostMetrics = {
      totalCost,
      costPerGeneration: totalGenerations > 0 ? totalCost / totalGenerations : 0,
      costByProvider,
      costByUser,
      costByJobType,
      monthlyBurn: this.calculateRate(totalCost, '30d'),
      costEfficiency: successfulGenerations > 0 ? totalCost / successfulGenerations : 0
    };

    this.cachedCostMetrics = metrics;
    return metrics;
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(refresh = false): PerformanceMetrics {
    if (!refresh && this.isMetricsCacheValid()) {
      return this.cachedPerformanceMetrics!;
    }

    const generationTimes = this.timeSeries.get('generation.duration')?.points.map(p => p.value) || [];
    const successTimes = this.timeSeries.get('generation.success_duration')?.points.map(p => p.value) || [];

    const totalJobs = this.sumMetricSeries(this.timeSeries.get('generation.jobs.total'));
    const completedJobs = this.sumMetricSeries(this.timeSeries.get('generation.jobs.job_completed'));

    const metrics: PerformanceMetrics = {
      averageGenerationTime: this.calculateAverage(generationTimes),
      medianGenerationTime: this.calculatePercentile(generationTimes, 50),
      p95GenerationTime: this.calculatePercentile(generationTimes, 95),
      p99GenerationTime: this.calculatePercentile(generationTimes, 99),
      throughputPerHour: this.calculateRate(completedJobs, '1h'),
      concurrentJobs: this.getLatestMetricValue('system.concurrent_jobs') || 0,
      queueDepth: this.getLatestMetricValue('queue.depth') || 0,
      processingRate: this.calculateRate(completedJobs, '1m'),
      successRate: totalJobs > 0 ? completedJobs / totalJobs : 0
    };

    this.cachedPerformanceMetrics = metrics;
    return metrics;
  }

  /**
   * Generate comprehensive analytics report
   */
  public generateAnalyticsReport(timeRange: { start: Date; end: Date }): GenerationAnalytics {
    const jobSeries = this.getMetricsInTimeRange('generation.jobs.', timeRange);
    const costSeries = this.getMetricsInTimeRange('generation.cost', timeRange);
    
    const totalJobs = this.sumTimeRangeMetrics(jobSeries, 'total');
    const successful = this.sumTimeRangeMetrics(jobSeries, 'job_completed');
    const failed = this.sumTimeRangeMetrics(jobSeries, 'job_failed');
    const cancelled = this.sumTimeRangeMetrics(jobSeries, 'job_cancelled');

    const generationTimes = this.getTimeRangeValues('generation.duration', timeRange);
    const costs = this.getTimeRangeValues('generation.cost', timeRange);

    return {
      timeRange,
      totals: {
        jobs: totalJobs,
        successful,
        failed,
        cancelled
      },
      performance: {
        averageGenerationTime: this.calculateAverage(generationTimes),
        p95GenerationTime: this.calculatePercentile(generationTimes, 95),
        p99GenerationTime: this.calculatePercentile(generationTimes, 99),
        throughputPerHour: this.calculateRateForTimeRange(successful, timeRange)
      },
      costs: {
        totalCost: costs.reduce((sum, cost) => sum + cost, 0),
        costPerGeneration: successful > 0 ? costs.reduce((sum, cost) => sum + cost, 0) / successful : 0,
        costByProvider: this.aggregateCostsByTag('provider', timeRange),
      },
      errors: {
        byCode: this.aggregateErrorsByCode(timeRange),
        byProvider: this.aggregateErrorsByTag('provider', timeRange),
        retryRate: this.calculateRetryRate(timeRange)
      },
      usage: {
        byUser: this.aggregateUsageByUser(timeRange),
        byTier: this.aggregateUsageByTier(timeRange),
        popularStyles: this.aggregatePopularStyles(timeRange),
        popularAspectRatios: this.aggregatePopularAspectRatios(timeRange)
      }
    };
  }

  /**
   * Set up alert rule
   */
  public addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = this.generateAlertId();
    const alertRule: AlertRule = { ...rule, id };
    this.alertRules.set(id, alertRule);
    return id;
  }

  /**
   * Remove alert rule
   */
  public removeAlertRule(ruleId: string): boolean {
    return this.alertRules.delete(ruleId);
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alert_resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Clean up old metrics data
   */
  public cleanup(): number {
    const cutoff = new Date(Date.now() - this.config.retentionPeriodMs);
    let cleanedPoints = 0;

    for (const series of this.timeSeries.values()) {
      const originalLength = series.points.length;
      series.points = series.points.filter(point => point.timestamp >= cutoff);
      cleanedPoints += originalLength - series.points.length;
    }

    // Clean up resolved alerts older than 24 hours
    const alertCutoff = new Date(Date.now() - 86400000);
    for (const [id, alert] of this.activeAlerts.entries()) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < alertCutoff) {
        this.activeAlerts.delete(id);
      }
    }

    return cleanedPoints;
  }

  /**
   * Export metrics to external systems
   */
  public exportMetrics(): { [system: string]: any } {
    const exports: { [system: string]: any } = {};

    // Export to prometheus format
    exports.prometheus = this.exportToPrometheus();
    
    // Export to JSON format
    exports.json = this.exportToJson();
    
    // Export aggregated metrics
    exports.aggregated = {
      api: this.getApiUsageMetrics(true),
      cost: this.getCostMetrics(true),
      performance: this.getPerformanceMetrics(true),
      timestamp: new Date()
    };

    this.emit('metrics_exported', exports);
    return exports;
  }

  /**
   * Destroy the metrics collector and cleanup resources
   */
  public destroy(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
    
    if (this.exportTimer) {
      clearInterval(this.exportTimer);
    }

    this.timeSeries.clear();
    this.metricBuffer.clear();
    this.alertRules.clear();
    this.activeAlerts.clear();
    this.removeAllListeners();
  }

  /**
   * Private helper methods
   */

  private recordCharacterMetrics(job: GenerationJob, event: GenerationEvent): void {
    if (!isCharacterGenerationJob(job)) return;

    const variations = job.generationParams?.variations || 1;
    this.recordMetric('character.variations_requested', variations, 'count', {
      character_id: job.characterId
    });

    if (job.results) {
      this.recordMetric('character.variations_generated', job.results.length, 'count', {
        character_id: job.characterId
      });
    }
  }

  private recordBatchMetrics(job: GenerationJob, event: GenerationEvent): void {
    if (!isBatchGenerationJob(job)) return;

    this.recordMetric('batch.total_requests', job.totalRequests, 'count', {
      batch_id: job.batchId
    });
    
    this.recordMetric('batch.completed_requests', job.completedRequests, 'count', {
      batch_id: job.batchId
    });
    
    this.recordMetric('batch.failed_requests', job.failedRequests, 'count', {
      batch_id: job.batchId
    });
  }

  private recordSingleMetrics(job: GenerationJob, event: GenerationEvent): void {
    if (!isSingleGenerationJob(job)) return;

    if (job.generationParams) {
      this.recordMetric('single.quality_requests', 1, 'count', {
        quality: job.generationParams.quality || 'medium'
      });
      
      if (job.generationParams.aspectRatio) {
        this.recordMetric('single.aspect_ratio_requests', 1, 'count', {
          aspect_ratio: job.generationParams.aspectRatio
        });
      }
    }
  }

  private startAggregation(): void {
    this.aggregationTimer = setInterval(() => {
      this.performAggregation();
    }, this.config.aggregationIntervalMs);
  }

  private startExport(): void {
    this.exportTimer = setInterval(() => {
      this.exportMetrics();
    }, this.config.exportIntervalMs);
  }

  private performAggregation(): void {
    const now = new Date();
    
    // Aggregate buffered metrics
    for (const [name, points] of this.metricBuffer.entries()) {
      if (points.length === 0) continue;

      const sum = points.reduce((total, point) => total + point.value, 0);
      const avg = sum / points.length;
      const max = Math.max(...points.map(p => p.value));
      const min = Math.min(...points.map(p => p.value));

      // Record aggregated metrics
      this.recordMetric(`${name}.sum`, sum, 'count', { period: 'aggregated' });
      this.recordMetric(`${name}.avg`, avg, 'count', { period: 'aggregated' });
      this.recordMetric(`${name}.max`, max, 'count', { period: 'aggregated' });
      this.recordMetric(`${name}.min`, min, 'count', { period: 'aggregated' });

      // Clear buffer
      this.metricBuffer.set(name, []);
    }

    this.lastAggregation = now;
    this.emit('aggregation_completed', { timestamp: now });
  }

  private setupDefaultAlerts(): void {
    if (!this.config.enableAlerts) return;

    // High error rate alert
    this.addAlertRule({
      name: 'High Error Rate',
      metric: 'api.errors',
      condition: 'greater_than',
      threshold: 10,
      duration: 300000, // 5 minutes
      enabled: true,
      description: 'API error rate is too high'
    });

    // High response time alert
    this.addAlertRule({
      name: 'High Response Time',
      metric: 'api.response_time',
      condition: 'greater_than',
      threshold: 5000, // 5 seconds
      duration: 180000, // 3 minutes
      enabled: true,
      description: 'API response time is too high'
    });

    // Queue depth alert
    this.addAlertRule({
      name: 'High Queue Depth',
      metric: 'queue.depth',
      condition: 'greater_than',
      threshold: 100,
      duration: 600000, // 10 minutes
      enabled: true,
      description: 'Queue depth is too high'
    });
  }

  private checkAlerts(metricName: string, value: number): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled || rule.metric !== metricName) continue;

      const shouldAlert = this.evaluateAlertCondition(rule, value);
      
      if (shouldAlert) {
        this.triggerAlert(rule, value);
      }
    }
  }

  private evaluateAlertCondition(rule: AlertRule, value: number): boolean {
    switch (rule.condition) {
      case 'greater_than':
        return value > rule.threshold;
      case 'less_than':
        return value < rule.threshold;
      case 'equals':
        return value === rule.threshold;
      case 'not_equals':
        return value !== rule.threshold;
      default:
        return false;
    }
  }

  private triggerAlert(rule: AlertRule, value: number): void {
    const alertId = this.generateAlertId();
    const alert: Alert = {
      id: alertId,
      rule,
      value,
      triggeredAt: new Date(),
      resolved: false,
      message: `${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.threshold})`
    };

    this.activeAlerts.set(alertId, alert);
    rule.lastTriggered = new Date();
    
    this.emit('alert_triggered', alert);
  }

  private isMetricsCacheValid(): boolean {
    return this.cachedApiMetrics !== undefined && 
           Date.now() - this.cacheTimestamp.getTime() < this.cacheValidityMs;
  }

  private getMetricsStartingWith(prefix: string): Map<string, TimeSeries> {
    const results = new Map<string, TimeSeries>();
    
    for (const [name, series] of this.timeSeries.entries()) {
      if (name.startsWith(prefix)) {
        results.set(name, series);
      }
    }
    
    return results;
  }

  private sumMetricSeries(series?: TimeSeries): number {
    if (!series || series.points.length === 0) return 0;
    return series.points.reduce((sum, point) => sum + point.value, 0);
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateRate(value: number, period: string): number {
    // Simplified rate calculation - in production would be more sophisticated
    switch (period) {
      case '1m':
        return value / 60;
      case '1h':
        return value / 3600;
      case '1d':
        return value / 86400;
      case '30d':
        return value / (86400 * 30);
      default:
        return value;
    }
  }

  private getLatestMetricValue(metricName: string): number | undefined {
    const series = this.timeSeries.get(metricName);
    if (!series || series.points.length === 0) return undefined;
    
    return series.points[series.points.length - 1].value;
  }

  private getMetricsInTimeRange(prefix: string, timeRange: { start: Date; end: Date }): Map<string, TimeSeries> {
    const results = new Map<string, TimeSeries>();
    
    for (const [name, series] of this.timeSeries.entries()) {
      if (name.startsWith(prefix)) {
        const filteredPoints = series.points.filter(
          point => point.timestamp >= timeRange.start && point.timestamp <= timeRange.end
        );
        
        results.set(name, {
          ...series,
          points: filteredPoints
        });
      }
    }
    
    return results;
  }

  private sumTimeRangeMetrics(series: Map<string, TimeSeries>, suffix: string): number {
    const targetSeries = series.get(`generation.jobs.${suffix}`);
    return this.sumMetricSeries(targetSeries);
  }

  private getTimeRangeValues(metricName: string, timeRange: { start: Date; end: Date }): number[] {
    const series = this.timeSeries.get(metricName);
    if (!series) return [];
    
    return series.points
      .filter(point => point.timestamp >= timeRange.start && point.timestamp <= timeRange.end)
      .map(point => point.value);
  }

  private calculateRateForTimeRange(value: number, timeRange: { start: Date; end: Date }): number {
    const durationMs = timeRange.end.getTime() - timeRange.start.getTime();
    const hours = durationMs / (1000 * 60 * 60);
    return hours > 0 ? value / hours : 0;
  }

  private aggregateCostsByTag(tag: string, timeRange: { start: Date; end: Date }): Record<string, number> {
    const result: Record<string, number> = {};
    const series = this.timeSeries.get('generation.cost');
    
    if (!series) return result;
    
    series.points
      .filter(point => point.timestamp >= timeRange.start && point.timestamp <= timeRange.end)
      .forEach(point => {
        if (point.tags && point.tags[tag]) {
          result[point.tags[tag]] = (result[point.tags[tag]] || 0) + point.value;
        }
      });
    
    return result;
  }

  private aggregateErrorsByCode(timeRange: { start: Date; end: Date }): Record<string, number> {
    const result: Record<string, number> = {};
    const series = this.timeSeries.get('generation.errors');
    
    if (!series) return result;
    
    series.points
      .filter(point => point.timestamp >= timeRange.start && point.timestamp <= timeRange.end)
      .forEach(point => {
        if (point.tags && point.tags.error_code) {
          result[point.tags.error_code] = (result[point.tags.error_code] || 0) + point.value;
        }
      });
    
    return result;
  }

  private aggregateErrorsByTag(tag: string, timeRange: { start: Date; end: Date }): Record<string, number> {
    const result: Record<string, number> = {};
    const series = this.timeSeries.get('generation.errors');
    
    if (!series) return result;
    
    series.points
      .filter(point => point.timestamp >= timeRange.start && point.timestamp <= timeRange.end)
      .forEach(point => {
        if (point.tags && point.tags[tag]) {
          result[point.tags[tag]] = (result[point.tags[tag]] || 0) + point.value;
        }
      });
    
    return result;
  }

  private calculateRetryRate(timeRange: { start: Date; end: Date }): number {
    // Implementation would analyze retry metrics
    return 0;
  }

  private aggregateUsageByUser(timeRange: { start: Date; end: Date }): Record<string, number> {
    const result: Record<string, number> = {};
    const series = this.timeSeries.get('users.generations');
    
    if (!series) return result;
    
    series.points
      .filter(point => point.timestamp >= timeRange.start && point.timestamp <= timeRange.end)
      .forEach(point => {
        if (point.tags && point.tags.user_id) {
          result[point.tags.user_id] = (result[point.tags.user_id] || 0) + point.value;
        }
      });
    
    return result;
  }

  private aggregateUsageByTier(timeRange: { start: Date; end: Date }): Record<string, number> {
    // Implementation would analyze user tier usage
    return {};
  }

  private aggregatePopularStyles(timeRange: { start: Date; end: Date }): Record<string, number> {
    // Implementation would analyze style usage from job metadata
    return {};
  }

  private aggregatePopularAspectRatios(timeRange: { start: Date; end: Date }): Record<string, number> {
    // Implementation would analyze aspect ratio usage from job metadata
    return {};
  }

  private exportToPrometheus(): string {
    const lines: string[] = [];
    
    for (const [name, series] of this.timeSeries.entries()) {
      if (series.points.length === 0) continue;
      
      const latestPoint = series.points[series.points.length - 1];
      const metricName = name.replace(/\./g, '_').replace(/-/g, '_');
      
      let line = `# HELP ${metricName} ${series.description}`;
      lines.push(line);
      
      line = `# TYPE ${metricName} ${series.unit === 'count' ? 'counter' : 'gauge'}`;
      lines.push(line);
      
      if (latestPoint.tags) {
        const tagString = Object.entries(latestPoint.tags)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');
        line = `${metricName}{${tagString}} ${latestPoint.value} ${latestPoint.timestamp.getTime()}`;
      } else {
        line = `${metricName} ${latestPoint.value} ${latestPoint.timestamp.getTime()}`;
      }
      lines.push(line);
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private exportToJson(): any {
    const result: any = {};
    
    for (const [name, series] of this.timeSeries.entries()) {
      result[name] = {
        unit: series.unit,
        description: series.description,
        points: series.points.map(point => ({
          timestamp: point.timestamp.toISOString(),
          value: point.value,
          tags: point.tags,
          metadata: point.metadata
        }))
      };
    }
    
    return result;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Factory function
export const createMetricsCollector = (config?: Partial<MetricsConfig>): MetricsCollector => {
  return new MetricsCollector(config);
};

// Default singleton instance
let defaultCollector: MetricsCollector | null = null;

export const getDefaultMetricsCollector = (): MetricsCollector => {
  if (!defaultCollector) {
    defaultCollector = new MetricsCollector();
  }
  return defaultCollector;
};

export default MetricsCollector;