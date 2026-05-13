import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QueueWorkerService, type QueueMetrics } from '../../infrastructure/queue/queue-worker.service';
import { BullMQWorkerService } from '../../infrastructure/queue/bullmq-worker.service';
import { RateLimiter } from '../../infrastructure/queue/rate-limiter.service';
import type { IJobQueue } from '../../domain/shared/job-queue';
import { EnvConfigService } from '../../infrastructure/config/env-config.service';

/**
 * Queue metrics controller.
 * Provides observability into queue backend, concurrency, throughput, latency.
 */
@ApiTags('System')
@Controller('queue')
export class QueueController {
  constructor(
    private readonly config: EnvConfigService,
    private readonly memoryWorker: QueueWorkerService,
    private readonly redisWorker: BullMQWorkerService,
    private readonly rateLimiter: RateLimiter,
    @Inject('IJobQueue') private readonly queue: IJobQueue,
  ) {}

  /**
   * GET /api/queue/metrics — queue backend info, throughput, latency.
   */
  @Get('metrics')
  @ApiOperation({ summary: 'Queue metrics' })
  @ApiResponse({ status: 200 })
  async metrics(): Promise<{
    backend: string;
    metrics: QueueMetrics;
    pending: number;
    rateLimit: { availableTokens: number; maxPerMinute: number };
    config: { concurrency: number; maxAttempts: number; pollIntervalMs: number };
  }> {
    const isRedis = this.config.queueBackend === 'redis';
    const metrics = isRedis ? this.redisWorker.getMetrics() : this.memoryWorker.getMetrics();
    const pending = await this.queue.countPending();

    return {
      backend: this.config.queueBackend,
      metrics,
      pending,
      rateLimit: {
        availableTokens: this.rateLimiter.availableTokens(),
        maxPerMinute: this.config.queueRateLimitPerMinute,
      },
      config: {
        concurrency: this.config.queueConcurrency,
        maxAttempts: this.config.queueMaxAttempts,
        pollIntervalMs: this.config.queuePollIntervalMs,
      },
    };
  }
}
