import { Router } from '@grammyjs/router';
import { MyContext } from '../helpers';
import { Users } from '../models/users';
import { questions } from '../command/register';
import { Accounts } from '../models/accounts';

const router = new Router<MyContext>((ctx) => ctx.session.route);

router.route('securityQuestion', async (ctx) => {
  const { message } = ctx;
  if (message) {
    const user = await Users.findOne({ telegram_id: message.from.id });
    if (user) {
      await ctx.reply('**User Already Exists** 🚫\n\nYou already have an account. Please use the /login command to access it.');
    } else {
      const selectedQuestion = message.text;

      if (selectedQuestion && questions.includes(selectedQuestion)) {
        ctx.session.securityQuestion = selectedQuestion;
        await ctx.reply(`So ${message.text}`);
        ctx.session.state = 'securityAnswer';
        ctx.session.route = 'securityAnswer';
      } else {
        await ctx.reply('**Invalid Security Question** 📝\n\nPlease select a valid security question using the /register command.');
      }
    }
  }
});

router.route('securityAnswer', async (ctx) => {
  const { message } = ctx;
  if (message) {
    const answer = message.text as string;
    const telegramId: number = message.from.id;
    const username: string = message.from.first_name;
    const chat_id = message.chat.id;
    const user = await Users.create({ username, telegram_id: telegramId, security_q: ctx.session.securityQuestion, security_a: answer, chat_id });

    if (user)
      await ctx.reply(
        `**Registration Successful! 🎉**\n\nYour details have been successfully registered. You can now use the /login command to access your account.`
      );
    await Accounts.create({ user_id: user._id });
    ctx.session.state = null;
    ctx.session.route = '';
  }
});

export { router };
