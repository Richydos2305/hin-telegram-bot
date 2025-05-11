import { MyContext } from './helpers';
import * as utils from './utils';
import * as numberUtils from './numberUtils';
import * as helpers from './helpers';
import { messageStore, bot } from '../../bot';
import * as jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { settings } from '../config/application';
import { HighRiskAccounts } from '../models/highRiskAccounts';
import { Users } from '../models/users';
import { Quarters } from '../models/quarters';
import { HinBuffer } from '../models/buffer';

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

    helpers.trackMessage(userId, messageIds);

    expect(messageStore.has(userId)).toBe(true);
    expect(messageStore.get(userId)).toEqual(messageIds);
  });

  it('should append messages if user already exists', () => {
    const userId = 2;
    messageStore.set(userId, [200]);

    const newMessages = [201, 202];
    helpers.trackMessage(userId, newMessages);

    expect(messageStore.get(userId)).toEqual([200, 201, 202]);
  });

  it('should call console.log when a new user is added', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const userId = 3;
    const messageIds = [301];

    helpers.trackMessage(userId, messageIds);

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

    await helpers.deleteChatHistory();

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

    await helpers.deleteChatHistory();

    expect(bot.api.deleteMessage).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(`Failed to delete message 101 for user 10001:`, expect.any(Error));
    expect(messageStore.size).toBe(0);
  });

  it('should log "Messages Cleared" after deleting', async () => {
    messageStore.set(20001, [201]);

    await helpers.deleteChatHistory();

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

    const token = helpers.getAccessToken(mockUser);

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
    const result = helpers.isLoggedIn(null);
    expect(result).toBe(false);
  });

  it('should return true if verify does not throw', () => {
    verifyMock.mockReturnValue({ valid: true });

    const result = helpers.isLoggedIn(mockToken);
    expect(jwt.verify).toHaveBeenCalledWith(mockToken, expect.any(String));
    expect(result).toBe(true);
  });

  it('should return false if verify throws an error', () => {
    verifyMock.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = helpers.isLoggedIn(mockToken);

    expect(jwt.verify).toHaveBeenCalledWith(mockToken, expect.any(String));
    expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    expect(result).toBe(false);

    consoleSpy.mockRestore();
  });
});

describe('getRandomInt', () => {
  it('returns a number between min and max (inclusive)', () => {
    const min = 1;
    const max = 5;

    for (let i = 0; i < 50; i++) {
      const result = numberUtils.getRandomInt(min, max);
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThanOrEqual(max);
    }
  });

  it('works when min and max are the same', () => {
    const result = numberUtils.getRandomInt(3, 3);
    expect(result).toBe(3);
  });

  it('returns integers only', () => {
    const min = 10;
    const max = 20;

    for (let i = 0; i < 100; i++) {
      const result = numberUtils.getRandomInt(min, max);
      expect(Number.isInteger(result)).toBe(true);
    }
  });
});

describe('handleStop', () => {
  it('clears the session route and pushes reply message ID', async () => {
    const messageIds: number[] = [];
    const mockCtx = {
      session: {
        route: 'some-route'
      },
      reply: jest.fn().mockResolvedValue({ message_id: 12345 })
    } as unknown as MyContext;

    await helpers.handleStop(mockCtx, messageIds);

    expect(mockCtx.session.route).toBe('');
    expect(mockCtx.reply).toHaveBeenCalledWith(`<b>Request stopped!</b> 🤖\nClick the menu button below to explore all features 📚.`, {
      parse_mode: 'HTML'
    });
    expect(messageIds).toContain(12345);
  });
});

// I need to re-write this function.

// describe('getNextQuarterMonth', () => {
//   let mockCtx: MyContext;
//   let messageIds: number[];

//   beforeEach(() => {
//     jest.clearAllMocks();
//     jest.resetAllMocks();
//     messageIds = [];
//     mockCtx = {
//       reply: jest.fn().mockResolvedValue({ message_id: 777 })
//     } as unknown as MyContext;
//   });

