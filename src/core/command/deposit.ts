import { CommandContext } from 'grammy';
import { getNextQuarterMonth, isLoggedIn, MyContext, trackMessage } from '../helpers';

const messageIds: number[] = [];

export const handleDeposit = async (ctx: CommandContext<MyContext>): Promise<void> => {
  const userId = ctx.message?.chat.id;
  messageIds.push(ctx.message?.message_id as number);

  if (isLoggedIn(ctx.session.token)) {
    await getNextQuarterMonth(ctx, messageIds);
    const reply = await ctx.reply('<b>Input amount to deposit in ₦ (Naira)</b>', { parse_mode: 'HTML' });
    messageIds.push(reply.message_id);
    ctx.session.route = 'depositRequestInProgress';
  } else {
    const reply = await ctx.reply('**Login Required** 🔒\n\nUse /login to access this feature.');
    messageIds.push(reply.message_id);
  }

  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
};
