import { CommandContext } from 'grammy';
import { isLoggedIn, MyContext, trackMessage } from '../helpers';

const messageIds: number[] = [];

export const handleWithdrawal = async (ctx: CommandContext<MyContext>): Promise<void> => {
  const userId = ctx.message?.chat.id;
  messageIds.push(ctx.message?.message_id as number);

  if (isLoggedIn(ctx.session.token)) {
    const reply = await ctx.reply('<b>Withdrawal Amount</b> 💸\n\nPlease enter the amount you want to withdraw in ₦ (Naira)', { parse_mode: 'HTML' });
    messageIds.push(reply.message_id);
    ctx.session.route = 'withdrawalRequestInProgress';
  } else {
    const reply = await ctx.reply('**User does not exist** 🚫\n\n Please /login to perform this action');
    messageIds.push(reply.message_id);
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
};