//   it('should log and return when no quarter data is found', async () => {
//     (Quarters.findOne as jest.Mock).mockReturnValue({
//       limit: () => ({
//         sort: () => Promise.resolve(null)
//       })
//     });

//     const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

//     await getNextQuarterMonth(mockCtx, messageIds);

//     expect(Quarters.findOne).toHaveBeenCalled();
//     expect(consoleSpy).toHaveBeenCalledWith('No quarter data found.');
//     expect(mockCtx.reply).not.toHaveBeenCalled();
//     expect(messageIds).toHaveLength(0);

//     consoleSpy.mockRestore();
//   });

//   it('should calculate next start month and reply with correct message', async () => {
//     let year = new Date().getFullYear();
//     (Quarters.findOne as jest.Mock)
//       .mockReturnValueOnce({
//         limit: () => ({
//           sort: () => Promise.resolve({ quarter: 1, year })
//         })
//       })
//       .mockReturnValueOnce({
//         limit: () => ({
//           sort: () => Promise.resolve({ quarter: 2, year })
//         })
//       })
//       .mockReturnValueOnce({
//         limit: () => ({
//           sort: () => Promise.resolve({ quarter: 1, year: 2024 })
//         })
//       });

//     const getFullYearSpy = jest.spyOn(global.Date.prototype, 'getFullYear').mockReturnValue(2025);
//     const getFullMonthSpy = jest.spyOn(global.Date.prototype, 'getMonth').mockReturnValueOnce(2).mockReturnValueOnce(4).mockReturnValueOnce(4);

//     await getNextQuarterMonth(mockCtx, messageIds);
//     await getNextQuarterMonth(mockCtx, messageIds);
//     await getNextQuarterMonth(mockCtx, messageIds);

//     expect(mockCtx.reply).toHaveBeenNthCalledWith(1, `<b>Note</b>❗\n\nIf this request is approved it will take place from <b>April</b> ${year}.`, {
//       parse_mode: 'HTML'
//     });
//     expect(mockCtx.reply).toHaveBeenNthCalledWith(2, `<b>Note</b>❗\n\nIf this request is approved it will take place from <b>July</b> ${year}.`, {
//       parse_mode: 'HTML'
//     });
//     expect(mockCtx.reply).toHaveBeenNthCalledWith(3, `<b>Note</b>❗\n\nIf this request is approved it will take place from <b>July</b> ${year}.`, {
//       parse_mode: 'HTML'
//     });
//     expect(messageIds).toContain(777);
//     getFullYearSpy.mockRestore();
//     getFullMonthSpy.mockRestore();
//   });

//   it('should increment year when quarter is 4', async () => {
//     let year = new Date().getFullYear();

//     (Quarters.findOne as jest.Mock)
//       .mockReturnValueOnce({
//         limit: () => ({
//           sort: () => Promise.resolve({ quarter: 4, year: 2024 })
//         })
//       })
//       .mockReturnValueOnce({
//         limit: () => ({
//           sort: () => Promise.resolve({ quarter: 4, year: 2023 })
//         })
//       })
//       .mockReturnValueOnce({
//         limit: () => ({
//           sort: () => Promise.resolve({ quarter: 4, year: 2024 })
//         })
//       });

//     jest.spyOn(global.Date.prototype, 'getFullYear').mockReturnValueOnce(2025).mockReturnValueOnce(2025).mockReturnValueOnce(2024);

//     await getNextQuarterMonth(mockCtx, messageIds);
//     await getNextQuarterMonth(mockCtx, messageIds);
//     await getNextQuarterMonth(mockCtx, messageIds);

//     expect(mockCtx.reply).toHaveBeenNthCalledWith(1, `<b>Note</b>❗\n\nIf this request is approved it will take place from <b>July</b> 2025.`, {
//       parse_mode: 'HTML'
//     });
//     expect(mockCtx.reply).toHaveBeenNthCalledWith(2, `<b>Note</b>❗\n\nIf this request is approved it will take place from <b>July</b> 2025.`, {
//       parse_mode: 'HTML'
//     });
//     expect(mockCtx.reply).toHaveBeenNthCalledWith(3, `<b>Note</b>❗\n\nIf this request is approved it will take place from <b>January</b> 2025.`, {
//       parse_mode: 'HTML'
//     });
//     expect(messageIds).toContain(777);
//   });
// });

