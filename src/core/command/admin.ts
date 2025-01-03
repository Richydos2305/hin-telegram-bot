import { CommandContext } from 'grammy';
import { MyContext } from '../helpers';
import { Admins } from '../models/admins';

export const handleAdmin = async (ctx: CommandContext<MyContext>): Promise<void> => {
  const admin = await Admins.findOne({ username: ctx.message?.from.first_name });
  if (admin) {
    console.log(ctx.message?.chat.id);

    await ctx.reply('**Enter Password 🔒**\n\nPlease type your password to proceed...', { parse_mode: 'Markdown' });
    ctx.session.state = 'adminLoginInProgress';
  } else {
    await ctx.reply('**Admin Not Found** 🚫\n\nPlease check your credentials and try again.');
  }
};
