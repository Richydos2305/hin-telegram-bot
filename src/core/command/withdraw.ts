import { CommandContext } from 'grammy';
import { MyContext } from '../helpers';

export const handleWithdrawal = async (ctx: CommandContext<MyContext>): Promise<void> => {
  if (ctx.session.loggedIn) {
    await ctx.reply('**Withdrawal Amount** 💸\n\nPlease enter the amount you want to withdraw in ₦ (Naira)');
    ctx.session.state = 'withdrawalRequestInProgress';
  } else {
    await ctx.reply('User does not exist.🚫\n\n Please /login to perform this action');
  }
};
