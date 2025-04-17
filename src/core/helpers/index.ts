import { Response } from 'express';
import { settings } from '../config/application';
import { sign, verify } from 'jsonwebtoken';
import { Users } from '../models/users';
import { Types } from 'mongoose';
import { SessionFlavor, Context } from 'grammy';
import { Accounts } from '../models/accounts';
import { Quarters } from '../models/quarters';
import { bot, messageStore } from '../../bot';
import { QuarterBeginningMonths, quarterMap, quarterStartMonths } from '../interfaces';

const messageIds: number[] = [];

export function handleError(res: Response, statusCode: number, message: string): void {
  res.status(statusCode).send({ message });
}

export const trackMessage = (userId: number, messageIds: number[]): void => {
  if (!messageStore.has(userId)) {
    messageStore.set(userId, []);
    console.log(`New user with ID: ${userId}`);
  }
  for (const messageId of messageIds) {
    messageStore.get(userId)?.push(messageId);
  }
};

export const deleteChatHistory = async (): Promise<void> => {
  console.log(messageStore);

  for (const [userId, messageIds] of messageStore.entries()) {
    for (const messageId of messageIds) {
      try {
        await bot.api.deleteMessage(userId, messageId);
      } catch (error) {
        console.error(`Failed to delete message ${messageId} for user ${userId}:`, error);
      }
    }
    messageStore.delete(userId);
  }
  console.log('Messages Cleared');
};

export function getAccessToken(user: { username: string; id: Types.ObjectId }): string {
  const accessToken = sign(
    {
      userDetails: {
        name: user.username,
        id: user.id
      }
    },
    settings.secretKey,
    { expiresIn: '4h' }
  );
  return accessToken;
}

