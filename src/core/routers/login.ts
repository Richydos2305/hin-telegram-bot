import bcrypt from 'bcrypt';
import { Router } from '@grammyjs/router';
import { formatNumber, getAccessToken, MyContext, trackMessage } from '../helpers';
import { FileType, TransactionStatus } from '../interfaces';
import { Users } from '../models/users';
import { questions } from '../command/login';
import { Accounts } from '../models/accounts';

const router = new Router<MyContext>((ctx) => ctx.session.route);
const messageIds: number[] = [];

router.route('securityQuestion', async (ctx) => {
  const { message } = ctx;
  const { userData } = ctx.session;
  const userId = message?.chat.id;
  messageIds.push(message?.message_id as number);

  if (message) {
    const user = await Users.findOne({ username: message.from.username });
    if (!userData) {
      const reply = await ctx.reply('**User Does Not Exist** 🚫\n\nYou are not authorised to use this bot.');
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
        const reply = await ctx.reply('**Invalid Security Question** 📝\n\nPlease select a valid security question using the /login command.');
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
    const firstName: string = message.from.first_name;
    const chat_id = message.chat.id;

    const hashedAnswer = await bcrypt.hash(answer, 10);

    const updatedUser = await Users.findOneAndUpdate(
      { username: message.from.username },
      {
        $set: {
          telegram_id: telegramId,
          first_name: firstName,
          security_q: ctx.session.securityQuestion,
          security_a: hashedAnswer,
          chat_id
        }
      },
      { new: true }
    );

    if (updatedUser) {
      const reply = await ctx.reply(
        `<b>Onboarding Successful!</b> 🎉\n\nYour details have been successfully documented. You can now use the /login command to access your account.`,
        { parse_mode: 'HTML' }
      );
      messageIds.push(reply.message_id);
      await Accounts.create({ user_id: updatedUser._id });
    }
    ctx.session.route = '';
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
});

router.route('loginInProgress', async (ctx) => {
  const { message } = ctx;
  const { userData } = ctx.session;
  const userId = message?.chat.id;
  messageIds.push(message?.message_id as number);

  if (message) {
    if (await bcrypt.compare(message.text as string, userData.security_a)) {
      ctx.session.token = getAccessToken({ username: userData.username, id: userData._id });
      const reply = await ctx.reply('Authentication Successful', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Performance', callback_data: 'check_performance' },
              { text: 'Recent Quarter', callback_data: 'recent_quarter' }
            ],
            [
              { text: 'Investment Status', callback_data: 'investment_status' },
              { text: 'Transaction History', callback_data: 'transaction_history' }
            ]
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

router.route('userTransactionHistory', async (ctx) => {
  const { message } = ctx;
  const { userData, transactionHistory } = ctx.session;
  const userId = message?.chat.id;
  messageIds.push(message?.message_id as number);

  if (message) {
    if (!isNaN(Number(message.text))) {
      const transaction = transactionHistory.find((obj) => obj.count === Number(message.text));
      if (transaction) {
        const { transaction: currentTransaction } = transaction;
        const statusEmote = currentTransaction.status === TransactionStatus.APPROVED ? '✅' : '⏳';
        const newDate = new Date(currentTransaction.createdAt as Date).toLocaleDateString('en-US', { month: '2-digit', year: '2-digit' });
        if (currentTransaction.receipt.type === FileType.DOCUMENT) {
          const reply = await ctx.replyWithDocument(currentTransaction.receipt.file, {
            caption: `${formatNumber(currentTransaction.amount)} -> ${newDate} -> ${statusEmote}`
          });
          messageIds.push(reply.message_id);
        } else if (currentTransaction.receipt.type === FileType.PHOTO) {
          const reply = await ctx.replyWithPhoto(currentTransaction.receipt.file, {
            caption: `${formatNumber(currentTransaction.amount)} -> ${newDate} -> ${statusEmote}`
          });
          messageIds.push(reply.message_id);
        }
      }

      ctx.session.route = '';
    } else {
      const reply = await ctx.reply(`**Please Input a Number**`);
      messageIds.push(reply.message_id);
    }
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
});

export { router };
