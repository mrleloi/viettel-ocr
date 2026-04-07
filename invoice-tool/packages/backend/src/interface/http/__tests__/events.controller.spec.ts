import { EventsController } from '../events.controller';
import { EventBusService, ServerEvent } from '../event-bus.service';
import { take, toArray } from 'rxjs';

describe('EventsController', () => {
  let controller: EventsController;
  let eventBus: EventBusService;

  beforeEach(() => {
    eventBus = new EventBusService();
    controller = new EventsController(eventBus);
  });

  describe('stream', () => {
    it('should return an observable', () => {
      const result = controller.stream();
      expect(result).toBeDefined();
      expect(typeof result.subscribe).toBe('function');
    });

    it('should emit real events from the event bus', (done) => {
      const event: ServerEvent = {
        type: 'invoice.processed',
        data: { invoiceId: 'inv-1' },
        timestamp: '2026-04-07T00:00:00Z',
      };

      // Take the first event from the stream
      controller
        .stream()
        .pipe(take(1))
        .subscribe((msg) => {
          expect(msg.type).toBe('invoice.processed');
          expect(msg.data).toBeDefined();
          done();
        });

      // Emit after subscribing
      setTimeout(() => eventBus.emit(event), 10);
    });

    it('should handle multiple event types', (done) => {
      const events$ = controller.stream().pipe(take(2), toArray());

      events$.subscribe((messages) => {
        expect(messages).toHaveLength(2);
        expect(messages[0].type).toBe('batch.completed');
        expect(messages[1].type).toBe('invoice.needs_review');
        done();
      });

      setTimeout(() => {
        eventBus.emit({
          type: 'batch.completed',
          data: { batchId: 'b1' },
          timestamp: '',
        });
        eventBus.emit({
          type: 'invoice.needs_review',
          data: { invoiceId: 'inv-2' },
          timestamp: '',
        });
      }, 10);
    });
  });
});
