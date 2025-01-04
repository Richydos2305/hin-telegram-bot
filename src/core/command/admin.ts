import { CommandContext, Keyboard } from 'grammy';
import { MyContext } from '../helpers';
import { Admins } from '../models/admins';
import { TransactionStatus } from '../interfaces/models';

const transactionConfirmationCommand: string[] = [TransactionStatus.APPROVED, TransactionStatus.DENIED];

const transactionConfirmationbuttonRows = transactionConfirmationCommand.map((command) => [Keyboard.text(command)]);
export const transactionConfirmationkeyboard = Keyboard.from(transactionConfirmationbuttonRows).resized().oneTime();
export const pickTransactionStatus = '<b>Approve or Deny?</b>';

export const handleAdmin = async (ctx: CommandContext<MyContext>): Promise<void> => {
  const admin = await Admins.findOne({ username: ctx.message?.from.first_name });
  if (admin) {
    console.log(ctx.message?.chat.id);

    await ctx.reply('**Enter Password 🔒**\n\nPlease type your password to proceed...', { parse_mode: 'Markdown' });
    ctx.session.state = 'adminLoginInProgress';
    ctx.session.userData = admin;
  } else {
    await ctx.reply('**Admin Not Found** 🚫\n\nPlease check your credentials and try again.');
  }
};
