import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * Health check controller.
 * Provides a basic endpoint to verify the API is running.
 */
@ApiTags('System')
@Controller('health')
export class HealthController {
  /**
   * GET /api/health
   * @returns Health status object
   */
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'API is healthy' })
  check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
