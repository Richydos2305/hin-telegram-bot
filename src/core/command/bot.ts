import { Bot, session, Composer } from 'grammy';
import { Router } from '@grammyjs/router';
import { FileType, TransactionStatus, TransactionType } from '../interfaces/models';
import { MyContext, formatNumber, initial, makeAnEntry } from '../helpers/index';
import { settings } from '../config/application';
import { Users } from '../models/users';
import { Accounts } from '../models/accounts';
import { ITransactions, Transactions } from '../models/transactions';
import { Quarters } from '../models/quarters';
import { handleStart } from './start';
import { handleAdmin, pickTransactionStatus, transactionConfirmationkeyboard } from './admin';
import { handleRegister, questions } from './register';
import { handleLogin } from './login';
import { handleDeposit } from './deposit';
import { handleWithdrawal } from './withdraw';

// let securityQuestion: string;
// let answer;
// let telegramId;
// let username;
// let loggedInUser: IUser;
// let loggedInAdmin: IAdmin;

export const bot = new Bot<MyContext>(settings.botToken);
const router = new Router<MyContext>((ctx) => {
  const messageText = ctx.message?.text;

  if (messageText === '/start') {
    return 'start';
  } else if (messageText === '/login') {
    return 'login';
  } else if (messageText === '/deposit') {
    return 'deposit';
  } else if (messageText === '/withdraw') {
    return 'withdraw';
  } else {
    ctx.reply('No Response for that command');
    console.log(messageText);
  }
});

// const { MOTHER_MAIDEN_NAME, NAME_OF_CITY_YOU_WERE_BORN_IN, NAME_OF_FIRST_PET, NAME_OF_YOUR_PRIMARY_SCHOOL } = SecurityQuestions;
// const questions: string[] = [MOTHER_MAIDEN_NAME, NAME_OF_CITY_YOU_WERE_BORN_IN, NAME_OF_FIRST_PET, NAME_OF_YOUR_PRIMARY_SCHOOL];

// const buttonRows = questions.map((question) => [Keyboard.text(question)]);
// const keyboard = Keyboard.from(buttonRows).resized().oneTime();
// const pickSecurityQuestion = '<b>Pick a Security Question for your Account.</b>';

// const transactionConfirmationCommand: string[] = [TransactionStatus.APPROVED, TransactionStatus.DENIED];

// const transactionConfirmationbuttonRows = transactionConfirmationCommand.map((command) => [Keyboard.text(command)]);
// const transactionConfirmationkeyboard = Keyboard.from(transactionConfirmationbuttonRows).resized().oneTime();
// const pickTransactionStatus = '<b>Approve or Deny?</b>';

bot.use(session({ initial }));
bot.use(router);

const startComposer = new Composer<MyContext>();
startComposer.command('start', handleStart);

