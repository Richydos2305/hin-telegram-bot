import { Composer } from 'grammy';
import { formatNumber, isLoggedIn, MyContext, trackMessage } from '../helpers';
import { handleStart } from '../command/start';
import { handleAdmin } from '../command/admin';
import { handleRegister } from '../command/register';
import { handleLogin } from '../command/login';
import { handleDeposit } from '../command/deposit';
import { handleWithdrawal } from '../command/withdraw';
import { TransactionStatus, TransactionType } from '../interfaces';
import { Quarters } from '../models/quarters';
import { ITransactions, Transactions } from '../models/transactions';
import { Users } from '../models/users';
import { Accounts } from '../models/accounts';

const composer = new Composer<MyContext>();
const messageIds: number[] = [];

composer.command('admin', handleAdmin);
composer.command('register', handleRegister);
composer.command('login', handleLogin);
composer.command('deposit', handleDeposit);
composer.command('withdraw', handleWithdrawal);

composer.command('start', handleStart);

composer.on('callback_query', async (ctx) => {
  const { isAdmin, userData, token } = ctx.session;

  const userId = ctx.update.callback_query.message?.chat.id;

  if (isAdmin) {
    const callbackData = ctx.callbackQuery.data;
    if (callbackData === 'make_entry') {
      const currentYear = new Date().getFullYear();
      ctx.session.year = currentYear;
      let reply = await ctx.reply(`Year automatically set to ${currentYear}.`);
      messageIds.push(reply.message_id);

      const lastQuarterEntry = await Quarters.findOne().limit(1).sort({ createdAt: -1 });
      if (lastQuarterEntry && lastQuarterEntry.quarter < 4) {
        ctx.session.quarter = lastQuarterEntry.quarter + 1;
      } else if (lastQuarterEntry && lastQuarterEntry.quarter === 4) {
        ctx.session.quarter = 1;
      } else {
        ctx.session.quarter = 1;
      }

      reply = await ctx.reply(`Quarter automatically set to Q${ctx.session.quarter}.`);
      messageIds.push(reply.message_id);
      reply = await ctx.reply(`Input quarters ROI`);
      messageIds.push(reply.message_id);
      ctx.session.route = 'askROI';
    } else if (callbackData === 'view_transactions') {
      const result = [];
      const modifiedTransactions = [];
      const transactions = await Transactions.find({ status: TransactionStatus.PENDING });
      console.log('A Request for Pending Transactions was made');

      if (transactions.length > 0) {
        for (const transaction of transactions) {
          const user = await Users.findById(transaction.user_id).select('username chat_id');
          result.push(`${user?.username} - ${formatNumber(transaction.amount)} - ${transaction.type}`);
          modifiedTransactions.push({ user, transaction });
        }

        let reply = await ctx.reply(result.join('\n'));
        messageIds.push(reply.message_id);
        reply = await ctx.reply('Input a username to access their transaction request');
        messageIds.push(reply.message_id);

        ctx.session.transactions = modifiedTransactions;
        ctx.session.route = 'viewUserTransaction';
      } else {
        const reply = await ctx.reply('No Pending Transactions');
        messageIds.push(reply.message_id);
      }
    } else if (callbackData === 'broadcast') {
      const reply = await ctx.reply('Type out the message you want to send to your investors');
      messageIds.push(reply.message_id);
      ctx.session.route = 'broadcast';
    }
  } else if (isLoggedIn(token)) {
    const callbackData = ctx.callbackQuery.data;
    if (callbackData === 'check_performance') {
      let reply = await ctx.reply('Performance Summary');
      messageIds.push(reply.message_id);

      const quarter = await Quarters.find({ user_id: userData._id });
      if (quarter) {
        for (let i = 0; i < quarter.length; i++) {
          reply = await ctx.reply(
            `📊 <b>Investment Summary for Q${quarter[i].quarter} in ${quarter[i].year}</b>

    💰 Starting Balance: <code>${formatNumber(quarter[i].starting_capital)}</code>
    📈 Ending Balance: <code>${formatNumber(quarter[i].ending_capital)}</code>
    📊 Return on Investment (ROI): <code>${quarter[i].roi * 100}%</code>

    👍 Your investment has grown by ${formatNumber(quarter[i].ending_capital - quarter[i].starting_capital)}!
  `,
            {
              parse_mode: 'HTML'
            }
          );
          messageIds.push(reply.message_id);
        }
      }
    } else if (callbackData === 'recent_quarter') {
      const quarter = await Quarters.findOne({ user_id: userData._id }).limit(1).sort({ updatedAt: -1 });
      if (quarter) {
        const reply = await ctx.reply(
          `
    📊 <b>Investment Update for quarter ${quarter.quarter}</b> 📊

    💰 Starting Balance: <code>${formatNumber(quarter.starting_capital)}</code>
    📈 Ending Balance: <code>${formatNumber(quarter.ending_capital)}</code>
    📊 Return on Investment (ROI): <code>${quarter.roi * 100}%</code>

    🎉 Congratulations! Your investment has grown by ${formatNumber(quarter.ending_capital - quarter.starting_capital)}!
  `,
          {
            parse_mode: 'HTML'
          }
        );
        messageIds.push(reply.message_id);
      }
    } else if (callbackData === 'investment_status') {
      const account = await Accounts.findOne({ user_id: userData._id });
      const withdrawals: ITransactions[] = await Transactions.find({
        user_id: ctx.session.userData._id,
        type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.APPROVED
      });
      console.log(withdrawals);

      if (account) {
        if (withdrawals.length > 0) {
          let totalWithdrawals: number = 0;
          for (const transaction of withdrawals) {
            totalWithdrawals += transaction.amount;
          }
          const reply = await ctx.reply(
            `📊 <b>Investment Summary</b>

    \ud83d\udcb0 Initial Investment: <code>${formatNumber(account.initial_balance)}</code>
    📈 Current Balance: <code>${formatNumber(account.current_balance)}</code>
    📊 You have withdrawn a total of: <code>${formatNumber(totalWithdrawals)}</code>
    \ud83d\udc4d Your investment has grown by ${formatNumber(account.current_balance - account.initial_balance)}!`,
            {
              parse_mode: 'HTML'
            }
          );
          messageIds.push(reply.message_id);
        } else {
          const reply = await ctx.reply(
            `📊 <b>Investment Summary</b>

    \ud83d\udcb0 Initial Investment: <code>${formatNumber(account.initial_balance)}</code>
    📈 Current Balance: <code>${formatNumber(account.current_balance)}</code>
    \ud83d\udc4d Your investment has grown by ${formatNumber(account.current_balance - account.initial_balance)}!`,
            {
              parse_mode: 'HTML'
            }
          );
          messageIds.push(reply.message_id);
        }
      }
    }
  } else {
    const reply = await ctx.reply('Not an Admin, Not Logged in. 🚫 Try /login first');
    messageIds.push(reply.message_id);
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
});

composer.use(async (ctx) => {
  const userId = ctx.message?.chat.id;
  messageIds.push(ctx.message?.message_id as number);
  if (ctx.session) {
    const reply = await ctx.reply('**Not a recognised input** \nIf you need help, do /start.');
    messageIds.push(reply.message_id);
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
});

export { composer };
