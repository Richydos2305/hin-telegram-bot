import { Bot, Keyboard, session } from 'grammy';
import { FileType, SecurityQuestions, TransactionStatus, TransactionType } from '../interfaces/models';
import { MyContext, initial, ROICalcForClient, ROICalcForAdmin } from '../helpers/index';
import { settings } from '../config/application';
import { Users, IUser } from '../models/users';
import { Admins, IAdmin } from '../models/admins';
import { Accounts } from '../models/accounts';
import { Transactions } from '../models/transactions';
import { Quarters } from '../models/quarters';
import { connectMongoDB } from '../database';

let securityQuestion: string;
let answer;
let telegramId;
let username;
let loggedInUser: IUser;
let loggedInAdmin: IAdmin;

connectMongoDB();

export const bot = new Bot<MyContext>(settings.botToken);

const { MOTHER_MAIDEN_NAME, NAME_OF_CITY_YOU_WERE_BORN_IN, NAME_OF_FIRST_PET, NAME_OF_YOUR_PRIMARY_SCHOOL } = SecurityQuestions;
const questions: string[] = [MOTHER_MAIDEN_NAME, NAME_OF_CITY_YOU_WERE_BORN_IN, NAME_OF_FIRST_PET, NAME_OF_YOUR_PRIMARY_SCHOOL];

const buttonRows = questions.map((question) => [Keyboard.text(question)]);
const keyboard = Keyboard.from(buttonRows).resized().oneTime();
const pickSecurityQuestion = '<b>Pick a Security Question for your Account.</b>';

const transactionConfirmationCommand: string[] = [TransactionStatus.APPROVED, TransactionStatus.DENIED];

const transactionConfirmationbuttonRows = transactionConfirmationCommand.map((command) => [Keyboard.text(command)]);
const transactionConfirmationkeyboard = Keyboard.from(transactionConfirmationbuttonRows).resized().oneTime();
const pickTransactionStatus = '<b>Approve or Deny?</b>';

bot.use(session({ initial }));

bot.command('start', async (ctx) => {
  await ctx.reply('Welcome to the HIN bot! Click the menu button to see the list of commands.');
});

bot.command('admin', async (ctx) => {
  const admin = await Admins.findOne({ username: ctx.message?.from.first_name });
  if (admin) {
    console.log(ctx.message?.chat.id);

    await ctx.reply('Input Password');
    loggedInAdmin = admin;
    ctx.session.state = 'adminLoginInProgress';
  } else {
    await ctx.reply('Admin does not exist.');
  }
});

bot.command('transactions', async (ctx) => {
  if (ctx.session.loggedIn && ctx.session.isAdmin) {
    const result = [];
    const modifiedTransactions = [];
    const transactions = await Transactions.find({ status: TransactionStatus.PENDING });
    console.log(transactions);
    if (transactions.length > 0) {
      for (const transaction of transactions) {
        const user = await Users.findById(transaction.user_id).select('username chat_id');
        console.log(user);

        result.push(`${user?.username} - N${transaction.amount} - ${transaction.type}`);
        modifiedTransactions.push({ user, transaction });
      }
      await ctx.reply(result.join('\n'));
      await ctx.reply('Input a username to access their transaction request');
      ctx.session.transactions = modifiedTransactions;
      console.log(modifiedTransactions);
    } else {
      await ctx.reply('No Pending Transactions');
    }
  } else {
    await ctx.reply('Not an Admin. You do not have access to this command');
  }
});