const adminComposer = new Composer<MyContext>();
adminComposer.command('admin', handleAdmin);
adminComposer.on('message', async (ctx) => {
  const { state, userData, isAdmin, currentTransaction } = ctx.session;
  if (!isAdmin) {
    if (ctx.message.text === userData.password) {
      await ctx.reply('Admin Authentication Successful. Your available commands are: ', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Make Entry', callback_data: 'make_entry' },
              { text: 'View Transactions', callback_data: 'view_transactions' }
            ],
            [
              { text: 'Command 3', callback_data: 'command3' },
              { text: 'Command 4', callback_data: 'command4' }
            ]
          ]
        }
      });
      ctx.session.isAdmin = true;
      ctx.session.state = null;
    } else {
      await ctx.reply('Invalid Password. Try /admin for another attempt');
      ctx.session.userData = null;
    }
  } else {
    if (state === 'transactionRequestReceiptUpload') {
      let receipt: { file: string; type: FileType } | null = null;
      if (ctx.message.photo) {
        receipt = {
          file: ctx.message.photo[0].file_id,
          type: FileType.PHOTO
        };
      } else if (ctx.message.document) {
        receipt = {
          file: ctx.message.document.file_id,
          type: FileType.DOCUMENT
        };
      }
      if (receipt) {
        await Transactions.findByIdAndUpdate(currentTransaction.transaction._id, {
          status: TransactionStatus.APPROVED,
          receipt
        });
        const account = await Accounts.findOne({ _id: currentTransaction.transaction.account_id });

        if (account) {
          account.current_balance -= currentTransaction.transaction.amount;
          account.initial_balance -= currentTransaction.transaction.amount;
          await account.save();
        }
        await ctx.reply('Okay. Will let the user know it has been approved');
        const user = await Users.findById(currentTransaction.transaction.user_id);
        if (user)
          await bot.api.sendMessage(
            user.chat_id,
            `**Withdrawal Approved!** 🎉\n\nYour Withdrawal Request of ₦${formatNumber(currentTransaction.transaction.amount)} has been approved.\n\nThank you for your patronage! We appreciate your business. 😊`
          );
        ctx.session.state = null;
        ctx.session.currentTransaction = null;
        ctx.session.transactions = [];
      } else {
        await ctx.reply(`**Invalid Receipt** 🚫\n\nPlease send a valid receipt to proceed.'`);
      }
    } else if (state === 'transactionRequestInProgress') {
      const account = await Accounts.findOne({ _id: currentTransaction.transaction.account_id });
      const user = await Users.findById(currentTransaction.transaction.user_id);
      console.log(`Transaction Status: ${ctx.message.text} Current Transaction: ${currentTransaction}`);

      if (ctx.message.text === TransactionStatus.APPROVED && account && currentTransaction.transaction.type === TransactionType.DEPOSIT) {
        account.current_balance += currentTransaction.transaction.amount;
        account.initial_balance += currentTransaction.transaction.amount;
        await account.save();
        await Transactions.findByIdAndUpdate(currentTransaction.transaction._id, { status: ctx.message.text });
        await ctx.reply('Okay. Will let the user know it has been approved');
        if (user)
          await bot.api.sendMessage(
            user.chat_id,
            `**Deposit Approved!** 📈\n\nYour Deposit Request of ₦${formatNumber(currentTransaction.transaction.amount)} has been approved. Thank you for choosing us! We wish you continued success. 🙏`
          );
        ctx.session.state = null;
        ctx.session.currentTransaction = null;
        ctx.session.transactions = [];
      } else if (ctx.message.text === TransactionStatus.APPROVED && account && currentTransaction.transaction.type === TransactionType.WITHDRAWAL) {
        await ctx.reply('Okay. Upload the Receipt as a response to this message and the user will be notified');
        ctx.session.state = 'transactionRequestReceiptUpload';
      } else if (
        ctx.message.text === TransactionStatus.DENIED &&
        account &&
        (currentTransaction.transaction.type === TransactionType.WITHDRAWAL || currentTransaction.transaction.type === TransactionType.DEPOSIT)
      ) {
        await Transactions.findByIdAndUpdate(currentTransaction.transaction._id, { status: ctx.message.text });
        await ctx.reply('Okay. Will let the user know it has been denied');
        if (user)
          await bot.api.sendMessage(
            user.chat_id,
            `**Transaction Denied!** 🚫\n\nUnfortunately, your transaction request of ₦${formatNumber(currentTransaction.transaction.amount)} has been denied.\n\nPlease review and correct the details you provided, as they may be invalid. 📝`
          );
      }
    } else if (ctx.session.transactions.length > 0) {
      const username = ctx.message.text;
      const transactions = ctx.session.transactions;
      const userTransaction = transactions.find((obj) => obj.user.username === username);
      if (userTransaction && userTransaction.transaction.type === TransactionType.DEPOSIT) {
        if (userTransaction.transaction.receipt.type === FileType.DOCUMENT) {
          await ctx.replyWithDocument(userTransaction.transaction.receipt.file, { caption: 'Here is the receipt' });
        } else if (userTransaction.transaction.receipt.type === FileType.PHOTO) {
          await ctx.replyWithPhoto(userTransaction.transaction.receipt.file, { caption: 'Here is the receipt' });
        }
      }
      await ctx.reply(pickTransactionStatus, {
        parse_mode: 'HTML',
        reply_markup: transactionConfirmationkeyboard
      });
      ctx.session.currentTransaction = userTransaction;
      ctx.session.state = 'transactionRequestInProgress';
    } else if (state === 'askROI') {
      ctx.session.roi = Number(ctx.message.text);
      if (ctx.session.roi >= -100) {
        await ctx.reply(`Add Commissions? Respond with yes or no`);
        ctx.session.state = 'askCommissions';
      } else {
        await ctx.reply('Please input a valid ROI amount, between -100% and 200%');
      }
    } else if (state === 'askCommissions') {
      const { message } = ctx;
      if (message.text && (message.text.toLowerCase() === 'yes' || message.text.toLowerCase() === 'y')) {
        ctx.session.commissions = true;
        await makeAnEntry(ctx);
        ctx.session.state = null;
      } else if (message.text && (message.text.toLowerCase() === 'no' || message.text.toLowerCase() === 'n')) {
        ctx.session.commissions = false;
        await makeAnEntry(ctx);
        ctx.session.state = null;
      } else {
        await ctx.reply('Respond with yes or no');
      }
    }
  }
});
adminComposer.on('callback_query', async (ctx) => {
  const { isAdmin } = ctx.session;
  if (isAdmin) {
    const callbackData = ctx.callbackQuery.data;
    if (callbackData === 'make_entry') {
      const currentYear = new Date().getFullYear();
      ctx.session.year = currentYear;
      await ctx.reply(`Year automatically set to ${currentYear}.`);

      const lastQuarterEntry = await Quarters.findOne().limit(1).sort({ createdAt: -1 });
      if (lastQuarterEntry && lastQuarterEntry.quarter < 4) {
        ctx.session.quarter = lastQuarterEntry.quarter + 1;
      } else if (lastQuarterEntry && lastQuarterEntry.quarter === 4) {
        ctx.session.quarter = 1;
      } else {
        ctx.session.quarter = 1;
      }

      await ctx.reply(`Quarter automatically set to Q${ctx.session.quarter}.`);
      await ctx.reply(`Input quarters ROI`);
      ctx.session.state = 'askROI';
    } else if (callbackData === 'view_transactions') {
      const result = [];
      const modifiedTransactions = [];
      const transactions = await Transactions.find({ status: TransactionStatus.PENDING });
      console.log(`Pending Transactions: ${transactions}`);

      if (transactions.length > 0) {
        for (const transaction of transactions) {
          const user = await Users.findById(transaction.user_id).select('username chat_id');
          result.push(`${user?.username} - ${formatNumber(transaction.amount)} - ${transaction.type}`);
          modifiedTransactions.push({ user, transaction });
        }

        await ctx.reply(result.join('\n'));
        await ctx.reply('Input a username to access their transaction request');
        ctx.session.transactions = modifiedTransactions;
        console.log(`Modified Pending Transactions: ${modifiedTransactions}`);
      } else {
        await ctx.reply('No Pending Transactions');
      }
    }
  } else {
    await ctx.reply('Not an Admin. 🚫 You do not have access to this command');
  }
});

