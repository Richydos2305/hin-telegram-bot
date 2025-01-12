import { CommandContext } from 'grammy';
import { isLoggedIn, MyContext } from '../helpers';

export const handleDeposit = async (ctx: CommandContext<MyContext>): Promise<void> => {
  if (isLoggedIn(ctx.session.token)) {
    await ctx.reply('Input amount to deposit in ₦ (Naira)');
    ctx.session.route = 'depositRequestInProgress';
  } else {
    await ctx.reply('**Login Required** 🔒\n\nUse /login to access this feature.');
  }
};
