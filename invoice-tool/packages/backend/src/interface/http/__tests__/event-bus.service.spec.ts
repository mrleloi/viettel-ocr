import { EventBusService, ServerEvent } from '../event-bus.service';

describe('EventBusService', () => {
  let service: EventBusService;

  beforeEach(() => {
    service = new EventBusService();
  });

  describe('emit and subscribe', () => {
    it('should emit events to subscribers', (done) => {
      const event: ServerEvent = {
        type: 'invoice.processed',
        data: { invoiceId: 'inv-1', status: 'completed' },
        timestamp: '2026-04-07T00:00:00Z',
      };

      service.subscribe().subscribe((msg) => {
        expect(msg.data).toEqual(event);
        expect(msg.type).toBe('invoice.processed');
        expect(msg.id).toContain('invoice.processed');
        done();
      });

      service.emit(event);
    });

    it('should emit multiple events in order', (done) => {
      const received: string[] = [];

      service.subscribe().subscribe((msg) => {
        received.push(msg.data.type);
        if (received.length === 3) {
          expect(received).toEqual([
            'invoice.processed',
            'batch.completed',
            'invoice.needs_review',
          ]);
          done();
        }
      });

      service.emit({ type: 'invoice.processed', data: {}, timestamp: '' });
      service.emit({ type: 'batch.completed', data: {}, timestamp: '' });
      service.emit({ type: 'invoice.needs_review', data: {}, timestamp: '' });
    });
  });

  describe('subscribeToType', () => {
    it('should only receive events of the specified type', (done) => {
      const received: string[] = [];

      service.subscribeToType('batch.completed').subscribe((msg) => {
        received.push(msg.data.type);
        if (received.length === 1) {
          // Should only have batch.completed, not invoice.processed
          expect(received).toEqual(['batch.completed']);
          done();
        }
      });

      service.emit({ type: 'invoice.processed', data: {}, timestamp: '' });
      service.emit({ type: 'batch.completed', data: { batchId: 'b1' }, timestamp: '' });
    });
  });

  describe('no subscribers', () => {
    it('should not throw when emitting with no subscribers', () => {
      expect(() => {
        service.emit({
          type: 'invoice.processed',
          data: {},
          timestamp: '2026-04-07T00:00:00Z',
        });
      }).not.toThrow();
    });
  });
});