const registerComposer = new Composer<MyContext>();
registerComposer.command('register', handleRegister);
registerComposer.on('message', async (ctx) => {
  const { state, securityQuestion } = ctx.session;
  const { message } = ctx;
  if (state === 'securityQuestion') {
    const user = await Users.findOne({ telegram_id: message.from.id });
    if (user) {
      await ctx.reply('**User Already Exists** 🚫\n\nYou already have an account. Please use the /login command to access it.');
    } else {
      const selectedQuestion = message.text;

      if (selectedQuestion && questions.includes(selectedQuestion)) {
        ctx.session.securityQuestion = selectedQuestion;
        await ctx.reply(`So ${message.text}`);
        ctx.session.state = 'securityAnswer';
      } else {
        await ctx.reply('**Invalid Security Question** 📝\n\nPlease select a valid security question using the /register command.');
      }
    }
  } else if (state === 'securityAnswer') {
    const answer = message.text as string;
    const telegramId: number = message.from.id;
    const username: string = message.from.first_name;
    const chat_id = message.chat.id;
    const user = await Users.create({ username, telegram_id: telegramId, security_q: securityQuestion, security_a: answer, chat_id });

    if (user)
      await ctx.reply(
        `**Registration Successful! 🎉**\n\nYour details have been successfully registered. You can now use the /login command to access your account.`
      );
    await Accounts.create({ user_id: user._id });
    ctx.session.state = null;
  }
});

const loginComposer = new Composer<MyContext>();
loginComposer.command('login', handleLogin);
loginComposer.on('message', async (ctx) => {
  const { state, userData } = ctx.session;
  if (state === 'loginInProgress') {
    if (ctx.message.text === userData.security_a) {
      await ctx.reply('Authentication Successful', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Check Performance', callback_data: 'check_performance' },
              { text: 'Check Recent Quarter', callback_data: 'recent_quarter' }
            ],
            [
              { text: 'Investment Status', callback_data: 'investment_status' },
              { text: 'Command 4', callback_data: 'command4' }
            ]
          ]
        }
      });

      ctx.session.loggedIn = true;
      ctx.session.state = null;
    } else {
      ctx.session.userData = null;
      await ctx.reply(`**Incorrect Answer** 🚫\n\nSorry, that's not correct. Please try again using the /login command.`);
    }
  }
});
loginComposer.on('callback_query', async (ctx) => {
  const { loggedIn, userData } = ctx.session;
  if (loggedIn) {
    const callbackData = ctx.callbackQuery.data;
    if (callbackData === 'check_performance') {
      await ctx.reply('Performance Summary');
      const quarter = await Quarters.find({ user_id: userData._id });
      if (quarter) {
        for (let i = 0; i < quarter.length; i++) {
          await ctx.reply(
            `  <b>Investment Summary for Q${quarter[i].quarter} in ${quarter[i].year}</b>

    💰 Starting Balance: <code>${formatNumber(quarter[i].starting_capital)}</code>
    📈 Ending Balance: <code>${formatNumber(quarter[i].ending_capital)}</code>
    📊 Return on Investment (ROI): <code>${quarter[i].roi * 100}%</code>

    👍 Your investment has grown by ${formatNumber(quarter[i].ending_capital - quarter[i].starting_capital)}!
  `,
            {
              parse_mode: 'HTML'
            }
          );
        }
      }
    } else if (callbackData === 'recent_quarter') {
      const quarter = await Quarters.findOne({ user_id: userData._id }).limit(1).sort({ updatedAt: -1 });
      if (quarter) {
        await ctx.reply(
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
          await ctx.reply(
            `<b>Investment Summary</b>

    \ud83d\udcb0 Initial Investment: <code>${formatNumber(account.initial_balance)}</code>
    📈 Current Balance: <code>${formatNumber(account.current_balance)}</code>
    📊 You have withdrawn a total of: <code>${formatNumber(totalWithdrawals)}</code>
    <i>\ud83d\udc4d Your investment has grown by ${formatNumber(account.current_balance - account.initial_balance)}!</i>`,
            {
              parse_mode: 'HTML'
            }
          );
        } else {
          await ctx.reply(
            `<b>Investment Summary</b>

    \ud83d\udcb0 Initial Investment: <code>${formatNumber(account.initial_balance)}</code>
    📈 Current Balance: <code>${formatNumber(account.current_balance)}</code>
    <i>\ud83d\udc4d Your investment has grown by ${formatNumber(account.current_balance - account.initial_balance)}!</i>`,
            {
              parse_mode: 'HTML'
            }
          );
        }
      }
    }
  } else {
    await ctx.reply('You are not logged in. 🚫 Please /login to perform this action');
  }
});

