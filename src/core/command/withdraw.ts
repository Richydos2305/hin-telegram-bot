import { CommandContext } from 'grammy';
import { checkSubscribedPlans, isLoggedIn, MyContext, trackMessage } from '../helpers';

const messageIds: number[] = [];

export const handleWithdrawal = async (ctx: CommandContext<MyContext>): Promise<void> => {
  const userId = ctx.message?.chat.id;
  const { userData } = ctx.session;
  messageIds.push(ctx.message?.message_id as number);

  if (isLoggedIn(ctx.session.token)) {
    await checkSubscribedPlans(ctx, userData);
  } else {
    const reply = await ctx.reply('**User does not exist** 🚫\n\n Please /login to perform this action');
    messageIds.push(reply.message_id);
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
};
