import { Global, Module } from '@nestjs/common';
import { EnvConfigService } from './env-config.service';

/**
 * Global config module — makes EnvConfigService available everywhere.
 */
@Global()
@Module({
  providers: [EnvConfigService],
  exports: [EnvConfigService],
})
export class ConfigModule {}
