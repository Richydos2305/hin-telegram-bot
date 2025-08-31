import { CommandContext } from 'grammy';
import { MyContext, trackMessage } from '../helpers/helpers';
import { welcomeMessage } from '../helpers/constants';

const messageIds: number[] = [];

export const handleStart = async (ctx: CommandContext<MyContext>): Promise<void> => {
  const userId = ctx.message?.chat.id;
  messageIds.push(ctx.message?.message_id as number);

  const reply = await ctx.reply(welcomeMessage, { parse_mode: 'HTML' });
  messageIds.push(reply.message_id);
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
};
