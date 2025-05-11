import { bot } from '../../bot';
import { settings } from '../config/application';
import { trackMessage } from './helpers';
import { formatNumber, getRandomInt } from './numberUtils';

export async function messageAdmins(message: string): Promise<void> {
  let reply = await bot.api.sendMessage(settings.adminIds.chatId1, message);
  trackMessage(Number(settings.adminIds.chatId1), [reply.message_id]);

  reply = await bot.api.sendMessage(settings.adminIds.chatId2, message);
  trackMessage(Number(settings.adminIds.chatId2), [reply.message_id]);
}

export function calcROIWithoutCommissions(percentageGrowth: number, initialAmount: number): number {
  const finalAmount: number = parseFloat(((percentageGrowth / 100) * initialAmount + initialAmount).toFixed(2));
  return finalAmount;
}

export function calcROIWithCommissions(
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
