import { CommandContext } from 'grammy';
import { MyContext } from '../helpers';

export const handleDeposit = async (ctx: CommandContext<MyContext>): Promise<void> => {
  if (ctx.session.loggedIn) {
    await ctx.reply('Input amount to deposit in ₦ (Naira)');
    ctx.session.state = 'depositRequestInProgress';
  } else {
    await ctx.reply('**Login Required** 🔒\n\nUse /login to access this feature.');
  }
};
