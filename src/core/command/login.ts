import { CommandContext } from 'grammy';
import { MyContext } from '../helpers';
import { Users } from '../models/users';

export const handleLogin = async (ctx: CommandContext<MyContext>): Promise<void> => {
  const user = await Users.findOne({ telegram_id: ctx.message?.from.id });
  if (user) {
    await ctx.reply(user.security_q);
    ctx.session.route = 'loginInProgress';
    ctx.session.userData = user;
  } else {
    await ctx.reply('**User does not exist** 🚫\n\n Try /register instead.');
  }
};
