import { CreateNotificationUseCase } from '../create-notification.use-case';
import { ListNotificationsUseCase } from '../list-notifications.use-case';
import { MarkNotificationReadUseCase } from '../mark-notification-read.use-case';
import { Notification } from '../../../domain/notification/notification.entity';
import type { INotificationRepository } from '../../../domain/notification/notification.repository';

function createMockRepo(): jest.Mocked<INotificationRepository> {
  return {
    findById: jest.fn(),
    findAll: jest.fn(),
    countUnread: jest.fn(),
    save: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  };
}

function createMockEventBus() {
  return {
    emit: jest.fn(),
    subscribe: jest.fn(),
    subscribeToType: jest.fn(),
  };
}

describe('CreateNotificationUseCase', () => {
  let useCase: CreateNotificationUseCase;
  let mockRepo: jest.Mocked<INotificationRepository>;
  let mockEventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    mockRepo = createMockRepo();
    mockEventBus = createMockEventBus();
    useCase = new CreateNotificationUseCase(mockRepo, mockEventBus as never);
  });

  it('should create and persist a notification', async () => {
    const result = await useCase.execute({
      category: 'duplicate_detected',
      title: 'Phát hiện trùng lặp',
      message: 'File invoice-001.pdf đã tồn tại',
      relatedEntityType: 'invoice',
      relatedEntityId: 'inv-123',
    });

    expect(result.id).toBeDefined();
    expect(result.category).toBe('duplicate_detected');
    expect(result.title).toBe('Phát hiện trùng lặp');
    expect(result.createdAt).toBeDefined();
    expect(mockRepo.save).toHaveBeenCalledTimes(1);

    const savedNotification = mockRepo.save.mock.calls[0][0];
    expect(savedNotification).toBeInstanceOf(Notification);
    expect(savedNotification.category).toBe('duplicate_detected');
  });

  it('should emit a notification.created SSE event', async () => {
    await useCase.execute({
      category: 'processing_error',
      title: 'Lỗi xử lý',
      message: 'Pipeline failed for invoice-002.pdf',
    });

    expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
    const emittedEvent = mockEventBus.emit.mock.calls[0][0];
    expect(emittedEvent.type).toBe('notification.created');
    expect(emittedEvent.data.category).toBe('processing_error');
    expect(emittedEvent.data.title).toBe('Lỗi xử lý');
    expect(emittedEvent.timestamp).toBeDefined();
  });

  it('should not throw if event bus emit fails', async () => {
    mockEventBus.emit.mockImplementation(() => {
      throw new Error('Event bus unavailable');
    });

    const result = await useCase.execute({
      category: 'info',
      title: 'Test',
      message: 'Test message',
    });

    expect(result.id).toBeDefined();
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should create notification with null related entity', async () => {
    const result = await useCase.execute({
      category: 'info',
      title: 'System info',
      message: 'All systems operational',
    });

    expect(result.id).toBeDefined();
    const saved = mockRepo.save.mock.calls[0][0];
    expect(saved.relatedEntityType).toBeNull();
    expect(saved.relatedEntityId).toBeNull();
  });
});

describe('ListNotificationsUseCase', () => {
  let useCase: ListNotificationsUseCase;
  let mockRepo: jest.Mocked<INotificationRepository>;

  beforeEach(() => {
    mockRepo = createMockRepo();
    useCase = new ListNotificationsUseCase(mockRepo);
  });

  it('should return notifications with unread count', async () => {
    const n1 = Notification.create({
      id: 'ntf-1',
      category: 'info',
      title: 'Title 1',
      message: 'Msg 1',
    });
    const n2 = Notification.create({
      id: 'ntf-2',
      category: 'duplicate_detected',
      title: 'Title 2',
      message: 'Msg 2',
      relatedEntityType: 'invoice',
      relatedEntityId: 'inv-1',
    });

    mockRepo.findAll.mockResolvedValue([n1, n2]);
    mockRepo.countUnread.mockResolvedValue(5);

    const result = await useCase.execute({});

    expect(result.notifications).toHaveLength(2);
    expect(result.unreadCount).toBe(5);
    expect(result.notifications[0].id).toBe('ntf-1');
    expect(result.notifications[1].category).toBe('duplicate_detected');
  });

  it('should pass unreadOnly filter to repo', async () => {
    mockRepo.findAll.mockResolvedValue([]);
    mockRepo.countUnread.mockResolvedValue(0);

    await useCase.execute({ unreadOnly: true });

    expect(mockRepo.findAll).toHaveBeenCalledWith({
      unreadOnly: true,
      limit: undefined,
      offset: undefined,
    });
  });

  it('should pass limit and offset to repo', async () => {
    mockRepo.findAll.mockResolvedValue([]);
    mockRepo.countUnread.mockResolvedValue(0);

    await useCase.execute({ limit: 10, offset: 20 });

    expect(mockRepo.findAll).toHaveBeenCalledWith({
      unreadOnly: undefined,
      limit: 10,
      offset: 20,
    });
  });

  it('should return empty array when no notifications', async () => {
    mockRepo.findAll.mockResolvedValue([]);
    mockRepo.countUnread.mockResolvedValue(0);

    const result = await useCase.execute({});

    expect(result.notifications).toHaveLength(0);
    expect(result.unreadCount).toBe(0);
  });
});

describe('MarkNotificationReadUseCase', () => {
  let useCase: MarkNotificationReadUseCase;
  let mockRepo: jest.Mocked<INotificationRepository>;

  beforeEach(() => {
    mockRepo = createMockRepo();
    useCase = new MarkNotificationReadUseCase(mockRepo);
  });

  it('should mark a single notification as read', async () => {
    await useCase.execute({ id: 'ntf-123' });

    expect(mockRepo.markAsRead).toHaveBeenCalledWith('ntf-123');
    expect(mockRepo.markAllAsRead).not.toHaveBeenCalled();
  });

  it('should mark all notifications as read when no id provided', async () => {
    await useCase.execute({});

    expect(mockRepo.markAllAsRead).toHaveBeenCalledTimes(1);
    expect(mockRepo.markAsRead).not.toHaveBeenCalled();
  });

  it('should not throw on non-existent id', async () => {
    mockRepo.markAsRead.mockResolvedValue(undefined);

    await expect(useCase.execute({ id: 'non-existent' })).resolves.not.toThrow();
  });
});
