import { ProcessingTrace } from '../processing-trace.entity';

describe('ProcessingTrace Entity', () => {
  describe('create()', () => {
    it('should create a trace with required fields', () => {
      const trace = ProcessingTrace.create({
        invoiceId: 'inv-001',
        stage: 'classify',
        status: 'completed',
      });

      expect(trace.id).toBeDefined();
      expect(trace.invoiceId).toBe('inv-001');
      expect(trace.stage).toBe('classify');
      expect(trace.status).toBe('completed');
      expect(trace.inputData).toBeNull();
      expect(trace.outputData).toBeNull();
      expect(trace.errorMessage).toBeNull();
      expect(trace.durationMs).toBeNull();
      expect(trace.createdAt).toBeInstanceOf(Date);
    });

    it('should create a trace with all optional fields', () => {
      const trace = ProcessingTrace.create({
        id: 'trace-custom',
        invoiceId: 'inv-002',
        stage: 'extract',
        status: 'completed',
        inputData: '{"pdf":"base64..."}',
        outputData: '{"fields":{}}',
        errorMessage: null,
        durationMs: 1500,
      });

      expect(trace.id).toBe('trace-custom');
      expect(trace.inputData).toBe('{"pdf":"base64..."}');
      expect(trace.outputData).toBe('{"fields":{}}');
      expect(trace.durationMs).toBe(1500);
    });

    it('should create a failed trace with error message', () => {
      const trace = ProcessingTrace.create({
        invoiceId: 'inv-003',
        stage: 'validate',
        status: 'failed',
        errorMessage: 'Validation timeout',
        durationMs: 30000,
      });

      expect(trace.status).toBe('failed');
      expect(trace.errorMessage).toBe('Validation timeout');
      expect(trace.durationMs).toBe(30000);
    });

    // --- Error cases ---

    it('should throw if invoiceId is empty', () => {
      expect(() => ProcessingTrace.create({
        invoiceId: '',
        stage: 'classify',
        status: 'completed',
      })).toThrow('ProcessingTrace invoiceId is required');
    });

    it('should throw if stage is empty', () => {
      expect(() => ProcessingTrace.create({
        invoiceId: 'inv-001',
        stage: '',
        status: 'completed',
      })).toThrow('ProcessingTrace stage is required');
    });

    it('should throw if status is empty', () => {
      expect(() => ProcessingTrace.create({
        invoiceId: 'inv-001',
        stage: 'classify',
        status: '',
      })).toThrow('ProcessingTrace status is required');
    });

    it('should throw if durationMs is negative', () => {
      expect(() => ProcessingTrace.create({
        invoiceId: 'inv-001',
        stage: 'classify',
        status: 'completed',
        durationMs: -1,
      })).toThrow('ProcessingTrace durationMs must be non-negative');
    });

    it('should allow durationMs of zero', () => {
      const trace = ProcessingTrace.create({
        invoiceId: 'inv-001',
        stage: 'classify',
        status: 'completed',
        durationMs: 0,
      });
      expect(trace.durationMs).toBe(0);
    });
  });

  describe('reconstitute()', () => {
    it('should reconstitute from stored props without validation', () => {
      const date = new Date('2026-01-15T10:00:00Z');
      const trace = ProcessingTrace.reconstitute({
        id: 'trace-123',
        invoiceId: 'inv-456',
        stage: 'score',
        status: 'completed',
        inputData: null,
        outputData: '{"score":0.85}',
        errorMessage: null,
        durationMs: 50,
        createdAt: date,
      });

      expect(trace.id).toBe('trace-123');
      expect(trace.invoiceId).toBe('inv-456');
      expect(trace.stage).toBe('score');
      expect(trace.status).toBe('completed');
      expect(trace.outputData).toBe('{"score":0.85}');
      expect(trace.durationMs).toBe(50);
      expect(trace.createdAt).toEqual(date);
    });
  });

  describe('toProps()', () => {
    it('should return a plain object copy', () => {
      const trace = ProcessingTrace.create({
        invoiceId: 'inv-001',
        stage: 'route',
        status: 'completed',
        durationMs: 5,
      });

      const props = trace.toProps();
      expect(props.id).toBe(trace.id);
      expect(props.invoiceId).toBe('inv-001');
      expect(props.stage).toBe('route');
      expect(props.status).toBe('completed');
      expect(props.durationMs).toBe(5);
      expect(props.createdAt).toBeInstanceOf(Date);
    });
  });
});