describe('formatNumber', () => {
  it('should format integer correctly', () => {
    expect(numberUtils.formatNumber(1000)).toBe('₦1,000.00');
  });

  it('should format float correctly', () => {
    expect(numberUtils.formatNumber(1234.5)).toBe('₦1,234.50');
  });

  it('should round down to two decimal places', () => {
    expect(numberUtils.formatNumber(999.999)).toBe('₦1,000.00');
  });

  it('should round up to two decimal places', () => {
    expect(numberUtils.formatNumber(999.994)).toBe('₦999.99');
  });

  it('should handle zero', () => {
    expect(numberUtils.formatNumber(0)).toBe('₦0.00');
  });

  it('should handle negative numbers', () => {
    expect(numberUtils.formatNumber(-2500)).toBe('-₦2,500.00');
  });

  it('should handle very large numbers', () => {
    expect(numberUtils.formatNumber(1000000000.12)).toBe('₦1,000,000,000.12');
  });
});

describe('calcROIWithCommissions', () => {
  let getRandomIntSpy: jest.SpyInstance;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    getRandomIntSpy = jest.spyOn(numberUtils, 'getRandomInt');
  });

  afterEach(() => {
    jest.clearAllMocks();
    getRandomIntSpy.mockRestore();
  });

  it('should correctly calculate finalAmount, managementFee, and newROI with 25% fee', () => {
    getRandomIntSpy.mockReturnValue(25);

    const result = utils.calcROIWithCommissions('john_doe', 100, 1000);

    expect(getRandomIntSpy).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    expect(result).toEqual({
      finalAmount: 1750,
      managementFee: 250,
      newROI: 75
    });
  });

  it('should correctly calculate with a 30% fee', () => {
    getRandomIntSpy.mockReturnValue(30);

    const result = utils.calcROIWithCommissions('jane_doe', 50, 2000);

    expect(getRandomIntSpy).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    expect(result).toEqual({
      finalAmount: 2700,
      managementFee: 300,
      newROI: 35
    });
  });

  it('should correctly calculate with a Decimal Return', () => {
    getRandomIntSpy.mockReturnValue(28);

    const result = utils.calcROIWithCommissions('jane_doe', 108.75, 2000);

    expect(getRandomIntSpy).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    expect(result).toEqual({
      finalAmount: 3566,
      managementFee: 609,
      newROI: 78.3
    });
  });

  it('should return 0 values when percentageGrowth is 0', () => {
    getRandomIntSpy.mockReturnValue(0);

    const result = utils.calcROIWithCommissions('zero_case', 0, 1500);

    expect(getRandomIntSpy).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    expect(result).toEqual({
      finalAmount: 1500,
      managementFee: 0,
      newROI: 0
    });
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });
});

describe('calcROIWithoutCommissions', () => {
  it('should return correct final amount for positive growth', () => {
    const result = utils.calcROIWithoutCommissions(50, 1000);
    expect(result).toBe(1500);
  });

  it('should return correct final amount for zero growth', () => {
    const result = utils.calcROIWithoutCommissions(0, 2000);
    expect(result).toBe(2000);
  });

  it('should return correct final amount for negative growth', () => {
    const result = utils.calcROIWithoutCommissions(-25, 800);
    expect(result).toBe(600);
  });

  it('should return a number rounded to 2 decimal places', () => {
    const result = utils.calcROIWithoutCommissions(33.333, 999.99);
    expect(result).toBeCloseTo(1333.32, 2);
  });

  it('should return 0 if initialAmount is 0 regardless of growth', () => {
    expect(utils.calcROIWithoutCommissions(100, 0)).toBe(0);
    expect(utils.calcROIWithoutCommissions(-100, 0)).toBe(0);
  });
});

