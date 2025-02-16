import { CommandContext } from 'grammy';
import { MyContext, trackMessage } from '../helpers';
import { Users } from '../models/users';

const messageIds: number[] = [];

export const handleLogin = async (ctx: CommandContext<MyContext>): Promise<void> => {
  const user = await Users.findOne({ telegram_id: ctx.message?.from.id });

  const userId = ctx.message?.chat.id;
  messageIds.push(ctx.message?.message_id as number);

  if (user) {
    const reply = await ctx.reply(user.security_q);
    messageIds.push(reply.message_id);
    ctx.session.route = 'loginInProgress';
    ctx.session.userData = user;
  } else {
    const reply = await ctx.reply('**User does not exist** 🚫\n\n Try /register instead.');
    messageIds.push(reply.message_id);
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
};
