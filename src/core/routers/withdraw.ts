import { Router } from '@grammyjs/router';
import { formatNumber, handleStop, MyContext, trackMessage } from '../helpers';
import { settings } from '../config/application';
import { TransactionType } from '../interfaces';
import { Accounts } from '../models/accounts';
import { Transactions } from '../models/transactions';
import { bot } from '../../bot';

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
      if (Number(amount) < 10000) {
        const reply = await ctx.reply(`<b>Invalid Amount</b> 📝\n\nMinimum withdrawal amount is  ₦10,000.`, { parse_mode: 'HTML' });
        messageIds.push(reply.message_id);
      } else {
        const account = await Accounts.findOne({ user_id: userData._id });
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
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
});

export { router };
