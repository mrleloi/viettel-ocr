import { Controller, Sse, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Observable, interval, map, merge } from 'rxjs';
import { EventBusService } from './event-bus.service';

/**
 * EventsController — Server-Sent Events endpoint for real-time updates.
 *
 * Clients connect to GET /api/events and receive a stream of events
 * for invoice processing status, batch completion, and review notifications.
 *
 * The heartbeat ensures the connection stays alive through proxies/load balancers.
 */
@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventBus: EventBusService) {}

  /**
   * SSE stream endpoint.
   * Emits real-time events for invoice processing, batch completion, etc.
   * Includes a heartbeat every 30 seconds to keep the connection alive.
   * @returns Observable stream of MessageEvent objects
   */
  @Sse()
  @ApiOperation({ summary: 'Subscribe to server-sent events' })
  @ApiResponse({ status: 200, description: 'SSE event stream' })
  stream(): Observable<MessageEvent> {
    // Heartbeat every 30 seconds to keep connection alive
    const heartbeat$ = interval(30_000).pipe(
      map(
        (): MessageEvent => ({
          data: { type: 'heartbeat', timestamp: new Date().toISOString() },
          type: 'heartbeat',
        }),
      ),
    );

    // Merge real events with heartbeat
    const events$ = this.eventBus.subscribe().pipe(
      map(
        (event): MessageEvent => ({
          data: event.data,
          type: event.type,
          id: event.id,
        }),
      ),
    );

    return merge(events$, heartbeat$);
  }
}
