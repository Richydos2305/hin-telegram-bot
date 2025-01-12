import { Router } from '@grammyjs/router';
import { getAccessToken, MyContext } from '../helpers';

const router = new Router<MyContext>((ctx) => ctx.session.route);

router.route('loginInProgress', async (ctx) => {
  const { message } = ctx;
  const { userData } = ctx.session;
  if (message) {
    if (message.text === userData.security_a) {
      ctx.session.token = getAccessToken({ username: userData.username, id: userData._id });
      await ctx.reply('Authentication Successful', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Check Performance', callback_data: 'check_performance' },
              { text: 'Check Recent Quarter', callback_data: 'recent_quarter' }
            ],
            [
              { text: 'Investment Status', callback_data: 'investment_status' },
            ]
          ]
        }
      });
      ctx.session.route = '';
    } else {
      ctx.session.userData = null;
      ctx.session.route = '';
      await ctx.reply(`**Incorrect Answer** 🚫\n\nSorry, that's not correct. Please try again using the /login command.`);
    }
  }
});

export { router };
