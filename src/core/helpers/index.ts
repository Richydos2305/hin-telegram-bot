import { Response } from 'express';
import { settings } from '../config/application';
import { sign, verify } from 'jsonwebtoken';
import { Users } from '../models/users';
import { Types } from 'mongoose';
import { SessionFlavor, Context } from 'grammy';
import { HighRiskAccounts } from '../models/highRiskAccounts';
import { Quarters } from '../models/quarters';
import { bot, messageStore } from '../..';
import { FileType, QuarterBeginningMonths, quarterMap, quarterStartMonths, TransactionStatus, TransactionType, UserPlan } from '../interfaces';
import { Transactions } from '../models/transactions';
import { LowRiskAccounts } from '../models/lowRiskAccounts';
import { MediumRiskAccounts } from '../models/mediumRiskAccounts';

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
  userPlan: string | null;
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
    transactionHistory: [],
    userPlan: null
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
      const account = await HighRiskAccounts.findOne({ user_id: user._id });
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

export async function confirmDeposit(ctx: MyContext, messageIds: number[], userData: any, message: any): Promise<void> {
  
  if (message) {
    let receipt: { file: string; type: FileType } | null = null;
    if (message.photo) {
      receipt = {
        file: message.photo[0].file_id,
        type: FileType.PHOTO
      };
    } else if (message.document) {
      receipt = {
        file: message.document.file_id,
        type: FileType.DOCUMENT
      };
    }
    if (receipt) {
      let account;
      if (ctx.session.userPlan === UserPlan.HIGH_RISK) {
        account = await HighRiskAccounts.findOne({ user_id: userData._id });
      } else if (ctx.session.userPlan === UserPlan.MEDIUM_RISK) {
        account = await MediumRiskAccounts.findOne({ user_id: userData._id });
        //Yet to create a function that will check the date of the last deposit and compare it with the current date to see the lenght if we have not taken our first trade yet then the new money should be added into the account else another meduim risk account will be created.
        if (!account) {
          account = await MediumRiskAccounts.create({ user_id: userData._id });
        }
      } else if (ctx.session.userPlan === UserPlan.LOW_RISK) {
        account = await LowRiskAccounts.findOne({ user_id: userData._id });
        if (!account) {
          account = await LowRiskAccounts.create({ user_id: userData._id });
        }
      }
      if (account) {
        const transactionRecord = await Transactions.create({
          user_id: userData._id,
          account_id: account._id,
          type: TransactionType.DEPOSIT,
          amount: ctx.session.amount,
          plan: ctx.session.userPlan,
          receipt
        });
        if (transactionRecord) {
          console.log("Transaction record found");
          ctx.session.route = '';
          let reply = await ctx.reply(
            `<b>Deposit Request!</b> 📈\n\nYour deposit request has been successfully processed.\nPlease allow 1-2 business days for the funds to reflect in your account. 🕒`,
            { parse_mode: 'HTML' }
          );
          messageIds.push(reply.message_id);

          reply = await bot.api.sendMessage(
            settings.adminIds.chatId1,
            `${userData.first_name} just made a deposit request of ${formatNumber(ctx.session.amount)} in the ${ctx.session.userPlan}. \nKindly log in as an admin to confirm this.`
          );
          trackMessage(Number(settings.adminIds.chatId1), [reply.message_id]);

          reply = await bot.api.sendMessage(
            settings.adminIds.chatId2,
            `${userData.first_name} just made a deposit request of ${formatNumber(ctx.session.amount)} in the ${ctx.session.userPlan}. \nKindly log in as an admin to confirm this.`
          );
          trackMessage(Number(settings.adminIds.chatId2), [reply.message_id]);
          ctx.session.amount = 0;
        }
      }
    } else if (message.text === '/stop') {
      await handleStop(ctx, messageIds);
    } else {
      const reply = await ctx.reply(`**Invalid Receipt** 🚫\n\nPlease send a valid receipt to proceed.`);
      messageIds.push(reply.message_id);
    }
  }
}


