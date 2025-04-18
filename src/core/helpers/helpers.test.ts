import { trackMessage, deleteChatHistory, getAccessToken, isLoggedIn } from './index';
import { messageStore, bot } from '../../bot';
import * as jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { settings } from '../config/application';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn()
}));

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

describe('deleteChatHistory', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    messageStore.clear();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should delete all messages and clear the message store', async () => {
    messageStore.set(12345, [1, 2, 3]);
    messageStore.set(67890, [4, 5]);
    const deleteMessageSpy = jest.spyOn(bot.api, 'deleteMessage').mockResolvedValue(true);

    await deleteChatHistory();

    expect(deleteMessageSpy).toHaveBeenCalledTimes(5);
    expect(deleteMessageSpy).toHaveBeenCalledWith(12345, 1);
    expect(deleteMessageSpy).toHaveBeenCalledWith(12345, 2);
    expect(deleteMessageSpy).toHaveBeenCalledWith(12345, 3);
    expect(deleteMessageSpy).toHaveBeenCalledWith(67890, 4);
    expect(deleteMessageSpy).toHaveBeenCalledWith(67890, 5);

    expect(messageStore.size).toBe(0);
  });

  it('should handle errors and still continue deleting messages', async () => {
    messageStore.set(10001, [101, 102]);
    (bot.api.deleteMessage as jest.Mock).mockImplementation((userId, messageId) => {
      if (messageId === 101) {
        throw new Error('Test deletion error');
      }
    });

    await deleteChatHistory();

    expect(bot.api.deleteMessage).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(`Failed to delete message 101 for user 10001:`, expect.any(Error));
    expect(messageStore.size).toBe(0);
  });

  it('should log "Messages Cleared" after deleting', async () => {
    messageStore.set(20001, [201]);

    await deleteChatHistory();

    expect(logSpy).toHaveBeenCalledWith('Messages Cleared');
  });
});

describe('getAccessToken', () => {
  const mockUser = {
    username: 'richard',
    id: new Types.ObjectId()
  };

  const mockToken: string = 'mocked.jwt.token';

  it('should call jwt.sign with correct payload, secret, and options', () => {
    (jwt.sign as jest.Mock).mockReturnValue(mockToken);

    const token = getAccessToken(mockUser);

    expect(jwt.sign).toHaveBeenCalledWith(
      {
        userDetails: {
          name: mockUser.username,
          id: mockUser.id
        }
      },
      settings.secretKey,
      { expiresIn: '4h' }
    );

    expect(token).toBe(mockToken);
  });
});

describe('isLoggedIn', () => {
  const mockToken = 'mock.token.here';
  const verifyMock = jwt.verify as jest.Mock;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return false if token is null', () => {
    const result = isLoggedIn(null);
    expect(result).toBe(false);
  });

  it('should return true if verify does not throw', () => {
    verifyMock.mockReturnValue({ valid: true });

    const result = isLoggedIn(mockToken);
    expect(jwt.verify).toHaveBeenCalledWith(mockToken, expect.any(String));
    expect(result).toBe(true);
  });

  it('should return false if verify throws an error', () => {
    verifyMock.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = isLoggedIn(mockToken);

    expect(jwt.verify).toHaveBeenCalledWith(mockToken, expect.any(String));
    expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    expect(result).toBe(false);

    consoleSpy.mockRestore();
  });
});
