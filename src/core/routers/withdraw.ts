import { Router } from '@grammyjs/router';
import { formatNumber, MyContext } from '../helpers';
import { settings } from '../config/application';
import { TransactionType } from '../interfaces';
import { Accounts } from '../models/accounts';
import { Transactions } from '../models/transactions';
import { bot } from '../..';

const router = new Router<MyContext>((ctx) => ctx.session.route);

router.route('withdrawalRequestInProgress', async (ctx) => {
  const { message } = ctx;
  const { userData } = ctx.session;
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
        await ctx.reply(`Okay. Richard or Tolu will reach out to you soon.`);
        await bot.api.sendMessage(
          settings.adminChatId,
          `${userData.username} just made a withdrawal request of ${formatNumber(Number(amount))}.
        Kindly log in as an admin to confirm this.`
        );
        ctx.session.route = '';
      } else {
        await ctx.reply(`**Insufficient Funds** 🚫\n\nYou don't have enough balance to complete this transaction.`);
      }
    } else {
      await ctx.reply('**Invalid Amount** 📝\n\nPlease enter a valid amount to proceed.');
    }
  }
});

export { router };
