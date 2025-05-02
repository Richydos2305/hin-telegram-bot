import { Router } from '@grammyjs/router';
import { confirmWithdrawal, MyContext, trackMessage } from '../helpers';

const router = new Router<MyContext>((ctx) => ctx.session.route);
const messageIds: number[] = [];

router.route('withdrawalRequestInProgress', async (ctx) => {
  const { message } = ctx;
  const { userData } = ctx.session;
  const userId = message?.chat.id;
  messageIds.push(message?.message_id as number);
  await confirmWithdrawal(ctx, messageIds, userData);
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
});

export { router };
