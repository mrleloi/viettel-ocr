import { Global, Module } from '@nestjs/common';
import { EnvConfigService } from '../config/env-config.service';
import { createDatabase, DATABASE_TOKEN } from './connection';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Database module — provides the Drizzle DB instance via DI.
 * Creates the data directory and initializes tables on startup.
 */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: (config: EnvConfigService) => {
        const dataDir = path.resolve(config.dataDir);

        // Ensure data directory exists
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        // Ensure uploads and exports subdirectories exist
        const uploadsDir = path.join(dataDir, 'uploads');
        const exportsDir = path.join(dataDir, 'exports');
        const logsDir = path.join(dataDir, 'logs');
        for (const dir of [uploadsDir, exportsDir, logsDir]) {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        }

        const dbPath = path.join(dataDir, 'database.sqlite');
        console.log(`📦 Database: ${dbPath}`);

        return createDatabase(dbPath);
      },
      inject: [EnvConfigService],
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule {}
