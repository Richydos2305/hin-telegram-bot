import { trackMessage } from './index';
import { messageStore } from '../../bot';

describe('trackMessage', () => {
  beforeEach(() => {
    messageStore.clear();
    jest.clearAllMocks();
  });

  it('should add a new user and track messages', () => {
    const userId = 1;
    const messageIds = [101, 102];

    jest.spyOn(console, 'log').mockImplementation(() => {});

    trackMessage(userId, messageIds);

    expect(messageStore.has(userId)).toBe(true);
    expect(messageStore.get(userId)).toEqual(messageIds);
  });

  it('should append messages if user already exists', () => {
    const userId = 2;
    messageStore.set(userId, [200]);

    const newMessages = [201, 202];
    trackMessage(userId, newMessages);

    expect(messageStore.get(userId)).toEqual([200, 201, 202]);
  });

  it('should call console.log when a new user is added', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const userId = 3;
    const messageIds = [301];

    trackMessage(userId, messageIds);

    expect(consoleSpy).toHaveBeenCalledWith(`New user with ID: ${userId}`);
    consoleSpy.mockRestore();
  });
});
