import { CommandContext } from 'grammy';
import { MyContext } from '../helpers';

export const handleStart = async (ctx: CommandContext<MyContext>): Promise<void> => {
  await ctx.reply('**Welcome to HIN Bot!** 🤖\n\nClick the menu button to explore our features and commands 📚');
};
