import { createTestDb, TestDB } from '../../__tests__/test-db.helper';
import { NotificationRepositoryImpl } from '../notification.repository.impl';
import { Notification } from '../../../../domain/notification/notification.entity';

describe('NotificationRepositoryImpl', () => {
  let db: TestDB;
  let repo: NotificationRepositoryImpl;

  beforeEach(() => {
    db = createTestDb();
    repo = new NotificationRepositoryImpl(db);
  });

  function createTestNotification(overrides: Partial<{
    id: string;
    category: 'duplicate_detected' | 'low_confidence' | 'processing_error' | 'sync_conflict' | 'info';
    title: string;
    message: string;
    relatedEntityType: 'invoice' | 'batch' | 'schema' | 'product' | 'export';
    relatedEntityId: string;
  }> = {}): Notification {
    return Notification.create({
      category: 'duplicate_detected',
      title: 'Test notification',
      message: 'Test message',
      relatedEntityType: 'invoice',
      relatedEntityId: 'inv-001',
      ...overrides,
    });
  }

  describe('save', () => {
    it('should insert a new notification', async () => {
      const notification = createTestNotification({ id: 'ntf-1' });
      await repo.save(notification);

      const found = await repo.findById('ntf-1');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('ntf-1');
      expect(found!.category).toBe('duplicate_detected');
      expect(found!.title).toBe('Test notification');
      expect(found!.message).toBe('Test message');
      expect(found!.relatedEntityType).toBe('invoice');
      expect(found!.relatedEntityId).toBe('inv-001');
      expect(found!.isRead).toBe(false);
    });

    it('should update an existing notification on duplicate id', async () => {
      const notification = createTestNotification({ id: 'ntf-1' });
      await repo.save(notification);

      notification.markAsRead();
      await repo.save(notification);

      const found = await repo.findById('ntf-1');
      expect(found!.isRead).toBe(true);
    });

    it('should save with null related entity', async () => {
      const notification = Notification.create({
        id: 'ntf-null',
        category: 'info',
        title: 'Info',
        message: 'General info',
      });
      await repo.save(notification);

      const found = await repo.findById('ntf-null');
      expect(found!.relatedEntityType).toBeNull();
      expect(found!.relatedEntityId).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return null for non-existent id', async () => {
      const found = await repo.findById('non-existent');
      expect(found).toBeNull();
    });

    it('should return the notification for existing id', async () => {
      const notification = createTestNotification({ id: 'ntf-find' });
      await repo.save(notification);

      const found = await repo.findById('ntf-find');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('ntf-find');
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      // Insert 5 notifications with staggered timestamps
      for (let i = 1; i <= 5; i++) {
        const n = Notification.reconstitute({
          id: `ntf-${i}`,
          category: i <= 3 ? 'duplicate_detected' : 'info',
          title: `Title ${i}`,
          message: `Message ${i}`,
          relatedEntityType: 'invoice',
          relatedEntityId: `inv-${i}`,
          isRead: i <= 2, // first 2 are read
          createdAt: new Date(2026, 3, 8, 10, i, 0), // stagger by minute
        });
        await repo.save(n);
      }
    });

    it('should return all notifications ordered by newest first', async () => {
      const results = await repo.findAll();

      expect(results).toHaveLength(5);
      // Newest first
      expect(results[0].id).toBe('ntf-5');
      expect(results[4].id).toBe('ntf-1');
    });

    it('should filter unread only', async () => {
      const results = await repo.findAll({ unreadOnly: true });

      expect(results).toHaveLength(3); // ntf-3, ntf-4, ntf-5
      expect(results.every((n) => !n.isRead)).toBe(true);
    });

    it('should respect limit', async () => {
      const results = await repo.findAll({ limit: 2 });

      expect(results).toHaveLength(2);
    });

    it('should respect offset', async () => {
      const results = await repo.findAll({ limit: 2, offset: 2 });

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('ntf-3');
    });

    it('should return empty array when offset exceeds total', async () => {
      const results = await repo.findAll({ limit: 100, offset: 100 });

      expect(results).toHaveLength(0);
    });

    it('should return empty array when no notifications exist', async () => {
      const emptyDb = createTestDb();
      const emptyRepo = new NotificationRepositoryImpl(emptyDb);

      const results = await emptyRepo.findAll();
      expect(results).toHaveLength(0);
    });
  });

  describe('countUnread', () => {
    it('should return 0 when no notifications', async () => {
      const count = await repo.countUnread();
      expect(count).toBe(0);
    });

    it('should count only unread notifications', async () => {
      const read = Notification.reconstitute({
        id: 'ntf-read',
        category: 'info',
        title: 'Read',
        message: 'Already read',
        relatedEntityType: null,
        relatedEntityId: null,
        isRead: true,
        createdAt: new Date(),
      });
      const unread1 = createTestNotification({ id: 'ntf-unread-1' });
      const unread2 = createTestNotification({ id: 'ntf-unread-2' });

      await repo.save(read);
      await repo.save(unread1);
      await repo.save(unread2);

      const count = await repo.countUnread();
      expect(count).toBe(2);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const notification = createTestNotification({ id: 'ntf-mark' });
      await repo.save(notification);

      await repo.markAsRead('ntf-mark');

      const found = await repo.findById('ntf-mark');
      expect(found!.isRead).toBe(true);
    });

    it('should not throw for non-existent id', async () => {
      await expect(repo.markAsRead('non-existent')).resolves.not.toThrow();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      const a = createTestNotification({ id: 'ntf-a' });
      const b = createTestNotification({ id: 'ntf-b' });
      const c = createTestNotification({ id: 'ntf-c' });

      await repo.save(a);
      await repo.save(b);
      await repo.save(c);

      await repo.markAllAsRead();

      const count = await repo.countUnread();
      expect(count).toBe(0);

      const all = await repo.findAll();
      expect(all.every((n) => n.isRead)).toBe(true);
    });

    it('should not throw when no unread notifications exist', async () => {
      await expect(repo.markAllAsRead()).resolves.not.toThrow();
    });
  });
});