const depositComposer = new Composer<MyContext>();
depositComposer.command('deposit', handleDeposit);
depositComposer.on('message', async (ctx) => {
  const { state, userData } = ctx.session;
  if (state === 'depositRequestInProgress') {
    const amount = ctx.message.text;
    if (amount && !isNaN(Number(amount))) {
      await ctx.reply(`**Confirm Deposit**
        💸\n\nPlease make a transfer of ₦${formatNumber(Number(amount))} to the following account: \n\n0021919337 - Access Bank
        \nRichard Dosunmu.\n\nAttach the receipt as your response to this message. 📝`);
      ctx.session.state = 'depositRequestConfirmation';
      ctx.session.amount = Number(amount);
    } else {
      await ctx.reply('**Invalid Amount** 📝\n\nPlease enter a valid amount to proceed.');
    }
  } else if (state === 'depositRequestConfirmation') {
    let receipt: {
      file: string;
      type: FileType;
    } | null = null;
    if (ctx.message.photo) {
      receipt = {
        file: ctx.message.photo[0].file_id,
        type: FileType.PHOTO
      };
    } else if (ctx.message.document) {
      receipt = {
        file: ctx.message.document.file_id,
        type: FileType.DOCUMENT
      };
    }
    if (receipt) {
      const account = await Accounts.findOne({ user_id: userData._id });
      if (account) {
        const transactionRecord = await Transactions.create({
          user_id: userData._id,
          account_id: account._id,
          type: TransactionType.DEPOSIT,
          amount: ctx.session.amount,
          receipt
        });
        if (transactionRecord) {
          await ctx.reply(`**Deposit Request!**
            📈\n\nYour deposit request has been successfully processed.
            Please allow 1-2 business days for the funds to reflect in your account. 🕒`);
          await bot.api.sendMessage(
            settings.adminChatId,
            `${userData.username} just made a deposit request of ${formatNumber(ctx.session.amount)}.
          Kindly use /transactions to confirm this.`
          );
          ctx.session.state = null;
          ctx.session.amount = 0;
        }
      }
    } else {
      await ctx.reply(`**Invalid Receipt** 🚫\n\nPlease send a valid receipt to proceed.`);
    }
  }
});

const withdrawalComposer = new Composer<MyContext>();
withdrawalComposer.command('withdraw', handleWithdrawal);
withdrawalComposer.on('message', async (ctx) => {
  const { state, userData } = ctx.session;
  if (state === 'withdrawalRequestInProgress') {
    const amount = ctx.message.text;
    if (amount && !isNaN(Number(amount))) {
      const account = await Accounts.findOne({ user_id: userData._id });
      if (account && Number(amount) <= account.current_balance) {
        await Transactions.create({
          user_id: userData._id,
          account_id: account._id,
          type: TransactionType.WITHDRAWAL,
          amount: Number(amount)
        });
        await ctx.reply(`Okay. Richard or Tolu will reach out to you soon.`);
        await bot.api.sendMessage(
          settings.adminChatId,
          `${userData.username} just made a withdrawal request of N${formatNumber(Number(amount))}.
        Kindly use /transactions to confirm this.`
        );
        ctx.session.state = null;
      } else {
        await ctx.reply(`**Insufficient Funds** 🚫\n\nYou don't have enough balance to complete this transaction.`);
      }
    } else {
      await ctx.reply('**Invalid Amount** 📝\n\nPlease enter a valid amount to proceed.');
    }
  }
});

bot.use(startComposer);
bot.use(adminComposer);
bot.use(registerComposer);
bot.use(loginComposer);
bot.use(depositComposer);
bot.use(withdrawalComposer);

router.route('start', startComposer);
router.route('login', loginComposer);
router.route('deposit', depositComposer);
router.route('withdraw', withdrawalComposer);

// bot.command('start', async (ctx) => {
//   await ctx.reply('**Welcome to HIN Bot!** 🤖\n\nClick the menu button to explore our features and commands 📚');
// });

// bot.command('admin', async (ctx) => {
//   const admin = await Admins.findOne({ username: ctx.message?.from.first_name });
//   if (admin) {
//     console.log(ctx.message?.chat.id);

//     await ctx.reply('**Enter Password 🔒**\n\nPlease type your password to proceed...', { parse_mode: 'Markdown' });
//     loggedInAdmin = admin;
//     ctx.session.state = 'adminLoginInProgress';
//   } else {
//     await ctx.reply('**Admin Not Found** 🚫\n\nPlease check your credentials and try again.');
//   }
// });

// bot.command('register', async (ctx) => {
//   await ctx.reply(pickSecurityQuestion, {
//     parse_mode: 'HTML',
//     reply_markup: keyboard
//   });
//   ctx.session.state = 'securityQuestion';
// });

// bot.command('login', async (ctx) => {
//   const user = await Users.findOne({ telegram_id: ctx.message?.from.id });
//   if (user) {
//     await ctx.reply(user.security_q);
//     loggedInUser = user;
//     ctx.session.state = 'loginInProgress';
//   } else {
//     await ctx.reply('User does not exist.🚫\n\n Try /register instead.');
//   }
// });

// bot.command('deposit', async (ctx) => {
//   if (ctx.session.loggedIn) {
//     await ctx.reply('Input amount to deposit in ₦ (Naira)');
//     ctx.session.state = 'depositRequestInProgress';
//   } else {
//     await ctx.reply('**Login Required** 🔒\n\nUse /login to access this feature.');
//   }
// });