export async function checkSubscribedPlans(ctx: MyContext, userData: any): Promise<void> {
  
  const highRiskAccount = await HighRiskAccounts.findOne({ user_id: userData._id });
  const mediumRiskAccount = await MediumRiskAccounts.findOne({ user_id: userData._id });
  const lowRiskAccount = await LowRiskAccounts.findOne({ user_id: userData._id });

  const keyboard: any[] = [];
  if (highRiskAccount) {
    keyboard.push([{ text: 'HIGH RISK', callback_data: 'high_risk_withdrawal' }]);
  }
  if (mediumRiskAccount) {
    keyboard.push([{ text: 'MEDIUM RISK', callback_data: 'medium_risk_withdrawal' }]);
  }
  if (lowRiskAccount) {
    keyboard.push([{ text: 'LOW RISK', callback_data: 'low_risk_withdrawal' }]);
  }
  if (keyboard.length > 0) {
    keyboard.push([{ text: 'CANCEL', callback_data: 'cancel' }]);
    const reply = await ctx.reply('Choose plan to withdraw from: ', {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
    messageIds.push(reply.message_id);
    ctx.session.route = '';
  } else {
    const reply = await ctx.reply('You do not have an account in any plan.');
    messageIds.push(reply.message_id);
    await handleStop(ctx, messageIds);
  }
}

export async function confirmWithdrawal(ctx: MyContext, messageIds: number[], userData: any, message: any): Promise<void> {
 
  if (message) {
      const amount = message.text;
      if (amount && !isNaN(Number(amount))) {
        if (Number(amount) < 10000) {
          const reply = await ctx.reply(`<b>Invalid Amount</b> 📝\n\nMinimum withdrawal amount is  ₦10,000.`, { parse_mode: 'HTML' });
          messageIds.push(reply.message_id);
        } else {
          let account: any;
          if (ctx.session.userPlan === UserPlan.HIGH_RISK) {
            account = await HighRiskAccounts.findOne({ user_id: userData._id });
          } else if (ctx.session.userPlan === UserPlan.MEDIUM_RISK) {
            account = await MediumRiskAccounts.findOne({ user_id: userData._id });
            if (await daysLeftInPlan(ctx, account?.start_date)) {
              return;
            }
          } else if (ctx.session.userPlan === UserPlan.LOW_RISK) {
            account = await LowRiskAccounts.findOne({ user_id: userData._id });
            if (await daysLeftInPlan(ctx, account?.start_date)) {
              return;
            }
          }
          if (account && Number(amount) <= account.current_balance) {
            await Transactions.create({
              user_id: userData._id,
              account_id: account._id,
              type: TransactionType.WITHDRAWAL,
              amount: Number(amount)
            });
            ctx.session.route = '';
            let reply = await ctx.reply(`Okay. Richard or Tolu will reach out to you soon.`);
            messageIds.push(reply.message_id);
  
            reply = await bot.api.sendMessage(
              settings.adminIds.chatId1,
              `${userData.first_name} just made a withdrawal request of ${formatNumber(Number(amount))}. \nKindly log in as an admin to confirm this.`
            );
            trackMessage(Number(settings.adminIds.chatId1), [reply.message_id]);
  
            reply = await bot.api.sendMessage(
              settings.adminIds.chatId2,
              `${userData.first_name} just made a withdrawal request of ${formatNumber(Number(amount))}. \nKindly log in as an admin to confirm this.`
            );
            trackMessage(Number(settings.adminIds.chatId2), [reply.message_id]);
          } else {
            const reply = await ctx.reply(`<b>Insufficient Funds</b> 🚫\n\nYou don't have enough balance to complete this transaction.`, {
              parse_mode: 'HTML'
            });
            messageIds.push(reply.message_id);
          }
        }
      } else if (message.text === '/stop') {
        await handleStop(ctx, messageIds);
      } else {
        const reply = await ctx.reply('<b>Invalid Amount</b> 📝\n\nPlease enter a valid amount to proceed.', { parse_mode: 'HTML' });
        messageIds.push(reply.message_id);
      }
    }
}


export async function promptWithdrawalAmount(ctx: MyContext, messageIds: number[]): Promise<void> {
  const reply = await ctx.reply('<b>Withdrawal Amount</b> 💸\n\nPlease enter the amount you want to withdraw in ₦ (Naira)', { parse_mode: 'HTML' });
  messageIds.push(reply.message_id);
}

const daysLeftInPlan = async (ctx: MyContext, startDate: Date) => {
  const currentDate = new Date();
  const difference = currentDate.getTime() - startDate.getTime();
  const yearInMilliseconds = 31536000000;
  if (difference < yearInMilliseconds) {
    const remainingDays = Math.ceil((yearInMilliseconds - difference) / 86400000);
    const reply = await ctx.reply(`You have ${remainingDays} days left to withdraw from this plan. \n\nConsider withdrawing from another plan or wait for the remaining days to expire.`, { parse_mode: 'HTML' });
    messageIds.push(reply.message_id);
    await handleStop(ctx, messageIds);
    return true;
  }
  return false;
};