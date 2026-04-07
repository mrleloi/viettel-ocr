import { Module } from '@nestjs/common';
import { LocalFileStorage } from './local-storage.service';

/**
 * NestJS module for file storage services.
 * Provides LocalFileStorage as the IFileStorage implementation.
 * ConfigModule is @Global so no explicit import needed.
 */
@Module({
  providers: [
    LocalFileStorage,
    {
      provide: 'IFileStorage',
      useExisting: LocalFileStorage,
    },
  ],
  exports: ['IFileStorage'],
})
export class FileStorageModule {}
