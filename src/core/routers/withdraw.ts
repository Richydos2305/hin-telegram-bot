import { Router } from '@grammyjs/router';
import { formatNumber, MyContext, trackMessage } from '../helpers';
import { settings } from '../config/application';
import { TransactionType } from '../interfaces';
import { Accounts } from '../models/accounts';
import { Transactions } from '../models/transactions';
import { bot } from '../..';

const router = new Router<MyContext>((ctx) => ctx.session.route);
const messageIds: number[] = [];

router.route('withdrawalRequestInProgress', async (ctx) => {
  const { message } = ctx;
  const { userData } = ctx.session;
  const userId = message?.chat.id;
  messageIds.push(message?.message_id as number);

  if (message) {
    const amount = message.text;
    if (amount && !isNaN(Number(amount))) {
      const account = await Accounts.findOne({ user_id: userData._id });
      if (account && Number(amount) <= account.current_balance) {
        await Transactions.create({
          user_id: userData._id,
          account_id: account._id,
          type: TransactionType.WITHDRAWAL,
          amount: Number(amount)
        });
        let reply = await ctx.reply(`Okay. Richard or Tolu will reach out to you soon.`);
        messageIds.push(reply.message_id);

        reply = await bot.api.sendMessage(
          settings.adminIds.chatId1,
          `${userData.username} just made a withdrawal request of ${formatNumber(Number(amount))}.
        Kindly log in as an admin to confirm this.`
        );
        trackMessage(Number(settings.adminIds.chatId1), [reply.message_id]);

        reply = await bot.api.sendMessage(
          settings.adminIds.chatId2,
          `${userData.username} just made a withdrawal request of ${formatNumber(Number(amount))}.
        Kindly log in as an admin to confirm this.`
        );
        trackMessage(Number(settings.adminIds.chatId2), [reply.message_id]);
        ctx.session.route = '';
      } else {
        const reply = await ctx.reply(`**Insufficient Funds** 🚫\n\nYou don't have enough balance to complete this transaction.`);
        messageIds.push(reply.message_id);
      }
    } else {
      const reply = await ctx.reply('**Invalid Amount** 📝\n\nPlease enter a valid amount to proceed.');
      messageIds.push(reply.message_id);
    }
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
});

export { router };