// bot.command('withdraw', async (ctx) => {
//   if (ctx.session.loggedIn) {
//     await ctx.reply('**Withdrawal Amount** 💸\n\nPlease enter the amount you want to withdraw in ₦ (Naira)');
//     ctx.session.state = 'withdrawalRequestInProgress';
//   } else {
//     await ctx.reply('User does not exist.🚫\n\n Please /login to perform this action');
//   }
// });

// bot.on('message', async (ctx) => {
//   const { state, loggedIn, isAdmin } = ctx.session;
//   const addEntries = async (): Promise<void> => {
//     try {
//       let startingCapital: number;
//       let endingCapital: number = 0;
//       let result: number | { finalAmount: number; managementFee: number; newROI: number };

//       const users = await Users.find();
//       for (const user of users) {
//         const account = await Accounts.findOne({ user_id: user._id });
//         let roi = ctx.session.roi;
//         if (account) {
//           startingCapital = account.current_balance;
//           if (ctx.session.commissions === false) {
//             result = ROICalcForAdmin(roi, startingCapital);
//             endingCapital = result;
//           } else if (ctx.session.commissions === true) {
//             result = ROICalcForClient(roi, startingCapital);
//             roi = result.newROI;
//             endingCapital = result.finalAmount;
//           }
//           const quarterRecord = await Quarters.create({
//             user_id: user._id,
//             account_id: account._id,
//             year: ctx.session.year,
//             quarter: ctx.session.quarter,
//             roi: roi / 100,
//             commission: ctx.session.commissions,
//             starting_capital: parseFloat(startingCapital.toFixed(2)),
//             ending_capital: parseFloat(endingCapital.toFixed(2))
//           });

//           if (quarterRecord) {
//             account.current_balance = quarterRecord.ending_capital;
//             account.roi = (account.current_balance - account.initial_balance) / account.initial_balance;
//             await account.save();

//             await ctx.reply(`Successful Entry for ${user.username}`);
//             await bot.api.sendMessage(
//               user.chat_id,
//               `Quarterly Performance Update for Q${ctx.session.quarter}

//               A whole 3 months has passed by and we are done for the quarter.
//               Kindly log in and check the latest results.

//               Once again, thank you for your patronage.
//               `
//             );
//           }
//         }
//       }
//       await ctx.reply('Check db to confirm. Done');
//     } catch (error) {
//       console.error(error);
//     }
//   };

//   if (isAdmin) {
//     if (state === 'askROI') {
//       ctx.session.roi = Number(ctx.message.text);
//       if (ctx.session.roi >= -100) {
//         await ctx.reply(`Add Commissions? Respond with yes or no`);
//         ctx.session.state = 'askCommissions';
//         return;
//       } else {
//         await ctx.reply('Please input a valid ROI amount, between -100% and 200%');
//         return;
//       }
//     }

//     if (state === 'askCommissions') {
//       if (ctx.message.text && (ctx.message.text.toLowerCase() === 'yes' || ctx.message.text.toLowerCase() === 'y')) {
//         ctx.session.commissions = true;
//         await addEntries();
//         ctx.session.state = null;
//         return;
//       } else if (ctx.message.text && (ctx.message.text.toLowerCase() === 'no' || ctx.message.text.toLowerCase() === 'n')) {
//         ctx.session.commissions = false;
//         await addEntries();
//         ctx.session.state = null;
//         return;
//       } else {
//         await ctx.reply('Respond with yes or no');
//         return;
//       }
//     }
//   }

//   if (loggedIn) {
//     if (isAdmin) {
//       if (state === 'transactionRequestReceiptUpload') {
//         let receipt: { file: string; type: FileType } | null = null;
//         if (ctx.message.photo) {
//           receipt = {
//             file: ctx.message.photo[0].file_id,
//             type: FileType.PHOTO
//           };
//         } else if (ctx.message.document) {
//           receipt = {
//             file: ctx.message.document.file_id,
//             type: FileType.DOCUMENT
//           };
//         }
//         if (receipt) {
//           const transaction = await Transactions.findByIdAndUpdate(ctx.session.currentTransaction.transaction._id, {
//             status: TransactionStatus.APPROVED,
//             receipt
//           });
//           console.log(transaction);
//           const account = await Accounts.findOne({ _id: ctx.session.currentTransaction.transaction.account_id });

//           if (account) {
//             account.current_balance -= ctx.session.currentTransaction.transaction.amount;
//             account.initial_balance -= ctx.session.currentTransaction.transaction.amount;
//             await account.save();
//           }
//           await ctx.reply('Okay. Will let the user know it has been approved');
//           const user = await Users.findById(ctx.session.currentTransaction.transaction.user_id);
//           if (user)
//             await bot.api.sendMessage(
//               user.chat_id,
//               `**Withdrawal Approved!** 🎉\n\nYour Withdrawal Request of ₦${formatNumber(ctx.session.currentTransaction.transaction.amount)} has been approved.\n\nThank you for your patronage! We appreciate your business. 😊`
//             );
//           ctx.session.state = null;
//           ctx.session.currentTransaction = null;
//           ctx.session.transactions = [];
//         } else {
//           await ctx.reply(`**Invalid Receipt** 🚫\n\nPlease send a valid receipt to proceed.'`);
//         }
//       } else if (state === 'transactionRequestInProgress') {
//         const account = await Accounts.findOne({ _id: ctx.session.currentTransaction.transaction.account_id });
//         const user = await Users.findById(ctx.session.currentTransaction.transaction.user_id);