export function isLoggedIn(token: string | null): boolean {
  if (!token) return false;
  try {
    verify(token, settings.secretKey);
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

export async function userExists(loggedInUserId: Types.ObjectId): Promise<boolean> {
  const loggedInUser = await Users.findById(loggedInUserId);
  if (loggedInUser) return true;
  return false;
}

export interface SessionData {
  securityQuestionAsked: boolean;
  securityQuestionAnswered: boolean;
  token: string | null;
  securityQuestion: string | null;
  securityAnswer: string | null;
  userData?: any;
  isAdmin: boolean;
  amount: number;
  transactions: any[];
  transactionRequestInProgress: boolean;
  currentTransaction: any;
  roi: number;
  total_capital: number;
  year: number;
  quarter: number;
  commissions: boolean;
  route: string;
  transactionHistory: any[];
}

export function initial(): SessionData {
  return {
    securityQuestionAsked: false,
    securityQuestionAnswered: false,
    token: null,
    securityQuestion: null,
    securityAnswer: null,
    userData: null,
    isAdmin: false,
    amount: 0,
    transactions: [],
    transactionRequestInProgress: false,
    currentTransaction: null,
    roi: 0,
    total_capital: 0,
    year: 0,
    quarter: 0,
    commissions: true,
    route: '',
    transactionHistory: []
  };
}

export type MyContext = Context & SessionFlavor<SessionData>;

function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const handleStop = async (ctx: MyContext, messageIds: number[]): Promise<void> => {
  ctx.session.route = '';
  const reply = await ctx.reply(`<b>Request stopped!</b> 🤖\nClick the menu button below to explore all features 📚.`, { parse_mode: 'HTML' });
  messageIds.push(reply.message_id);
};

export const getNextQuarterMonth = async (ctx: MyContext, messageIds: number[]): Promise<void> => {
  const lastQuarterEntry = await Quarters.findOne().limit(1).sort({ createdAt: -1 });

  if (!lastQuarterEntry) {
    console.log('No quarter data found.');
    return;
  }

  const { quarter, year } = lastQuarterEntry;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  let nextYear = year;
  let nextStartMonth = '';

  if (quarter === 4) {
    if (currentYear > year) {
      nextStartMonth = QuarterBeginningMonths.Q2;
    } else {
      nextStartMonth = QuarterBeginningMonths.Q1;
    }
    nextYear = year + 1;
  } else {
    nextStartMonth = quarterMap.get(quarter) || QuarterBeginningMonths.Q2;

    const monthNumber = quarterStartMonths.get(nextStartMonth) || 1;

    if (currentMonth >= monthNumber) {
      nextStartMonth =
        {
          April: QuarterBeginningMonths.Q3,
          July: QuarterBeginningMonths.Q4,
          October: QuarterBeginningMonths.Q1
        }[nextStartMonth] || QuarterBeginningMonths.Q2;

      if (nextStartMonth === QuarterBeginningMonths.Q1) {
        nextYear += 1;
      }
    }
  }

  const reply = await ctx.reply(
    `<b>Note</b>❗\n\n If this request is approved it will take place from <b>${nextStartMonth}</b> ${nextYear}.\n\n Use /stop if you don't wish to proceed.`,
    { parse_mode: 'HTML' }
  );

  messageIds.push(reply.message_id);
};

export function formatNumber(amount: number): string {
  const formattedNumber: string = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

  return formattedNumber;
}

export function ROICalcForClient(
  username: string,
  percentageGrowth: number,
  initialAmount: number
): { finalAmount: number; managementFee: number; newROI: number } {
  const overallProfit = parseFloat(((percentageGrowth / 100) * initialAmount).toFixed(2));
  const randomInt = getRandomInt(25, 30);
  const managementFee = parseFloat(((randomInt / 100) * overallProfit).toFixed(2));
  const newProfit = overallProfit - managementFee;
  const newROI = parseFloat(((newProfit / initialAmount) * 100).toFixed(2));
  const finalAmount: number = newProfit + initialAmount;

  console.log(`${username} - Random Int = ${randomInt}%  ROI = ${newROI}%  Management Fee = ${formatNumber(managementFee)}`);

  return { finalAmount, managementFee, newROI };
}

export function ROICalcForAdmin(percentageGrowth: number, initialAmount: number): number {
  const finalAmount: number = parseFloat(((percentageGrowth / 100) * initialAmount + initialAmount).toFixed(2));
  return finalAmount;
}

export const makeAnEntry = async (ctx: any): Promise<void> => {
  try {
    const userId = ctx.message?.chat.id;
    let startingCapital: number;
    let endingCapital: number = 0;
    let managementFee: number = 0;
    let result: number | { finalAmount: number; managementFee: number; newROI: number };

    const users = await Users.find();
    for (const user of users) {
      const account = await Accounts.findOne({ user_id: user._id });
      let roi = ctx.session.roi;
      if (account && account.current_balance > 0) {
        startingCapital = account.current_balance;
        if (ctx.session.commissions === false) {
          result = ROICalcForAdmin(roi, startingCapital);
          endingCapital = result;
        } else if (ctx.session.commissions === true) {
          result = ROICalcForClient(user.username, roi, startingCapital);
          managementFee += result.managementFee;
          roi = result.newROI;
          endingCapital = result.finalAmount;
        }
        const quarterRecord = await Quarters.create({
          user_id: user._id,
          account_id: account._id,
          year: ctx.session.year,
          quarter: ctx.session.quarter,
          roi: parseFloat((roi / 100).toFixed(4)),
          commission: ctx.session.commissions,
          starting_capital: parseFloat(startingCapital.toFixed(2)),
          ending_capital: parseFloat(endingCapital.toFixed(2))
        });

        if (quarterRecord) {
          account.current_balance = quarterRecord.ending_capital;
          await account.save();
          let reply = await ctx.reply(`Successful Entry for ${user.username}`);
          messageIds.push(reply.message_id);
          reply = await bot.api.sendMessage(
            user.chat_id,
            `Quarterly Performance Update for Q${ctx.session.quarter}

A whole 3 months has passed by and we are done for the quarter.
Kindly log in and check the latest results.

Once again, thank you for your patronage.
            `
          );
          trackMessage(Number(user.chat_id), [reply.message_id]);
        }
      }
    }
    let reply = await ctx.reply('Check db to confirm. Done');
    messageIds.push(reply.message_id);
    reply = await bot.api.sendMessage(settings.adminIds.chatId1, `Management Fee for this quarter = ${formatNumber(managementFee)}.`);
    trackMessage(Number(settings.adminIds.chatId1), [reply.message_id]);

    reply = await bot.api.sendMessage(settings.adminIds.chatId2, `Management Fee for this quarter = ${formatNumber(managementFee)}.`);
    trackMessage(Number(settings.adminIds.chatId2), [reply.message_id]);

    if (userId) trackMessage(userId as number, messageIds);
    messageIds.length = 0;
  } catch (error) {
    console.error(error);
  }
};
