import { CommandContext } from 'grammy';
import { getNextQuarterMonth, isLoggedIn, MyContext, trackMessage } from '../helpers/helpers';
import { settings } from '../config/application';
import { transactionsNotAllowed, loginPrompt } from '../helpers/constants';

const messageIds: number[] = [];

export const handleDeposit = async (ctx: CommandContext<MyContext>): Promise<void> => {
  const userId = ctx.message?.chat.id;
  messageIds.push(ctx.message?.message_id as number);

  if (isLoggedIn(ctx.session.token)) {
    if (settings.allowDepositsAndWithdrawals) {
      await getNextQuarterMonth(ctx, messageIds);

      const reply = await ctx.reply('Choose plan to deposit into: ', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'HIGH RISK', callback_data: 'high_risk_deposit' },
              { text: 'MEDIUM RISK', callback_data: 'medium_risk_deposit' }
            ],
            [
              { text: 'LOW RISK', callback_data: 'low_risk_deposit' },
              { text: 'CANCEL', callback_data: 'cancel' }
            ]
          ]
        }
      });
      messageIds.push(reply.message_id);
      ctx.session.route = '';
    } else {
      const reply = await ctx.reply(transactionsNotAllowed, { parse_mode: 'HTML' });
      messageIds.push(reply.message_id);
      ctx.session.route = '';
    }
  } else {
    const reply = await ctx.reply(loginPrompt, { parse_mode: 'HTML' });
    messageIds.push(reply.message_id);
  }

  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
};
