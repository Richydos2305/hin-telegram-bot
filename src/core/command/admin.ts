import { CommandContext, Keyboard } from 'grammy';
import { MyContext, trackMessage } from '../helpers/helpers';
import { Admins } from '../models/admins';
import { TransactionStatus } from '../interfaces';

const transactionConfirmationCommand: string[] = [TransactionStatus.APPROVED, TransactionStatus.DENIED];

const transactionConfirmationbuttonRows = transactionConfirmationCommand.map((command) => [Keyboard.text(command)]);
export const transactionConfirmationkeyboard = Keyboard.from(transactionConfirmationbuttonRows).resized().oneTime();
const messageIds: number[] = [];

export const handleAdmin = async (ctx: CommandContext<MyContext>): Promise<void> => {
  const admin = await Admins.findOne({ username: ctx.message?.from.first_name });
  const userId = ctx.message?.chat.id;
  messageIds.push(ctx.message?.message_id as number);

  if (admin) {
    const reply = await ctx.reply('**Enter Password 🔒**\n\nPlease type your password to proceed...', { parse_mode: 'Markdown' });
    messageIds.push(reply.message_id);

    ctx.session.route = 'adminLoginInProgress';
    ctx.session.userData = admin;
  } else {
    const reply = await ctx.reply('**Admin Not Found** 🚫\n\nPlease check your credentials and try again.');
    messageIds.push(reply.message_id);
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
};