//         if (
//           ctx.message.text === TransactionStatus.APPROVED &&
//           account &&
//           ctx.session.currentTransaction.transaction.type === TransactionType.DEPOSIT
//         ) {
//           account.current_balance += ctx.session.currentTransaction.transaction.amount;
//           account.initial_balance += ctx.session.currentTransaction.transaction.amount;
//           await account.save();
//           await Transactions.findByIdAndUpdate(ctx.session.currentTransaction.transaction._id, { status: ctx.message.text });
//           await ctx.reply('Okay. Will let the user know it has been approved');
//           if (user)
//             await bot.api.sendMessage(
//               user.chat_id,
//               `**Deposit Approved!** 📈\n\nYour Deposit Request of ₦${formatNumber(ctx.session.currentTransaction.transaction.amount)} has been approved. Thank you for choosing us! We wish you continued success. 🙏`
//             );
//           ctx.session.state = null;
//           ctx.session.currentTransaction = null;
//           ctx.session.transactions = [];
//         } else if (
//           ctx.message.text === TransactionStatus.APPROVED &&
//           account &&
//           ctx.session.currentTransaction.transaction.type === TransactionType.WITHDRAWAL
//         ) {
//           await ctx.reply('Okay. Upload the Receipt as a response to this message and the user will be notified');
//           ctx.session.state = 'transactionRequestReceiptUpload';
//         } else if (
//           ctx.message.text === TransactionStatus.DENIED &&
//           account &&
//           (ctx.session.currentTransaction.transaction.type === TransactionType.WITHDRAWAL ||
//             ctx.session.currentTransaction.transaction.type === TransactionType.DEPOSIT)
//         ) {
//           await Transactions.findByIdAndUpdate(ctx.session.currentTransaction.transaction._id, { status: ctx.message.text });
//           await ctx.reply('Okay. Will let the user know it has been denied');
//           if (user)
//             await bot.api.sendMessage(
//               user.chat_id,
//               `**Transaction Denied!** 🚫\n\nUnfortunately, your transaction request of ₦${formatNumber(ctx.session.currentTransaction.transaction.amount)} has been denied.\n\nPlease review and correct the details you provided, as they may be invalid. 📝`
//             );
//         }
//       } else if (ctx.session.transactions.length > 0) {
//         const username = ctx.message.text;
//         const transactions = ctx.session.transactions;
//         const userTransaction = transactions.find((obj) => obj.user.username === username);
//         if (userTransaction && userTransaction.transaction.type === TransactionType.DEPOSIT) {
//           if (userTransaction.transaction.receipt.type === FileType.DOCUMENT) {
//             await ctx.replyWithDocument(userTransaction.transaction.receipt.file, { caption: 'Here is the receipt' });
//           } else if (userTransaction.transaction.receipt.type === FileType.PHOTO) {
//             await ctx.replyWithPhoto(userTransaction.transaction.receipt.file, { caption: 'Here is the receipt' });
//           }
//         }
//         await ctx.reply(pickTransactionStatus, {
//           parse_mode: 'HTML',
//           reply_markup: transactionConfirmationkeyboard
//         });
//         ctx.session.currentTransaction = userTransaction;
//         ctx.session.state = 'transactionRequestInProgress';
//       }
//     } else if (state === 'withdrawalRequestInProgress') {
//       const amount = ctx.message.text;
//       if (amount && !isNaN(Number(amount))) {
//         const account = await Accounts.findOne({ user_id: ctx.session.userData._id });
//         if (account && Number(amount) <= account.current_balance) {
//           await Transactions.create({
//             user_id: ctx.session.userData._id,
//             account_id: account._id,
//             type: TransactionType.WITHDRAWAL,
//             amount: Number(amount)
//           });
//           await ctx.reply(`Okay. Richard or Tolu will reach out to you soon.`);
//           await bot.api.sendMessage(
//             settings.adminChatId,
//             `${ctx.session.userData.username} just made a withdrawal request of N${formatNumber(Number(amount))}.
//           Kindly use /transactions to confirm this.`
//           );
//           ctx.session.state = null;
//         } else {
//           await ctx.reply(`**Insufficient Funds** 🚫\n\nYou don't have enough balance to complete this transaction.`);
//         }
//       } else {
//         await ctx.reply('**Invalid Amount** 📝\n\nPlease enter a valid amount to proceed.');
//       }
//     } else if (state === 'depositRequestInProgress') {
//       const amount = ctx.message.text;
//       if (amount && !isNaN(Number(amount))) {
//         await ctx.reply(`**Confirm Deposit**
//           💸\n\nPlease make a transfer of ₦${formatNumber(Number(amount))} to the following account: \n\n0021919337 - Access Bank
//           \nRichard Dosunmu.\n\nAttach the receipt as your response to this message. 📝`);
//         ctx.session.state = 'depositRequestConfirmation';
//         ctx.session.amount = Number(amount);
//       } else {
//         await ctx.reply('**Invalid Amount** 📝\n\nPlease enter a valid amount to proceed.');
//       }
//     } else if (state === 'depositRequestConfirmation') {
//       let receipt: {
//         file: string;
//         type: FileType;
//       } | null = null;
//       if (ctx.message.photo) {
//         receipt = {
//           file: ctx.message.photo[0].file_id,
//           type: FileType.PHOTO
//         };
//       } else if (ctx.message.document) {
//         receipt = {
//           file: ctx.message.document.file_id,
//           type: FileType.DOCUMENT
//         };
//       }
//       if (receipt) {
//         const user = ctx.session.userData;
//         const account = await Accounts.findOne({ user_id: user._id });
//         if (account) {
//           const transactionRecord = await Transactions.create({
//             user_id: user._id,
//             account_id: account._id,
//             type: TransactionType.DEPOSIT,
//             amount: ctx.session.amount,
//             receipt
//           });
//           if (transactionRecord) {
//             await ctx.reply(`**Deposit Request!**
//               📈\n\nYour deposit request has been successfully processed.
//               Please allow 1-2 business days for the funds to reflect in your account. 🕒`);
//             await bot.api.sendMessage(
//               settings.adminChatId,
//               `${user.username} just made a deposit request of N${formatNumber(ctx.session.amount)}.
//             Kindly use /transactions to confirm this.`
//             );
//             ctx.session.state = null;
//             ctx.session.amount = 0;
//           }
//         }
//       } else {
//         await ctx.reply(`**Invalid Receipt** 🚫\n\nPlease send a valid receipt to proceed.`);
//       }
//     } else {
//       await ctx.reply('No Response at the moment');
//     }
//   } else if (state === 'securityQuestion') {
//     const user = await Users.findOne({ telegram_id: ctx.message.from.id });
//     if (user) {
//       await ctx.reply('**User Already Exists** 🚫\n\nYou already have an account. Please use the /login command to access it.');
//     } else {
//       const selectedQuestion = ctx.message.text;