bot.command('register', async (ctx) => {
  await ctx.reply(pickSecurityQuestion, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
  ctx.session.state = 'securityQuestion';
});

bot.command('login', async (ctx) => {
  const user = await Users.findOne({ telegram_id: ctx.message?.from.id });
  if (user) {
    await ctx.reply(user.security_q);
    loggedInUser = user;
    ctx.session.state = 'loginInProgress';
  } else {
    await ctx.reply('User does not exist. Try /register instead.');
  }
});

bot.command('deposit', async (ctx) => {
  if (ctx.session.loggedIn) {
    await ctx.reply('Input amount to deposit in Naira');
    ctx.session.state = 'depositRequestInProgress';
  } else {
    await ctx.reply('You are not logged in. Please /login to perform this action');
  }
});

bot.command('withdraw', async (ctx) => {
  if (ctx.session.loggedIn) {
    await ctx.reply('Input amount to withdraw in Naira');
    ctx.session.state = 'withdrawalRequestInProgress';
  } else {
    await ctx.reply('User does not exist. Please /login to perform this action');
  }
});

bot.on('message', async (ctx) => {
  const { state, loggedIn, isAdmin } = ctx.session;
  const addEntries = async (): Promise<void> => {
    try {
      let startingCapital: number;
      let endingCapital: number = 0;
      let roi = ctx.session.roi;
      let result: number | { finalAmount: number; managementFee: number; newROI: number };

      const users = await Users.find();
      for (const user of users) {
        const account = await Accounts.findOne({ user_id: user._id });
        if (account) {
          startingCapital = account.current_balance;
          if (ctx.session.commissions === false) {
            result = ROICalcForAdmin(roi, startingCapital);
            endingCapital = result;
          } else if (ctx.session.commissions === true) {
            result = ROICalcForClient(roi, startingCapital);
            roi = result.newROI;
            endingCapital = result.finalAmount;
          }
          const quarterRecord = await Quarters.create({
            user_id: user._id,
            account_id: account._id,
            year: ctx.session.year,
            quarter: ctx.session.quarter,
            roi: roi / 100,
            commission: ctx.session.commissions,
            starting_capital: startingCapital,
            ending_capital: endingCapital
          });

          if (quarterRecord) {
            account.current_balance = quarterRecord.ending_capital;
            account.roi = (account.current_balance - account.initial_balance) / account.initial_balance;
            await account.save();

            await ctx.reply(`Successful Entry for ${user.username}`);
            await bot.api.sendMessage(
              user.chat_id,
              `Quarterly Performance Update for Q${ctx.session.quarter}

              A whole 3 months has passed by and we are done for the quarter.
              Kindly log in and check the latest results.

              Once again, thank you for your patronage.
              `
            );
          }
        }
      }
      await ctx.reply('Check db to confirm. Done');
    } catch (error) {
      console.error(error);
    }
  };

  if (isAdmin) {
    if (state === 'makeentryInProgress') {
      const currentYear = new Date().getFullYear();
      ctx.session.year = currentYear;
      await ctx.reply(`Year automatically set to ${currentYear}. Type anything to continue`);
      ctx.session.state = 'askQuarter';
      return;
    }

    if (state === 'askQuarter') {
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
      return;
    }

    if (state === 'askROI') {
      ctx.session.roi = Number(ctx.message.text);
      if (ctx.session.roi >= -100) {
        await ctx.reply(`Add Commissions? Respond with yes or no`);
        ctx.session.state = 'askCommissions';
        return;
      } else {
        await ctx.reply('Please input a valid ROI amount, between -100% and 200%');
        return;
      }
    }

    if (state === 'askCommissions') {
      if (ctx.message.text && (ctx.message.text.toLowerCase() === 'yes' || ctx.message.text.toLowerCase() === 'y')) {
        ctx.session.commissions = true;
        await addEntries();
        ctx.session.state = null;
        return;
      } else if (ctx.message.text && (ctx.message.text.toLowerCase() === 'no' || ctx.message.text.toLowerCase() === 'n')) {
        ctx.session.commissions = false;
        await addEntries();
        ctx.session.state = null;
        return;
      } else {
        await ctx.reply('Respond with yes or no');
        return;
      }
    }
  }

  if (loggedIn) {
    if (isAdmin) {
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
          const transaction = await Transactions.findByIdAndUpdate(ctx.session.currentTransaction.transaction._id, {
            status: TransactionStatus.APPROVED,
            receipt
          });
          console.log(transaction);
          const account = await Accounts.findOne({ _id: ctx.session.currentTransaction.transaction.account_id });

          if (account) {
            account.current_balance -= ctx.session.currentTransaction.transaction.amount;
            account.initial_balance -= ctx.session.currentTransaction.transaction.amount;
            await account.save();
          }
          await ctx.reply('Okay. Will let the user know it has been approved');
          const user = await Users.findById(ctx.session.currentTransaction.transaction.user_id);
          if (user)
            await bot.api.sendMessage(
              user.chat_id,
              `Your Withdrawal Request of N${ctx.session.currentTransaction.transaction.amount} has been approved. 
          Thank you for your patronage. 
          Lucky you, lol.`
            );
          ctx.session.state = null;
          ctx.session.currentTransaction = null;
          ctx.session.transactions = [];
        } else {
          await ctx.reply(`Send a Valid Receipt`);
        }
      } else if (state === 'transactionRequestInProgress') {
        const account = await Accounts.findOne({ _id: ctx.session.currentTransaction.transaction.account_id });
        const user = await Users.findById(ctx.session.currentTransaction.transaction.user_id);

        if (
          ctx.message.text === TransactionStatus.APPROVED &&
          account &&
          ctx.session.currentTransaction.transaction.type === TransactionType.DEPOSIT
        ) {
          account.current_balance += ctx.session.currentTransaction.transaction.amount;
          account.initial_balance += ctx.session.currentTransaction.transaction.amount;
          await account.save();
          await Transactions.findByIdAndUpdate(ctx.session.currentTransaction.transaction._id, { status: ctx.message.text });
          await ctx.reply('Okay. Will let the user know it has been approved');
          if (user)
            await bot.api.sendMessage(
              user.chat_id,
              `Your Deposit Request of N${ctx.session.currentTransaction.transaction.amount} has been approved. 
          Thank you for your patronage. 
          Good luck in the next quarter, lol.`
            );
          ctx.session.state = null;
          ctx.session.currentTransaction = null;
          ctx.session.transactions = [];
        } else if (
          ctx.message.text === TransactionStatus.APPROVED &&
          account &&
          ctx.session.currentTransaction.transaction.type === TransactionType.WITHDRAWAL
        ) {
          await ctx.reply('Okay. Upload the Receipt as a response to this message and the user will be notified');
          ctx.session.state = 'transactionRequestReceiptUpload';
        } else if (
          ctx.message.text === TransactionStatus.DENIED &&
          account &&
          (ctx.session.currentTransaction.transaction.type === TransactionType.WITHDRAWAL ||
            ctx.session.currentTransaction.transaction.type === TransactionType.DEPOSIT)
        ) {
          await Transactions.findByIdAndUpdate(ctx.session.currentTransaction.transaction._id, { status: ctx.message.text });
          await ctx.reply('Okay. Will let the user know it has been denied');
          if (user)
            await bot.api.sendMessage(
              user.chat_id,
              `Your Transaction Request of N${ctx.session.currentTransaction.transaction.amount} has been denied. 
          You must have given us invalid details.`
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
      }
    } else if (state === 'withdrawalRequestInProgress') {
      const amount = ctx.message.text;
      if (amount && !isNaN(Number(amount))) {
        const account = await Accounts.findOne({ user_id: ctx.session.userData._id });
        if (account && Number(amount) <= account.current_balance) {
          await Transactions.create({
            user_id: ctx.session.userData._id,
            account_id: account._id,
            type: TransactionType.WITHDRAWAL,
            amount: Number(amount)
          });
          await ctx.reply(`Okay. Richard or Tolu will reach out to you soon.`);
          await bot.api.sendMessage(
            settings.adminChatId,
            `${ctx.session.userData.username} just made a withdrawal request of N${amount}.
          Kindly use /transactions to confirm this.`
          );
          ctx.session.state = null;
        } else {
          await ctx.reply('Insufficient Balance');
        }
      } else {
        await ctx.reply('Please input a valid amount');
      }
    } else if (state === 'depositRequestInProgress') {
      const amount = ctx.message.text;
      if (amount && !isNaN(Number(amount))) {
        await ctx.reply(`
           Make the transfer of N${amount} to the following account: 
           0021919337 - Access Bank 
           Richard Dosunmu. 
           Attach the receipt as your response to this message.`);
        ctx.session.state = 'depositRequestConfirmation';
        ctx.session.amount = Number(amount);
      } else {
        await ctx.reply('Please input a valid amount');
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
        const user = ctx.session.userData;
        const account = await Accounts.findOne({ user_id: user._id });
        if (account) {
          const transactionRecord = await Transactions.create({
            user_id: user._id,
            account_id: account._id,
            type: TransactionType.DEPOSIT,
            amount: ctx.session.amount,
            receipt
          });
          if (transactionRecord) {
            await ctx.reply(`Successful Deposit Request. Give 1-2 days to reflect.`);
            await bot.api.sendMessage(
              settings.adminChatId,
              `${user.username} just made a deposit request of N${ctx.session.amount}.
            Kindly use /transactions to confirm this.`
            );
            ctx.session.state = null;
            ctx.session.amount = 0;
          }
        }
      } else {
        await ctx.reply(`Send a Valid Receipt`);
      }
    } else {
      await ctx.reply('No Response at the moment');
    }
  } else if (state === 'securityQuestion') {
    const user = await Users.findOne({ telegram_id: ctx.message.from.id });
    if (user) {
      await ctx.reply('User already exists. Try /login instead.');
    } else {
      const selectedQuestion = ctx.message.text;

      if (selectedQuestion && questions.includes(selectedQuestion)) {
        securityQuestion = selectedQuestion;
        await ctx.reply(`So ${ctx.message.text}`);
        ctx.session.state = 'securityAnswer';
      } else {
        await ctx.reply('Please select a valid security question by using the /register command.');
      }
    }
  } else if (state === 'securityAnswer') {
    answer = ctx.message.text as string;
    telegramId = ctx.message.from.id;
    username = ctx.message.from.first_name;
    const chat_id = ctx.message.chat.id;
    const user = await Users.create({ username, telegram_id: telegramId, security_q: securityQuestion, security_a: answer, chat_id });

    if (user) await ctx.reply(`Your details have been taken... Registration complete!`);
    await Accounts.create({ user_id: user._id });
    ctx.session.state = null;
  } else if (state === 'loginInProgress') {
    if (ctx.message.text === loggedInUser.security_a) {
      await ctx.reply('Authentication Successful', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Check Performance', callback_data: 'usercommand1' },
              { text: 'Check Recent Quarter', callback_data: 'usercommand2' }
            ],
            [
              { text: 'Investment Status', callback_data: 'usercommand3' },
              { text: 'Command 4', callback_data: 'command4' }
            ]
          ]
        }
      });
      ctx.session.userData = loggedInUser;
      ctx.session.loggedIn = true;
      ctx.session.state = null;
    } else {
      await ctx.reply('Wrong Answer. Try /login for another attempt');
    }
  } else if (state === 'adminLoginInProgress') {
    if (ctx.message.text === loggedInAdmin.password) {
      await ctx.reply('Admin Authentication Successful. Your available commands are: ', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Make Entry', callback_data: 'command1' },
              { text: 'View Transactions', callback_data: 'command2' }
            ],
            [
              { text: 'Command 3', callback_data: 'command3' },
              { text: 'Command 4', callback_data: 'command4' }
            ]
          ]
        }
      });
      ctx.session.loggedIn = true;
      ctx.session.isAdmin = true;
      ctx.session.state = null;
    } else {
      await ctx.reply('Invalid Password. Try /login or /admin for another attempt');
    }
  } else {
    await ctx.reply(`No action for that response`);
  }
});