describe('messageAdmins', () => {
  let messageSpy: jest.SpyInstance;
  let trackSpy: jest.SpyInstance;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    messageSpy = jest.spyOn(bot.api, 'sendMessage');
    trackSpy = jest.spyOn(helpers, 'trackMessage');
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    messageSpy.mockRestore();
    trackSpy.mockRestore();
  });

  it('should send the message to both admins and track the message IDs', async () => {
    const message = 'Test message';
    messageSpy
      .mockImplementationOnce(() => Promise.resolve({ message_id: 12345 }))
      .mockImplementationOnce(() => Promise.resolve({ message_id: 12346 }));

    await utils.messageAdmins(message);

    expect(messageSpy).toHaveBeenCalledTimes(2);
    expect(messageSpy).toHaveBeenNthCalledWith(1, settings.adminIds.chatId1, message);
    expect(messageSpy).toHaveBeenNthCalledWith(2, settings.adminIds.chatId2, message);

    expect(trackSpy).toHaveBeenCalledTimes(2);
    expect(trackSpy).toHaveBeenNthCalledWith(1, Number(settings.adminIds.chatId1), [12345]);
    expect(trackSpy).toHaveBeenNthCalledWith(2, Number(settings.adminIds.chatId2), [12346]);
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });
});

describe('calcForHighRisk', () => {
  let messageSpy: jest.SpyInstance;
  let trackSpy: jest.SpyInstance;
  let consoleSpy: jest.SpyInstance;
  let commisionSpy: jest.SpyInstance;
  let noCommisionSpy: jest.SpyInstance;

  let messageAdminSpy: jest.SpyInstance;
  const mockCtx = {
    session: {
      route: 'some-route',
      commissions: true,
      quarter: 2,
      year: 2025,
      roi: 50
    },
    reply: jest.fn().mockResolvedValue({ message_id: 12345 })
  } as unknown as MyContext;

  const mockUser = {
    _id: 'user123',
    username: 'testuser',
    chat_id: 111
  };

  const mockClient = {
    _id: 'account123',
    user_id: 'user123',
    current_balance: 1000,
    initial_balance: 500,
    save: jest.fn()
  };

  const mockQuarter = {
    ending_capital: 1150,
    year: 2025,
    quarter: 2,
    starting_capital: 1000,
    roi: 0.15,
    commission: true,
    account_id: 'account123',
    user_id: 'user123',
    _id: 'quarter123'
  };

  const mockBuffer = [{ amount: 0, amount_allocated: 0, save: jest.fn() }];

  beforeEach(() => {
    messageAdminSpy = jest.spyOn(utils, 'messageAdmins');
    messageSpy = jest.spyOn(bot.api, 'sendMessage');
    trackSpy = jest.spyOn(helpers, 'trackMessage');
    commisionSpy = jest.spyOn(utils, 'calcROIWithCommissions');
    noCommisionSpy = jest.spyOn(utils, 'calcROIWithoutCommissions');
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should process successfully when there are no high-risk clients', async () => {
    messageAdminSpy.mockImplementation(() => Promise.resolve());
    jest.spyOn(HighRiskAccounts, 'find').mockResolvedValue([]);

    await helpers.calcForHighRisk(mockCtx);

    expect(messageAdminSpy).toHaveBeenCalledTimes(3);
  });

  it('should process a client with balance > 0 and commissions = true', async () => {
    const modifiedClient = { ...mockClient };

    messageAdminSpy.mockImplementation(() => Promise.resolve());
    jest.spyOn(HighRiskAccounts, 'find').mockResolvedValue([modifiedClient]);
    jest.spyOn(Users, 'findOne').mockResolvedValue(mockUser);
    jest.spyOn(Quarters, 'create').mockResolvedValue(mockQuarter as any);
    jest.spyOn(HinBuffer, 'find').mockResolvedValue(mockBuffer);
    messageSpy.mockImplementationOnce(() => Promise.resolve({ message_id: 12345 }));

    await helpers.calcForHighRisk(mockCtx);

    expect(messageAdminSpy).toHaveBeenCalledTimes(4);
    expect(messageSpy).toHaveBeenCalled();
    expect(trackSpy).toHaveBeenCalled();
    expect(HighRiskAccounts.find).toHaveBeenCalledTimes(1);
    expect(Users.findOne).toHaveBeenCalledTimes(1);
    expect(Quarters.create).toHaveBeenCalledTimes(1);
    expect(HinBuffer.find).toHaveBeenCalledTimes(1);
    expect(noCommisionSpy).not.toHaveBeenCalled();
    expect(commisionSpy).toHaveBeenCalledWith(mockUser.username, mockCtx.session.roi, 1000);
    expect(mockClient.save).toHaveBeenCalledTimes(1);
    expect(mockBuffer[0].save).toHaveBeenCalledTimes(1);
    expect(mockBuffer[0].amount).toBeGreaterThan(0);
    expect(mockBuffer[0].amount_allocated).toBe(0);
  });

  it('should process a client with balance > 0 and commissions = false', async () => {
    const modifiedCtx = {
      ...mockCtx,
      session: {
        ...mockCtx.session,
        commissions: false
      }
    } as unknown as MyContext;

    messageAdminSpy.mockImplementation(() => Promise.resolve());
    jest.spyOn(HighRiskAccounts, 'find').mockResolvedValue([mockClient]);
    jest.spyOn(Users, 'findOne').mockResolvedValue(mockUser);
    jest.spyOn(Quarters, 'create').mockResolvedValue(mockQuarter as any);
    jest.spyOn(HinBuffer, 'find').mockResolvedValue(mockBuffer);
    messageSpy.mockImplementationOnce(() => Promise.resolve({ message_id: 12345 }));

    await helpers.calcForHighRisk(modifiedCtx);

    expect(messageAdminSpy).toHaveBeenCalledTimes(3);
    expect(messageSpy).toHaveBeenCalled();
    expect(trackSpy).toHaveBeenCalled();
    expect(HighRiskAccounts.find).toHaveBeenCalledTimes(1);
    expect(Users.findOne).toHaveBeenCalledTimes(1);
    expect(Quarters.create).toHaveBeenCalledTimes(1);
    expect(HinBuffer.find).not.toHaveBeenCalledTimes(1);
    expect(commisionSpy).not.toHaveBeenCalled();
    expect(noCommisionSpy).toHaveBeenCalledWith(mockCtx.session.roi, 1000);
    expect(mockClient.save).toHaveBeenCalledTimes(1);
    expect(mockBuffer[0].save).not.toHaveBeenCalled();
  });

  // it('should process clients with commissions and update records correctly', async () => {
  //   const message = 'Test message';
  //   messageSpy
  //     .mockImplementationOnce(() => Promise.resolve({ message_id: 12345 }))
  //     .mockImplementationOnce(() => Promise.resolve({ message_id: 12346 }));

  //   await helpers.messageAdmins(message);

  //   expect(messageSpy).toHaveBeenCalledTimes(2);
  //   expect(messageSpy).toHaveBeenNthCalledWith(1, settings.adminIds.chatId1, message);
  //   expect(messageSpy).toHaveBeenNthCalledWith(2, settings.adminIds.chatId2, message);

  //   expect(trackSpy).toHaveBeenCalledTimes(2);
  //   expect(trackSpy).toHaveBeenNthCalledWith(1, Number(settings.adminIds.chatId1), [12345]);
  //   expect(trackSpy).toHaveBeenNthCalledWith(2, Number(settings.adminIds.chatId2), [12346]);

  //   messageAdminSpy.mockImplementation(() => Promise.resolve());
  //   jest.spyOn(HighRiskAccounts, 'find').mockResolvedValue([mockClient]);
  //   jest.spyOn(Users, 'findOne').mockResolvedValue(mockUser);

  //   await helpers.calcForHighRisk(mockCtx);

  //   expect(messageAdminSpy).toHaveBeenCalledTimes(3);
  // });

  afterAll(() => {
    consoleSpy.mockRestore();
  });
});
