import { Router } from '@grammyjs/router';
import { getAccessToken, MyContext, trackMessage } from '../helpers';

const router = new Router<MyContext>((ctx) => ctx.session.route);
const messageIds: number[] = [];

router.route('loginInProgress', async (ctx) => {
  const { message } = ctx;
  const { userData } = ctx.session;
  const userId = message?.chat.id;
  messageIds.push(message?.message_id as number);

  if (message) {
    if (message.text === userData.security_a) {
      ctx.session.token = getAccessToken({ username: userData.username, id: userData._id });
      const reply = await ctx.reply('Authentication Successful', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Check Performance', callback_data: 'check_performance' },
              { text: 'Check Recent Quarter', callback_data: 'recent_quarter' }
            ],
            [{ text: 'Investment Status', callback_data: 'investment_status' }]
          ]
        }
      });
      messageIds.push(reply.message_id);
      ctx.session.route = '';
    } else {
      ctx.session.userData = null;
      ctx.session.route = '';
      const reply = await ctx.reply(`**Incorrect Answer** 🚫\n\nSorry, that's not correct. Please try again using the /login command.`);
      messageIds.push(reply.message_id);
    }
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
});

export { router };
