import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from '../notification.controller';
import { ListNotificationsUseCase } from '../../../application/notification/list-notifications.use-case';
import { MarkNotificationReadUseCase } from '../../../application/notification/mark-notification-read.use-case';

describe('NotificationController', () => {
  let controller: NotificationController;
  let listUseCase: jest.Mocked<ListNotificationsUseCase>;
  let markReadUseCase: jest.Mocked<MarkNotificationReadUseCase>;

  beforeEach(async () => {
    const mockListUseCase = {
      execute: jest.fn(),
    };
    const mockMarkReadUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        { provide: ListNotificationsUseCase, useValue: mockListUseCase },
        { provide: MarkNotificationReadUseCase, useValue: mockMarkReadUseCase },
      ],
    }).compile();

    controller = module.get(NotificationController);
    listUseCase = module.get(ListNotificationsUseCase);
    markReadUseCase = module.get(MarkNotificationReadUseCase);
  });

  describe('list', () => {
    it('should return notifications and unread count', async () => {
      listUseCase.execute.mockResolvedValue({
        notifications: [
          {
            id: 'ntf-1',
            category: 'duplicate_detected',
            title: 'Duplicate found',
            message: 'File already exists',
            relatedEntityType: 'invoice',
            relatedEntityId: 'inv-1',
            isRead: false,
            createdAt: '2026-04-08T10:00:00.000Z',
          },
        ],
        unreadCount: 3,
      });

      const result = await controller.list({});

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].id).toBe('ntf-1');
      expect(result.unreadCount).toBe(3);
    });

    it('should pass unreadOnly filter to use case', async () => {
      listUseCase.execute.mockResolvedValue({ notifications: [], unreadCount: 0 });

      await controller.list({ unreadOnly: 'true' });

      expect(listUseCase.execute).toHaveBeenCalledWith({
        unreadOnly: true,
        limit: undefined,
        offset: undefined,
      });
    });

    it('should parse limit and offset as integers', async () => {
      listUseCase.execute.mockResolvedValue({ notifications: [], unreadCount: 0 });

      await controller.list({ limit: '10', offset: '20' });

      expect(listUseCase.execute).toHaveBeenCalledWith({
        unreadOnly: undefined,
        limit: 10,
        offset: 20,
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      listUseCase.execute.mockResolvedValue({ notifications: [], unreadCount: 7 });

      const result = await controller.getUnreadCount();

      expect(result.unreadCount).toBe(7);
    });
  });

  describe('markRead', () => {
    it('should mark a single notification as read', async () => {
      markReadUseCase.execute.mockResolvedValue(undefined);

      await controller.markRead('ntf-123');

      expect(markReadUseCase.execute).toHaveBeenCalledWith({ id: 'ntf-123' });
    });
  });

  describe('markAllRead', () => {
    it('should mark all notifications as read', async () => {
      markReadUseCase.execute.mockResolvedValue(undefined);

      await controller.markAllRead();

      expect(markReadUseCase.execute).toHaveBeenCalledWith({});
    });
  });
});
