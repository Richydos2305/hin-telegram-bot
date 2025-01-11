import { CommandContext } from 'grammy';
import { MyContext } from '../helpers';

export const handleStart = async (ctx: CommandContext<MyContext>): Promise<void> => {
  await ctx.reply(`**Welcome to HIN Bot!** 🤖\n\n With this bot, you can:
📊 View your account status and performance.
💸 Make deposits or withdrawals effortlessly.
📈 Track the performance of the most recent quarter.

Click the menu button below to explore all features or start with /login to access your account 📚.`);
};
