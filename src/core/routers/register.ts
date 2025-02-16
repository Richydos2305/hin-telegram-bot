import { Router } from '@grammyjs/router';
import { MyContext, trackMessage } from '../helpers';
import { Users } from '../models/users';
import { questions } from '../command/register';
import { Accounts } from '../models/accounts';

const router = new Router<MyContext>((ctx) => ctx.session.route);
const messageIds: number[] = [];

router.route('securityQuestion', async (ctx) => {
  const { message } = ctx;
  const userId = message?.chat.id;
  messageIds.push(message?.message_id as number);

  if (message) {
    const user = await Users.findOne({ telegram_id: message.from.id });
    if (user) {
      const reply = await ctx.reply('**User Already Exists** 🚫\n\nYou already have an account. Please use the /login command to access it.');
      messageIds.push(reply.message_id);
      ctx.session.route = '';
    } else {
      const selectedQuestion = message.text;

      if (selectedQuestion && questions.includes(selectedQuestion)) {
        ctx.session.securityQuestion = selectedQuestion;
        const reply = await ctx.reply(`So ${message.text}`);
        messageIds.push(reply.message_id);
        ctx.session.route = 'securityAnswer';
      } else {
        const reply = await ctx.reply('**Invalid Security Question** 📝\n\nPlease select a valid security question using the /register command.');
        messageIds.push(reply.message_id);
      }
    }
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
});

router.route('securityAnswer', async (ctx) => {
  const { message } = ctx;
  const userId = message?.chat.id;
  messageIds.push(message?.message_id as number);

  if (message) {
    const answer = message.text as string;
    const telegramId: number = message.from.id;
    const username: string = message.from.first_name;
    const chat_id = message.chat.id;
    const user = await Users.create({ username, telegram_id: telegramId, security_q: ctx.session.securityQuestion, security_a: answer, chat_id });

    if (user) {
      const reply = await ctx.reply(
        `<b>Registration Successful!</b> 🎉\n\nYour details have been successfully registered. You can now use the /login command to access your account.`,
        { parse_mode: 'HTML' }
      );
      messageIds.push(reply.message_id);
    }
    await Accounts.create({ user_id: user._id });
    ctx.session.route = '';
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
});

export { router };
