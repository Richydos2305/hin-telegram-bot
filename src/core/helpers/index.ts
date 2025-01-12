import { Response } from 'express';
import { settings } from '../config/application';
import { sign, verify } from 'jsonwebtoken';
import { Users } from '../models/users';
import { Types } from 'mongoose';
import { SessionFlavor, Context, CommandContext } from 'grammy';
import { Accounts } from '../models/accounts';
import { Quarters } from '../models/quarters';
import { bot } from '../..';

export function handleError(res: Response, statusCode: number, message: string): void {
  res.status(statusCode).send({ message });
}

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
    route: ''
  };
}

export type MyContext = Context & SessionFlavor<SessionData>;

function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function ROICalcForClient(percentageGrowth: number, initialAmount: number): { finalAmount: number; managementFee: number; newROI: number } {
  const overallProfit = parseFloat(((percentageGrowth / 100) * initialAmount).toFixed(2));
  const randomInt = getRandomInt(25, 30);
  const managementFee = parseFloat(((randomInt / 100) * overallProfit).toFixed(2));
  const newProfit = overallProfit - managementFee;
  const newROI = parseFloat(((newProfit / initialAmount) * 100).toFixed(2));
  const finalAmount: number = newProfit + initialAmount;
  console.log(randomInt, newProfit, newROI, managementFee);

  return { finalAmount, managementFee, newROI };
}

export function ROICalcForAdmin(percentageGrowth: number, initialAmount: number): number {
  const finalAmount: number = parseFloat(((percentageGrowth / 100) * initialAmount + initialAmount).toFixed(2));
  return finalAmount;
}

export function formatNumber(amount: number): string {
  const formattedNumber: string = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

  return formattedNumber;
}

export const makeAnEntry = async (ctx: any): Promise<void> => {
  try {
    let startingCapital: number;
    let endingCapital: number = 0;
    let managementFee: number = 0;
    let result: number | { finalAmount: number; managementFee: number; newROI: number };

    const users = await Users.find();
    for (const user of users) {
      const account = await Accounts.findOne({ user_id: user._id });
      let roi = ctx.session.roi;
      if (account) {
        startingCapital = account.current_balance;
        if (ctx.session.commissions === false) {
          result = ROICalcForAdmin(roi, startingCapital);
          endingCapital = result;
        } else if (ctx.session.commissions === true) {
          result = ROICalcForClient(roi, startingCapital);
          managementFee += result.managementFee;
          roi = result.newROI;
          endingCapital = result.finalAmount;
        }
        const quarterRecord = await Quarters.create({
          user_id: user._id,
          account_id: account._id,
          year: ctx.session.year,
          quarter: ctx.session.quarter,
          roi: roi / 100,
          commission: ctx.session.commissions,
          starting_capital: parseFloat(startingCapital.toFixed(2)),
          ending_capital: parseFloat(endingCapital.toFixed(2))
        });

        if (quarterRecord) {
          console.log(quarterRecord);

          account.current_balance = quarterRecord.ending_capital;
          account.roi = (account.current_balance - account.initial_balance) / account.initial_balance;
          await account.save();

          await ctx.reply(`Successful Entry for ${user.username}`);
          await bot.api.sendMessage(
            user.chat_id,
            `Quarterly Performance Update for Q${ctx.session.quarter}

            A whole 3 months has passed by and we are done for the quarter.
            Kindly log in and check the latest results.

            Once again, thank you for your patronage.
            `
          );
        }
      }
    }
    await ctx.reply('Check db to confirm. Done');
    await bot.api.sendMessage(settings.adminIds.chatId1, `Management Fee for this quarter = ${formatNumber(managementFee)}.`);
    await bot.api.sendMessage(settings.adminIds.chatId2, `Management Fee for this quarter = ${formatNumber(managementFee)}.`);
  } catch (error) {
    console.error(error);
  }
};
