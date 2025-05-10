import { Router } from '@grammyjs/router';
import { confirmDeposit, handleStop, MyContext, trackMessage } from '../helpers/helpers';
import { formatNumber } from '../helpers/utils';

const router = new Router<MyContext>((ctx) => ctx.session.route);
const messageIds: number[] = [];

router.route('depositRequestInProgress', async (ctx) => {
  const { message } = ctx;
  const userId = message?.chat.id;
  messageIds.push(message?.message_id as number);

  if (message) {
    const amount = message.text;
    if (amount && !isNaN(Number(amount))) {
      if (Number(amount) < 30000) {
        const reply = await ctx.reply(`<b>Invalid Amount</b> 📝\n\nMinimum deposit amount is  ₦30,000.`, { parse_mode: 'HTML' });
        messageIds.push(reply.message_id);
      } else {
        const reply = await ctx.reply(
          `<b>Confirm Deposit</b> 💸\n\nPlease make a transfer of ${formatNumber(Number(amount))} to the following account: \n0021919337 - Access Bank - Richard Dosunmu.\n\nAttach the receipt as your response to this message. 📝`,
          { parse_mode: 'HTML' }
        );
        messageIds.push(reply.message_id);
        ctx.session.route = 'depositRequestConfirmation';
        ctx.session.amount = Number(amount);
      }
    } else if (message.text === '/stop') {
      await handleStop(ctx, messageIds);
    } else {
      const reply = await ctx.reply('<b>Invalid Amount</b> 📝\n\nPlease enter a valid amount to proceed.', { parse_mode: 'HTML' });
      messageIds.push(reply.message_id);
    }
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
});

router.route('depositRequestConfirmation', async (ctx) => {
  const { message } = ctx;
  const { userData } = ctx.session;
  const userId = message?.chat.id;
  messageIds.push(message?.message_id as number);

  await confirmDeposit(ctx, messageIds, userData);

  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
});

export { router };
