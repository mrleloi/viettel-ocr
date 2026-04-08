import { Notification } from '../notification.entity';

describe('Notification', () => {
  const validProps = {
    category: 'duplicate_detected' as const,
    title: 'Phát hiện file trùng lặp',
    message: 'File invoice-001.pdf đã tồn tại trong hệ thống',
    relatedEntityType: 'invoice' as const,
    relatedEntityId: 'inv-123',
  };

  describe('create', () => {
    it('should create a notification with valid props', () => {
      const notification = Notification.create(validProps);

      expect(notification.id).toBeDefined();
      expect(notification.id.length).toBeGreaterThan(0);
      expect(notification.category).toBe('duplicate_detected');
      expect(notification.title).toBe('Phát hiện file trùng lặp');
      expect(notification.message).toBe('File invoice-001.pdf đã tồn tại trong hệ thống');
      expect(notification.relatedEntityType).toBe('invoice');
      expect(notification.relatedEntityId).toBe('inv-123');
      expect(notification.isRead).toBe(false);
      expect(notification.createdAt).toBeInstanceOf(Date);
    });

    it('should generate a unique id when not provided', () => {
      const a = Notification.create(validProps);
      const b = Notification.create(validProps);

      expect(a.id).not.toBe(b.id);
    });

    it('should use provided id when given', () => {
      const notification = Notification.create({ ...validProps, id: 'custom-id-123' });

      expect(notification.id).toBe('custom-id-123');
    });

    it('should create with null related entity', () => {
      const notification = Notification.create({
        category: 'info',
        title: 'System notification',
        message: 'All systems operational',
      });

      expect(notification.relatedEntityType).toBeNull();
      expect(notification.relatedEntityId).toBeNull();
    });

    it('should throw when title is empty', () => {
      expect(() =>
        Notification.create({ ...validProps, title: '' }),
      ).toThrow('Title is required');
    });

    it('should throw when title is whitespace only', () => {
      expect(() =>
        Notification.create({ ...validProps, title: '   ' }),
      ).toThrow('Title is required');
    });

    it('should throw when message is empty', () => {
      expect(() =>
        Notification.create({ ...validProps, message: '' }),
      ).toThrow('Message is required');
    });

    it('should throw when message is whitespace only', () => {
      expect(() =>
        Notification.create({ ...validProps, message: '   ' }),
      ).toThrow('Message is required');
    });

    it('should throw when category is invalid', () => {
      expect(() =>
        Notification.create({ ...validProps, category: 'invalid_cat' as never }),
      ).toThrow('Invalid notification category');
    });

    it('should accept all valid categories', () => {
      const categories = [
        'duplicate_detected',
        'low_confidence',
        'processing_error',
        'sync_conflict',
        'schema_suggestion',
        'export_completed',
        'info',
      ] as const;

      for (const category of categories) {
        const n = Notification.create({ ...validProps, category });
        expect(n.category).toBe(category);
      }
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from stored props without validation', () => {
      const now = new Date();
      const notification = Notification.reconstitute({
        id: 'stored-id',
        category: 'processing_error',
        title: 'Pipeline error',
        message: 'Failed to process invoice',
        relatedEntityType: 'invoice',
        relatedEntityId: 'inv-456',
        isRead: true,
        createdAt: now,
      });

      expect(notification.id).toBe('stored-id');
      expect(notification.category).toBe('processing_error');
      expect(notification.isRead).toBe(true);
      expect(notification.createdAt).toBe(now);
    });
  });

  describe('markAsRead', () => {
    it('should transition isRead from false to true', () => {
      const notification = Notification.create(validProps);
      expect(notification.isRead).toBe(false);

      notification.markAsRead();
      expect(notification.isRead).toBe(true);
    });

    it('should be a no-op when already read', () => {
      const notification = Notification.reconstitute({
        id: 'id',
        category: 'info',
        title: 'Test',
        message: 'Test',
        relatedEntityType: null,
        relatedEntityId: null,
        isRead: true,
        createdAt: new Date(),
      });

      notification.markAsRead();
      expect(notification.isRead).toBe(true);
    });
  });

  describe('toPlainObject', () => {
    it('should return a plain serializable object', () => {
      const notification = Notification.create(validProps);
      const plain = notification.toPlainObject();

      expect(plain.id).toBe(notification.id);
      expect(plain.category).toBe('duplicate_detected');
      expect(plain.title).toBe(validProps.title);
      expect(plain.message).toBe(validProps.message);
      expect(plain.relatedEntityType).toBe('invoice');
      expect(plain.relatedEntityId).toBe('inv-123');
      expect(plain.isRead).toBe(false);
      expect(typeof plain.createdAt).toBe('string');
    });
  });
});