bot.on('callback_query', async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  if (callbackData === 'command1') {
    if (ctx.session.isAdmin) {
      ctx.session.state = 'makeentryInProgress';
    } else {
      await ctx.reply('Admin does not exist.');
    }
  } else if (callbackData === 'usercommand1') {
    if (ctx.session.loggedIn) {
      const quarter = await Quarters.find({ user_id: ctx.session.userData._id });
      if (quarter.length > 0) {
        for (let i = 0; i < quarter.length; i++) {
          await ctx.reply(
            `  <b>Investment Summary for Q${quarter[i].quarter} ${quarter[i].year}</b>
  
    💰 Starting Balance: <code>${quarter[i].starting_capital}</code>
    📈 Ending Balance: <code>${quarter[i].ending_capital}</code>
    📊 Return on Investment (ROI): <code>${quarter[i].roi * 100}%</code>
  
    👍 Your investment has grown by ${quarter[i].ending_capital - quarter[i].starting_capital}!
  `,
            {
              parse_mode: 'HTML'
            }
          );
        }
      }
    } else {
      await ctx.reply('User does not exist. Please /login to perform this action');
    }
  } else if (callbackData === 'usercommand2') {
    if (ctx.session.loggedIn) {
      const quarter = await Quarters.findOne({ user_id: ctx.session.userData._id }).limit(1).sort({ updatedAt: -1 });
      if (quarter) {
        await ctx.reply(
          `
    📊 Investment Update for quarter ${quarter.quarter} 📊
  
    💰 Starting Balance: <code>${quarter.starting_capital}</code>
    📈 Ending Balance: <code>${quarter.ending_capital}</code>
    📊 Return on Investment (ROI): <code>${quarter.roi * 100}%</code>
  
    🎉 Congratulations! Your investment has grown by ${quarter.ending_capital - quarter.starting_capital}!
  `,
          {
            parse_mode: 'HTML'
          }
        );
      }
    } else {
      await ctx.reply('User does not exist. Please /login to perform this action');
    }
  } else if (callbackData === 'usercommand3') {
    if (ctx.session.loggedIn) {
      const account = await Accounts.findOne({ user_id: ctx.session.userData._id });
      if (account) {
        await ctx.reply(
          `<b>Investment Summary</b>

  \ud83d\udcb0 Initial Investment: <code>${account.initial_balance}</code>
  📈 Current Balance: <code>${account.current_balance}</code>
  📊 Return on Investment (ROI): <code>${account.roi * 100}%</code>
  <i>\ud83d\udc4d Your investment has grown by ${account.current_balance - account.initial_balance}!</i>`,
          {
            parse_mode: 'HTML'
          }
        );
      }
    } else {
      await ctx.reply('User does not exist. Please /login to perform this action');
    }
  }
});
