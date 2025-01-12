import { CommandContext } from 'grammy';
import { isLoggedIn, MyContext } from '../helpers';

export const handleWithdrawal = async (ctx: CommandContext<MyContext>): Promise<void> => {
  if (isLoggedIn(ctx.session.token)) {
    await ctx.reply('**Withdrawal Amount** 💸\n\nPlease enter the amount you want to withdraw in ₦ (Naira)');
    ctx.session.route = 'withdrawalRequestInProgress';
  } else {
    await ctx.reply('User does not exist.🚫\n\n Please /login to perform this action');
  }
};