//       if (selectedQuestion && questions.includes(selectedQuestion)) {
//         securityQuestion = selectedQuestion;
//         await ctx.reply(`So ${ctx.message.text}`);
//         ctx.session.state = 'securityAnswer';
//       } else {
//         await ctx.reply('**Invalid Security Question** 📝\n\nPlease select a valid security question using the /register command.');
//       }
//     }
//   } else if (state === 'securityAnswer') {
//     answer = ctx.message.text as string;
//     telegramId = ctx.message.from.id;
//     username = ctx.message.from.first_name;
//     const chat_id = ctx.message.chat.id;
//     const user = await Users.create({ username, telegram_id: telegramId, security_q: securityQuestion, security_a: answer, chat_id });

//     if (user)
//       await ctx.reply(
//         `**Registration Successful! 🎉**\n\nYour details have been successfully registered. You can now use the /login command to access your account.`
//       );
//     await Accounts.create({ user_id: user._id });
//     ctx.session.state = null;
//   } else if (state === 'loginInProgress') {
//     if (ctx.message.text === loggedInUser.security_a) {
//       await ctx.reply('Authentication Successful', {
//         reply_markup: {
//           inline_keyboard: [
//             [
//               { text: 'Check Performance', callback_data: 'check_performance' },
//               { text: 'Check Recent Quarter', callback_data: 'recent_quarter' }
//             ],
//             [
//               { text: 'Investment Status', callback_data: 'investment_status' },
//               { text: 'Command 4', callback_data: 'command4' }
//             ]
//           ]
//         }
//       });
//       ctx.session.userData = loggedInUser;
//       ctx.session.loggedIn = true;
//       ctx.session.state = null;
//     } else {
//       await ctx.reply(`**Incorrect Answer** 🚫\n\nSorry, that's not correct. Please try again using the /login command.`);
//     }
//   } else if (state === 'adminLoginInProgress') {
//     if (ctx.message.text === loggedInAdmin.password) {
//       await ctx.reply('Admin Authentication Successful. Your available commands are: ', {
//         reply_markup: {
//           inline_keyboard: [
//             [
//               { text: 'Make Entry', callback_data: 'make_entry' },
//               { text: 'View Transactions', callback_data: 'view_transactions' }
//             ],
//             [
//               { text: 'Command 3', callback_data: 'command3' },
//               { text: 'Command 4', callback_data: 'command4' }
//             ]
//           ]
//         }
//       });
//       ctx.session.loggedIn = true;
//       ctx.session.isAdmin = true;
//       ctx.session.state = null;
//     } else {
//       await ctx.reply('Invalid Password. Try /login or /admin for another attempt');
//     }
//   } else {
//     await ctx.reply(`No action for that response`);
//   }
// });

// bot.on('callback_query', async (ctx) => {
//   const callbackData = ctx.callbackQuery.data;
//   if (callbackData === 'make_entry') {
//     if (ctx.session.isAdmin) {
//       const currentYear = new Date().getFullYear();
//       ctx.session.year = currentYear;
//       await ctx.reply(`Year automatically set to ${currentYear}.`);

