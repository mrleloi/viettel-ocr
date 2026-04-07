import { Controller, Get } from '@nestjs/common';

/**
 * Health check controller.
 * Provides a basic endpoint to verify the API is running.
 */
@Controller('health')
export class HealthController {
  /**
   * GET /api/health
   * @returns Health status object
   */
  @Get()
  check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
