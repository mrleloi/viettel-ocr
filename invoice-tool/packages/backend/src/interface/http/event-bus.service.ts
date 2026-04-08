import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';

/**
 * Server event types emitted through the SSE stream.
 */
export type ServerEventType =
  | 'invoice.processed'
  | 'batch.completed'
  | 'invoice.needs_review'
  | 'export.completed'
  | 'product.synced'
  | 'notification.created';

/**
 * Payload for a server-sent event.
 */
export interface ServerEvent {
  /** Event type identifier */
  type: ServerEventType;
  /** Event payload data */
  data: Record<string, unknown>;
  /** ISO timestamp of when the event was created */
  timestamp: string;
}

/**
 * MessageEvent shape used by NestJS SSE endpoints.
 */
export interface SseMessageEvent {
  data: ServerEvent;
  type?: string;
  id?: string;
  retry?: number;
}

/**
 * EventBusService — centralized event bus for server-sent events.
 *
 * Other services can publish events via `emit()`.
 * The SSE controller subscribes to the stream via `subscribe()`.
 *
 * @example
 * ```ts
 * this.eventBus.emit({
 *   type: 'invoice.processed',
 *   data: { invoiceId: '...', status: 'completed' },
 *   timestamp: new Date().toISOString(),
 * });
 * ```
 */
@Injectable()
export class EventBusService {
  private readonly subject = new Subject<ServerEvent>();

  /**
   * Emit a server event to all SSE subscribers.
   * @param event - The event to emit
   */
  emit(event: ServerEvent): void {
    this.subject.next(event);
  }

  /**
   * Subscribe to all events as SSE MessageEvents.
   * @returns Observable of SSE MessageEvent objects
   */
  subscribe(): Observable<SseMessageEvent> {
    return this.subject.asObservable().pipe(
      map((event) => ({
        data: event,
        type: event.type,
        id: `${event.type}-${Date.now()}`,
      })),
    );
  }

  /**
   * Subscribe to events of a specific type.
   * @param eventType - The type of events to listen for
   * @returns Observable of filtered SSE MessageEvent objects
   */
  subscribeToType(eventType: ServerEventType): Observable<SseMessageEvent> {
    return this.subject.asObservable().pipe(
      filter((event) => event.type === eventType),
      map((event) => ({
        data: event,
        type: event.type,
        id: `${event.type}-${Date.now()}`,
      })),
    );
  }
}
