import { Module, forwardRef } from '@nestjs/common';
import { SqliteJobQueue } from './sqlite-job-queue.service';
import { QueueWorkerService } from './queue-worker.service';
import { ApplicationModule } from '../../application/application.module';

/**
 * Queue module — provides the SQLite-backed job queue and worker service.
 *
 * Exports IJobQueue for use by application-layer use cases.
 * QueueWorkerService starts polling on module init and stops on destroy.
 * Uses forwardRef to break circular dependency with ApplicationModule.
 */
@Module({
  imports: [forwardRef(() => ApplicationModule)],
  providers: [
    { provide: 'IJobQueue', useClass: SqliteJobQueue },
    QueueWorkerService,
  ],
  exports: ['IJobQueue'],
})
export class QueueModule {}

