import { Composer } from 'grammy';
import { handleStop, isLoggedIn, MyContext, promptWithdrawalAmount, trackMessage } from '../helpers/helpers';
import { handleStart } from '../command/start';
import { handleAdmin } from '../command/admin';
import { handleLogin } from '../command/login';
import { handleDeposit } from '../command/deposit';
import { handleWithdrawal } from '../command/withdraw';
import { statusType, TransactionStatus, TransactionType, UserPlan } from '../interfaces';
import { Quarters } from '../models/quarters';
import { ITransactions, Transactions } from '../models/transactions';
import { Users } from '../models/users';
import { HighRiskAccounts } from '../models/highRiskAccounts';
import { formatNumber } from '../helpers/numberUtils';
import { MediumRiskAccounts } from '../models/mediumRiskAccounts';
import { LowRiskAccounts } from '../models/lowRiskAccounts';

const composer = new Composer<MyContext>();
const messageIds: number[] = [];

composer.command('admin', handleAdmin);
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

      const lastQuarterEntry = (await Quarters.find({ year: currentYear }).limit(1).sort({ quarter: -1 }))[0];

      if (lastQuarterEntry && lastQuarterEntry.quarter < 4) {
        ctx.session.quarter = lastQuarterEntry.quarter + 1;
      } else if (lastQuarterEntry && lastQuarterEntry.quarter === 4) {
        ctx.session.quarter = 1;
      } else {
        ctx.session.quarter = 1;
      }

      reply = await ctx.reply(`Quarter automatically set to Q${ctx.session.quarter}.`);
      messageIds.push(reply.message_id);

      reply = await ctx.reply('Make an Entry for Which Plan? ', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'High', callback_data: 'high_risk' },
              { text: 'Medium', callback_data: 'medium_risk' }
            ],
            [{ text: 'Low', callback_data: 'low_risk' }]
          ]
        }
      });
      messageIds.push(reply.message_id);
    } else if (callbackData === 'view_transactions') {
      const result = [];
      const modifiedTransactions = [];
      const transactions = await Transactions.find({ status: TransactionStatus.PENDING });

      if (transactions.length > 0) {
        console.log('A Request for Pending Transactions was made');
        for (const transaction of transactions) {
          const user = await Users.findById(transaction.user_id).select('first_name chat_id');
          result.push(`${user?.first_name} ->  ${formatNumber(transaction.amount)} ->  ${transaction.type}`);
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
    } else if (callbackData === 'high_risk') {
      const reply = await ctx.reply(`Input quarters ROI`);
      messageIds.push(reply.message_id);
      ctx.session.userPlan = UserPlan.HIGH_RISK;
      ctx.session.route = 'askROI';
    } else if (callbackData === 'medium_risk') {
      const reply = await ctx.reply(`Input quarters ROI`);
      messageIds.push(reply.message_id);
      ctx.session.userPlan = UserPlan.MEDIUM_RISK;
      ctx.session.route = 'askROI';
    } else if (callbackData === 'low_risk') {
      const reply = await ctx.reply(`Input quarters ROI`);
      messageIds.push(reply.message_id);
      ctx.session.userPlan = UserPlan.LOW_RISK;
      ctx.session.route = 'askROI';
    }
  } else if (isLoggedIn(token)) {
    const callbackData = ctx.callbackQuery.data;
    if (callbackData === 'check_performance') {
      let reply;
      const quarter = await Quarters.find({ user_id: userData._id });
      const mediumRisk = await MediumRiskAccounts.find({ user_id: userData._id });
      const lowRisk = await LowRiskAccounts.find({ user_id: userData._id });

      reply = await ctx.reply(`<b>Performance Summary</b>`, { parse_mode: 'HTML' });
      messageIds.push(reply.message_id);

      if (quarter.length > 0) {
        if (quarter.length > 0) {
          for (let i = 0; i < quarter.length; i++) {
            reply = await ctx.reply(
              `📊 <b>High-Risk Plan Investment Summary for Q${quarter[i].quarter} in ${quarter[i].year}</b>
  
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
      }
      if (mediumRisk.length > 0) {
        for (let i = 0; i < mediumRisk.length; i++) {
          reply = await ctx.reply(
            `📊 <b>Medium-Risk Plan Investment Summary ${i + 1}</b>

    💰 Starting Balance: <code>${formatNumber(mediumRisk[i].initial_balance)}</code>
    📈 Current Balance: <code>${formatNumber(mediumRisk[i].current_balance)}</code>
    📊 Return on Investment (ROI): <code>${(((mediumRisk[i].current_balance - mediumRisk[i].initial_balance) / mediumRisk[i].initial_balance) * 100).toFixed(2)}%</code>
    📊 Status: <code>${mediumRisk[i].status}</code>

    👍 Your investment has grown by ${formatNumber(mediumRisk[i].current_balance - mediumRisk[i].initial_balance)}!
  `,
            {
              parse_mode: 'HTML'
            }
          );
          messageIds.push(reply.message_id);
        }
      }
      if (lowRisk.length > 0) {
        for (let i = 0; i < mediumRisk.length; i++) {
          reply = await ctx.reply(
            `📊 <b>Low-Risk Plan Investment Summary ${i + 1}</b>

    💰 Starting Balance: <code>${formatNumber(lowRisk[i].initial_balance)}</code>
    📈 Current Balance: <code>${formatNumber(lowRisk[i].current_balance)}</code>
    📊 Return on Investment (ROI): <code>${(((lowRisk[i].current_balance - lowRisk[i].initial_balance) / lowRisk[i].initial_balance) * 100).toFixed(2)}%</code>
    📊 Status: <code>${lowRisk[i].status}</code>

    👍 Your investment has grown by ${formatNumber(lowRisk[i].current_balance - lowRisk[i].initial_balance)}!
  `,
            {
              parse_mode: 'HTML'
            }
          );
          messageIds.push(reply.message_id);
        }
      } else {
        reply = await ctx.reply('No Investment Record Yet 😔');
        messageIds.push(reply.message_id);
      }
    } else if (callbackData === 'recent_quarter') {
      const quarter = await Quarters.findOne({ user_id: userData._id }).limit(1).sort({ updatedAt: -1 });
      const mediumRiskaccount = await MediumRiskAccounts.find({ user_id: userData._id, status: statusType.ACTIVE });
      const lowRiskaccount = await LowRiskAccounts.find({ user_id: userData._id, status: statusType.ACTIVE });
      if (quarter) {
        const reply = await ctx.reply(
          `
    📊 <b>High-Risk Plan Investment Update for Quarter ${quarter.quarter}</b> 📊

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

      if (mediumRiskaccount.length > 0) {
        for (let i = 0; i < mediumRiskaccount.length; i++) {
          const reply = await ctx.reply(
            `📊 <b>Medium-Risk Plan Investment Update ${i + 1}</b>

    💰 Starting Balance: <code>${formatNumber(mediumRiskaccount[i].initial_balance)}</code>
    📈 Current Balance: <code>${formatNumber(mediumRiskaccount[i].current_balance)}</code>
    📊 Return on Investment (ROI): <code>${(((mediumRiskaccount[i].current_balance - mediumRiskaccount[i].initial_balance) / mediumRiskaccount[i].initial_balance) * 100).toFixed(2)}%</code>

    👍 Your investment has grown by ${formatNumber(mediumRiskaccount[i].current_balance - mediumRiskaccount[i].initial_balance)}!
  `,
            {
              parse_mode: 'HTML'
            }
          );
          messageIds.push(reply.message_id);
        }
      }

      if (lowRiskaccount.length > 0) {
        for (let i = 0; i < lowRiskaccount.length; i++) {
          const reply = await ctx.reply(
            `📊 <b>Low-Risk Plan Investment Update ${i + 1}</b>

    💰 Starting Balance: <code>${formatNumber(lowRiskaccount[i].initial_balance)}</code>
    📈 Current Balance: <code>${formatNumber(lowRiskaccount[i].current_balance)}</code>
    📊 Return on Investment (ROI): <code>${(((lowRiskaccount[i].current_balance - lowRiskaccount[i].initial_balance) / lowRiskaccount[i].initial_balance) * 100).toFixed(2)}%</code>

    👍 Your investment has grown by ${formatNumber(lowRiskaccount[i].current_balance - lowRiskaccount[i].initial_balance)}!
  `,
            {
              parse_mode: 'HTML'
            }
          );
          messageIds.push(reply.message_id);
        }
      } else {
        const reply = await ctx.reply('This is your first quarter with us 😗');
        messageIds.push(reply.message_id);
      }
    } else if (callbackData === 'investment_status') {
      const highRiskaccount = await HighRiskAccounts.findOne({ user_id: userData._id });
      const mediumRiskaccount = await MediumRiskAccounts.find({ user_id: userData._id, status: statusType.ACTIVE });
      const lowRiskaccount = await LowRiskAccounts.find({ user_id: userData._id, status: statusType.ACTIVE });
      const withdrawals: ITransactions[] = await Transactions.find({
        user_id: ctx.session.userData._id,
        type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.APPROVED
      });

      if (highRiskaccount) {
        let initial: number = 0;
        let current: number = 0;
        for (let i = 0; i < mediumRiskaccount.length; i++) {
          initial += mediumRiskaccount[i].initial_balance;
          current += mediumRiskaccount[i].current_balance;
        }
        for (let i = 0; i < lowRiskaccount.length; i++) {
          initial += lowRiskaccount[i].initial_balance;
          current += lowRiskaccount[i].current_balance;
        }
        initial += highRiskaccount.initial_balance;
        current += highRiskaccount.current_balance;
        if (withdrawals.length > 0) {
          let totalWithdrawals: number = 0;
          for (const transaction of withdrawals) {
            totalWithdrawals += transaction.amount;
          }
          const reply = await ctx.reply(
            `📊 <b>Investment Summary</b>

    \ud83d\udcb0 Initial Investment: <code>${formatNumber(initial)}</code>
    📈 Current Balance: <code>${formatNumber(current)}</code>
    📊 You have withdrawn a total of: <code>${formatNumber(totalWithdrawals)}</code>!`,
            {
              parse_mode: 'HTML'
            }
          );
          messageIds.push(reply.message_id);
        } else {
          const reply = await ctx.reply(
            `📊 <b>Investment Summary</b>

    \ud83d\udcb0 Initial Investment: <code>${formatNumber(initial)}</code>
    📈 Current Balance: <code>${formatNumber(current)}</code>
    \ud83d\udc4d Your investment has grown by ${formatNumber(current - initial)}!`,
            {
              parse_mode: 'HTML'
            }
          );
          messageIds.push(reply.message_id);
        }
      }
    } else if (callbackData === 'high_risk_deposit') {
      const reply = await ctx.reply(
        `<b>High-Risk Plan</b> 📈\n\n<b>Duration</b>: 3 months\n<b>Expected Returns</b>: 30–50% on average\n<b>Capital Guarantee</b>: None\n<b>Description</b>: Designed for aggressive growth. This plan offers high return potential but also carries the risk of loss. Suitable for investors comfortable with volatility. \n\n<b>Contact Tolu or Richard for any further questions</b>.\n\nIf you want to cancel, type /stop\n\nInput amount to deposit in ₦ (Naira):`,
        { parse_mode: 'HTML' }
      );
      messageIds.push(reply.message_id);
      ctx.session.userPlan = UserPlan.HIGH_RISK;
      ctx.session.route = 'depositRequestInProgress';
    } else if (callbackData === 'medium_risk_deposit') {
      const reply = await ctx.reply(
        `<b>Medium-Risk Plan</b> 📈\n\n<b>Duration</b>: 1 Year\n<b>Expected Returns</b>: 100%\n<b>Capital Guarantee</b>: 50%\n<b>Description</b>: A balanced option for steady growth. Offers strong returns with partial protection of your capital. \n\n<b>Contact Tolu or Richard for any further questions</b>.\n\nIf you want to cancel, type /stop\n\nInput amount to deposit in ₦ (Naira):`,
        { parse_mode: 'HTML' }
      );
      messageIds.push(reply.message_id);
      ctx.session.userPlan = UserPlan.MEDIUM_RISK;
      ctx.session.route = 'depositRequestInProgress';
    } else if (callbackData === 'low_risk_deposit') {
      const reply = await ctx.reply(
        `<b>Low-Risk Plan</b> 📈\n\n<b>Duration</b>: 1 Year\n<b>Expected Returns</b>: 30%\n<b>Capital Guarantee</b>: 100%\n<b>Description</b>: For risk-averse investors. Your capital is fully protected while earning stable, moderate returns. \n\n<b>Contact Tolu or Richard for any further questions</b>.\n\nIf you want to cancel, type /stop\n\nInput amount to deposit in ₦ (Naira):`,
        { parse_mode: 'HTML' }
      );
      messageIds.push(reply.message_id);
      ctx.session.userPlan = UserPlan.LOW_RISK;
      ctx.session.route = 'depositRequestInProgress';
    } else if (callbackData === 'cancel') {
      await handleStop(ctx, messageIds);
    } else if (callbackData === 'high_risk_withdrawal') {
      const reply = await ctx.reply('<b>Withdrawal Amount</b> 💸\n\nPlease enter the amount you want to withdraw in ₦ (Naira)', {
        parse_mode: 'HTML'
      });
      messageIds.push(reply.message_id);
      ctx.session.userPlan = UserPlan.HIGH_RISK;
      ctx.session.route = 'withdrawalRequestInProgress';
    } else if (callbackData === 'medium_risk_withdrawal') {
      const reply = await ctx.reply('<b>Withdrawal Amount</b> 💸\n\nPlease enter the amount you want to withdraw in ₦ (Naira)', {
        parse_mode: 'HTML'
      });
      messageIds.push(reply.message_id);
      ctx.session.userPlan = UserPlan.MEDIUM_RISK;
      ctx.session.route = 'withdrawalRequestInProgress';
    } else if (callbackData === 'low_risk_withdrawal') {
      const reply = await ctx.reply('<b>Withdrawal Amount</b> 💸\n\nPlease enter the amount you want to withdraw in ₦ (Naira)', {
        parse_mode: 'HTML'
      });
      messageIds.push(reply.message_id);
      ctx.session.userPlan = UserPlan.LOW_RISK;
      ctx.session.route = 'withdrawalRequestInProgress';
    } else if (callbackData === 'high_risk_deposit') {
      const reply = await ctx.reply(
        `<b>High-Risk Plan</b> 📈\n\nDuration: 3 months\nExpected Returns: 30–50% on average\nCapital Guarantee: None\nDescription: Designed for aggressive growth. This plan offers high return potential but also carries the risk of loss. Suitable for investors comfortable with volatility. \n\n<b>Contact Tolu or Richard for any further questions</b>.\n\nIf you want to cancel, type /stop\n\nInput amount to deposit in ₦ (Naira):`,
        { parse_mode: 'HTML' }
      );
      messageIds.push(reply.message_id);
      ctx.session.userPlan = UserPlan.HIGH_RISK;
      ctx.session.route = 'depositRequestInProgress';
    } else if (callbackData === 'medium_risk_deposit') {
      const reply = await ctx.reply(
        `<b>Meduim-Risk Plan</b> 📈\n\nDuration: 1 Year\nExpected Returns: 100%\nCapital Guarantee: 50%\nDescription: A balanced option for steady growth. Offers strong returns with partial protection of your capital. \n\n<b>Contact Tolu or Richard for any further questions</b>.\n\nIf you want to cancel, type /stop\n\nInput amount to deposit in ₦ (Naira):`,
        { parse_mode: 'HTML' }
      );
      messageIds.push(reply.message_id);
      ctx.session.userPlan = UserPlan.MEDIUM_RISK;
      ctx.session.route = 'depositRequestInProgress';
    } else if (callbackData === 'low_risk_deposit') {
      const reply = await ctx.reply(
        `<b>Low-Risk Plan</b> 📈\n\nDuration: 1 Year\nExpected Returns: 30%\nCapital Guarantee: 100%\nDescription: For risk-averse investors. Your capital is fully protected while earning stable, moderate returns. \n\n<b>Contact Tolu or Richard for any further questions</b>.\n\nIf you want to cancel, type /stop\n\nInput amount to deposit in ₦ (Naira):`,
        { parse_mode: 'HTML' }
      );
      messageIds.push(reply.message_id);
      ctx.session.userPlan = UserPlan.LOW_RISK;
      ctx.session.route = 'depositRequestInProgress';
    } else if (callbackData === 'cancel') {
      await handleStop(ctx, messageIds);
    } else if (callbackData === 'high_risk_withdrawal') {
      await promptWithdrawalAmount(ctx, messageIds);
      ctx.session.userPlan = UserPlan.HIGH_RISK;
      ctx.session.route = 'withdrawalRequestInProgress';
    } else if (callbackData === 'medium_risk_withdrawal') {
      await promptWithdrawalAmount(ctx, messageIds);
      ctx.session.userPlan = UserPlan.MEDIUM_RISK;
      ctx.session.route = 'withdrawalRequestInProgress';
    } else if (callbackData === 'low_risk_withdrawal') {
      await promptWithdrawalAmount(ctx, messageIds);
      ctx.session.userPlan = UserPlan.LOW_RISK;
      ctx.session.route = 'withdrawalRequestInProgress';
    } else if (callbackData === 'transaction_history') {
      const transactions = await Transactions.find({
        user_id: userData._id,
        status: { $in: [TransactionStatus.APPROVED, TransactionStatus.PENDING] }
      });
      const result = ['No. \t\t Amount \t\t\t\t     Type \t\t\t\t    Status \t\t\t\t  Date \n'];
      const transactionHistory = [];

      if (transactions.length > 0) {
        let count = 0;
        for (const transaction of transactions) {
          count += 1;
          const statusEmote = transaction.status === TransactionStatus.APPROVED ? '✅' : '⏳';
          const transactionTypeAbbr = transaction.type === TransactionType.DEPOSIT ? 'D' : 'W';
          const newDate = new Date(transaction.createdAt as Date).toLocaleDateString('en-US', { month: '2-digit', year: '2-digit' });
          result.push(
            `${count}. \t\t ${formatNumber(transaction.amount)} \t\t       ${transactionTypeAbbr} \t\t           ${statusEmote} \t\t       ${newDate}`
          );
          transactionHistory.push({ count, transaction });
        }

        let reply = await ctx.reply(result.join('\n'));
        messageIds.push(reply.message_id);
        reply = await ctx.reply('Input a number to access the transaction receipt');
        messageIds.push(reply.message_id);
        ctx.session.transactionHistory = transactionHistory;
        ctx.session.route = 'userTransactionHistory';
      } else {
        const reply = await ctx.reply('No Transactions with us');
        messageIds.push(reply.message_id);
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
    const reply = await ctx.reply('<b>Not a recognised input</b> \nIf you need help, do /start.', { parse_mode: 'HTML' });
    messageIds.push(reply.message_id);
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
});

export { composer };
