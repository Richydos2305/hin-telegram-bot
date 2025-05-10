import { CommandContext } from 'grammy';
import { MyContext, trackMessage } from '../helpers/helpers';

const messageIds: number[] = [];

export const handleStart = async (ctx: CommandContext<MyContext>): Promise<void> => {
  const userId = ctx.message?.chat.id;
  messageIds.push(ctx.message?.message_id as number);

  const reply = await ctx.reply(
    `<b>Welcome to HIN Bot!</b> 🤖\n\n With this bot, you can:
📊 View your account status and performance.
💸 Make deposits or withdrawals effortlessly.
📈 Track the performance of the most recent quarter.

Click the menu button below to explore all features or start with /login to access your account 📚.

You can clear the chat manually by clicking the three dots in the top right corner and selecting "Clear Chat".`,
    { parse_mode: 'HTML' }
  );
  messageIds.push(reply.message_id);
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
};
