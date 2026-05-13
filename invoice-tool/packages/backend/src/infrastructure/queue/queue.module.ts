import { Module, forwardRef, Logger } from '@nestjs/common';
import IORedis from 'ioredis';
import { SqliteJobQueue } from './sqlite-job-queue.service';
import { QueueWorkerService } from './queue-worker.service';
import { BullMQJobQueue } from './bullmq-job-queue.service';
import { BullMQWorkerService } from './bullmq-worker.service';
import { RateLimiter } from './rate-limiter.service';
import { ApplicationModule } from '../../application/application.module';
import { EnvConfigService } from '../config/env-config.service';
import { DATABASE_TOKEN } from '../database/connection';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { ProcessInvoiceUseCase } from '../../application/processing/process-invoice.use-case';
import type { IInvoiceRepository } from '../../domain/invoice/invoice.repository';

/** BullMQ queue name (shared between queue + worker) */
const BULLMQ_QUEUE_NAME = 'invoice-processing';

/**
 * Queue module — provides the job queue (memory or Redis-backed) and worker.
 *
 * Backend selection via env var QUEUE_BACKEND:
 * - 'memory' (default): SqliteJobQueue + QueueWorkerService (polling, concurrent)
 * - 'redis':            BullMQJobQueue + BullMQWorkerService (push, BullMQ Worker)
 *
 * The same RateLimiter is shared by both backends for outbound Gemini calls.
 */
@Module({
  imports: [forwardRef(() => ApplicationModule)],
  providers: [
    // Rate limiter shared across backends
    {
      provide: RateLimiter,
      useFactory: (config: EnvConfigService) => new RateLimiter(config.queueRateLimitPerMinute),
      inject: [EnvConfigService],
    },

    // Optional Redis connection (only created when backend=redis)
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: EnvConfigService) => {
        if (config.queueBackend !== 'redis') return null;
        const logger = new Logger('RedisClient');
        const client = new IORedis({
          host: config.redisHost,
          port: config.redisPort,
          password: config.redisPassword || undefined,
          db: config.redisDb,
          maxRetriesPerRequest: null, // required by BullMQ
          enableReadyCheck: false,
        });
        client.on('connect', () => logger.log(`Connected to Redis ${config.redisHost}:${config.redisPort} db=${config.redisDb}`));
        client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
        return client;
      },
      inject: [EnvConfigService],
    },

    // IJobQueue — dispatch to memory or redis implementation
    {
      provide: 'IJobQueue',
      useFactory: (
        config: EnvConfigService,
        db: BetterSQLite3Database<Record<string, never>>,
        redis: IORedis | null,
      ) => {
        if (config.queueBackend === 'redis') {
          if (!redis) throw new Error('QUEUE_BACKEND=redis but Redis client is null');
          return new BullMQJobQueue(redis, BULLMQ_QUEUE_NAME, config.redisKeyPrefix, config.queueMaxAttempts);
        }
        return new SqliteJobQueue(db);
      },
      inject: [EnvConfigService, DATABASE_TOKEN, 'REDIS_CLIENT'],
    },

    // In-memory worker — active when backend=memory, stub otherwise
    {
      provide: QueueWorkerService,
      useFactory: (
        config: EnvConfigService,
        queue: SqliteJobQueue | BullMQJobQueue,
        processInvoice: ProcessInvoiceUseCase,
        invoiceRepo: IInvoiceRepository,
      ) => {
        const enabled = config.queueBackend === 'memory';
        return new QueueWorkerService(
          queue,
          processInvoice,
          config.queuePollIntervalMs,
          config.queueConcurrency,
          invoiceRepo,
          enabled,
        );
      },
      inject: [EnvConfigService, 'IJobQueue', ProcessInvoiceUseCase, 'IInvoiceRepository'],
    },

    // BullMQ worker — active when backend=redis, stub otherwise
    {
      provide: BullMQWorkerService,
      useFactory: (
        config: EnvConfigService,
        redis: IORedis | null,
        queue: SqliteJobQueue | BullMQJobQueue,
        processInvoice: ProcessInvoiceUseCase,
        invoiceRepo: IInvoiceRepository,
      ) => {
        const enabled = config.queueBackend === 'redis' && !!redis;
        return new BullMQWorkerService(
          redis ?? ({} as IORedis),
          BULLMQ_QUEUE_NAME,
          config.redisKeyPrefix,
          config.queueConcurrency,
          processInvoice,
          queue,
          invoiceRepo,
          enabled,
        );
      },
      inject: [EnvConfigService, 'REDIS_CLIENT', 'IJobQueue', ProcessInvoiceUseCase, 'IInvoiceRepository'],
    },
  ],
  exports: ['IJobQueue', RateLimiter, QueueWorkerService, BullMQWorkerService],
})
export class QueueModule {}