//       const lastQuarterEntry = await Quarters.findOne().limit(1).sort({ createdAt: -1 });
//       if (lastQuarterEntry && lastQuarterEntry.quarter < 4) {
//         ctx.session.quarter = lastQuarterEntry.quarter + 1;
//       } else if (lastQuarterEntry && lastQuarterEntry.quarter === 4) {
//         ctx.session.quarter = 1;
//       } else {
//         ctx.session.quarter = 1;
//       }
//       await ctx.reply(`Quarter automatically set to Q${ctx.session.quarter}.`);
//       await ctx.reply(`Input quarters ROI`);
//       ctx.session.state = 'askROI';
//     } else {
//       await ctx.reply('User does not exist. 🚫 Please /login to perform this action');
//     }
//   } else if (callbackData === 'view_transactions') {
//     if (ctx.session.loggedIn && ctx.session.isAdmin) {
//       const result = [];
//       const modifiedTransactions = [];
//       const transactions = await Transactions.find({ status: TransactionStatus.PENDING });
//       console.log(transactions);
//       if (transactions.length > 0) {
//         for (const transaction of transactions) {
//           const user = await Users.findById(transaction.user_id).select('username chat_id');
//           console.log(user);

//           result.push(`${user?.username} - ${formatNumber(transaction.amount)} - ${transaction.type}`);
//           modifiedTransactions.push({ user, transaction });
//         }
//         await ctx.reply(result.join('\n'));
//         await ctx.reply('Input a username to access their transaction request');
//         ctx.session.transactions = modifiedTransactions;
//         console.log(modifiedTransactions);
//       } else {
//         await ctx.reply('No Pending Transactions');
//       }
//     } else {
//       await ctx.reply('Not an Admin. 🚫 You do not have access to this command');
//     }
//   } else if (callbackData === 'check_performance') {
//     if (ctx.session.loggedIn) {
//       await ctx.reply('Performance Summary');
//       const quarter = await Quarters.find({ user_id: ctx.session.userData._id });
//       if (quarter) {
//         for (let i = 0; i < quarter.length; i++) {
//           await ctx.reply(
//             `  <b>Investment Summary for Q${quarter[i].quarter} in ${quarter[i].year}</b>

//     💰 Starting Balance: <code>${formatNumber(quarter[i].starting_capital)}</code>
//     📈 Ending Balance: <code>${formatNumber(quarter[i].ending_capital)}</code>
//     📊 Return on Investment (ROI): <code>${quarter[i].roi * 100}%</code>

//     👍 Your investment has grown by ${formatNumber(quarter[i].ending_capital - quarter[i].starting_capital)}!
//   `,
//             {
//               parse_mode: 'HTML'
//             }
//           );
//         }
//       }
//     } else {
//       await ctx.reply('User does not exist. Please /login to perform this action');
//     }
//   } else if (callbackData === 'recent_quarter') {
//     if (ctx.session.loggedIn) {
//       const quarter = await Quarters.findOne({ user_id: ctx.session.userData._id }).limit(1).sort({ updatedAt: -1 });
//       if (quarter) {
//         await ctx.reply(
//           `
//     📊 <b>Investment Update for quarter ${quarter.quarter}</b> 📊

//     💰 Starting Balance: <code>${formatNumber(quarter.starting_capital)}</code>
//     📈 Ending Balance: <code>${formatNumber(quarter.ending_capital)}</code>
//     📊 Return on Investment (ROI): <code>${quarter.roi * 100}%</code>

//     🎉 Congratulations! Your investment has grown by ${formatNumber(quarter.ending_capital - quarter.starting_capital)}!
//   `,
//           {
//             parse_mode: 'HTML'
//           }
//         );
//       }
//     } else {
//       await ctx.reply('User does not exist. 🚫 Please /login to perform this action');
//     }
//   } else if (callbackData === 'investment_status') {
//     if (ctx.session.loggedIn) {
//       const account = await Accounts.findOne({ user_id: ctx.session.userData._id });
//       const quarter = await Quarters.find({ user_id: ctx.session.userData._id });
//       const withdrawals: ITransactions[] = await Transactions.find({
//         user_id: ctx.session.userData._id,
//         type: TransactionType.WITHDRAWAL,
//         status: TransactionStatus.APPROVED
//       });
//       let accountROI = 0;
//       for (let i = 0; i < quarter.length; i++) {
//         accountROI += quarter[i].roi;
//       }
//       accountROI = accountROI / quarter.length;
//       if (account) {
//         if (withdrawals.length > 0) {
//           let totalWithdrawals: number = 0;
//           for (const transaction of withdrawals) {
//             totalWithdrawals += transaction.amount;
//           }
//           await ctx.reply(
//             `<b>Investment Summary</b>

//     \ud83d\udcb0 Initial Investment: <code>${formatNumber(account.initial_balance)}</code>
//     📈 Current Balance: <code>${formatNumber(account.current_balance)}</code>
//     📊 You have withdrawn a total of: <code>${formatNumber(totalWithdrawals)}</code>
//     <i>\ud83d\udc4d Your investment has grown by ${formatNumber(account.current_balance - account.initial_balance)}!</i>`,
//             {
//               parse_mode: 'HTML'
//             }
//           );
//         } else {
//           await ctx.reply(
//             `<b>Investment Summary</b>

//     \ud83d\udcb0 Initial Investment: <code>${formatNumber(account.initial_balance)}</code>
//     📈 Current Balance: <code>${formatNumber(account.current_balance)}</code>
//     <i>\ud83d\udc4d Your investment has grown by ${formatNumber(account.current_balance - account.initial_balance)}!</i>`,
//             {
//               parse_mode: 'HTML'
//             }
//           );
//         }
//       }
//     } else {
//       await ctx.reply('User does not exist. 🚫 Please /login to perform this action');
//     }
//   }
// });
