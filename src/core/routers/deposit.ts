import { Router } from '@grammyjs/router';
import { formatNumber, MyContext, trackMessage } from '../helpers';
import { settings } from '../config/application';
import { FileType, TransactionType } from '../interfaces';
import { Accounts } from '../models/accounts';
import { Transactions } from '../models/transactions';
import { bot } from '../..';

const router = new Router<MyContext>((ctx) => ctx.session.route);
const messageIds: number[] = [];

router.route('depositRequestInProgress', async (ctx) => {
  const { message } = ctx;
  const userId = message?.chat.id;
  messageIds.push(message?.message_id as number);

  if (message) {
    const amount = message.text;
    if (amount && !isNaN(Number(amount))) {
      const reply = await ctx.reply(
        `<b>Confirm Deposit</b> 💸\n\nPlease make a transfer of ${formatNumber(Number(amount))} to the following account: \n0021919337 - Access Bank - Richard Dosunmu.\n\nAttach the receipt as your response to this message. 📝`,
        { parse_mode: 'HTML' }
      );
      messageIds.push(reply.message_id);
      ctx.session.route = 'depositRequestConfirmation';
      ctx.session.amount = Number(amount);
    } else {
      const reply = await ctx.reply('**Invalid Amount** 📝\n\nPlease enter a valid amount to proceed.');
      messageIds.push(reply.message_id);
    }
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
});

router.route('depositRequestConfirmation', async (ctx) => {
  const { message } = ctx;
  const { userData } = ctx.session;
  const userId = message?.chat.id;
  messageIds.push(message?.message_id as number);

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
      const account = await Accounts.findOne({ user_id: userData._id });
      if (account) {
        const transactionRecord = await Transactions.create({
          user_id: userData._id,
          account_id: account._id,
          type: TransactionType.DEPOSIT,
          amount: ctx.session.amount,
          receipt
        });
        if (transactionRecord) {
          let reply = await ctx.reply(
            `<b>Deposit Request!</b> 📈\n\nYour deposit request has been successfully processed.\nPlease allow 1-2 business days for the funds to reflect in your account. 🕒`,
            { parse_mode: 'HTML' }
          );
          messageIds.push(reply.message_id);

          reply = await bot.api.sendMessage(
            settings.adminIds.chatId1,
            `${userData.username} just made a deposit request of ${formatNumber(ctx.session.amount)}.
            Kindly log in as an admin to confirm this.`
          );
          trackMessage(Number(settings.adminIds.chatId1), [reply.message_id]);

          reply = await bot.api.sendMessage(
            settings.adminIds.chatId2,
            `${userData.username} just made a deposit request of ${formatNumber(ctx.session.amount)}.
            Kindly log in as an admin to confirm this.`
          );
          trackMessage(Number(settings.adminIds.chatId2), [reply.message_id]);
          ctx.session.route = '';
          ctx.session.amount = 0;
        }
      }
    } else {
      const reply = await ctx.reply(`**Invalid Receipt** 🚫\n\nPlease send a valid receipt to proceed.`);
      messageIds.push(reply.message_id);
    }
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
});

export { router };
