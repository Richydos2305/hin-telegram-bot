import { Bot, Keyboard, session } from 'grammy';
import { SecurityQuestions, TransactionType } from '../interfaces/models';
import { MyContext, initial } from '../helpers/index';
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

bot.use(session({ initial }));

bot.command('start', async (ctx) => {
  await ctx.reply('Welcome to the HIN bot! Click the menu button to see the list of commands.');
});

bot.command('admin', async (ctx) => {
  const admin = await Admins.findOne({ username: ctx.message?.from.first_name });
  if (admin) {
    await ctx.reply('Input Password');
    loggedInAdmin = admin;
    ctx.session.state = 'adminLoginInProgress';
  } else {
    await ctx.reply('Admin does not exist.');
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
    await ctx.reply('User does not exist. Please /login to perform this action');
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

  //THIS IS THE FUNCTION FOR THE CALCULATION SO THIS IS WHAT YOU WILL MAINLY BE CHANGING
  const addEntries = async () => {
    try {
      let starting_capital;
      let ending_capital;
      let netProfit;
      let userProfit;
      let userCommissions;
      let users_roi;
      const users = await Users.find();
      for (const user of users) {
        const account = await Accounts.findOne({ user_id: user._id });
        if (account) {
          starting_capital = account.current_balance;
          if(!ctx.session.commissions){
            userProfit = Number(starting_capital) * Number(ctx.session.roi);
          }
          else{
            userProfit = Number(starting_capital) * Number(ctx.session.roi - 0.25);
          }
          if (ctx.session.commissions) {
            userCommissions = Number(userProfit) * (25 / 100);
            netProfit = Number(userProfit) - Number(userCommissions);
            ending_capital = Number(starting_capital) + Number(netProfit);
          }
          else {
            netProfit = Number(userProfit);
            ending_capital = Number(starting_capital) + Number(netProfit);
          }
          users_roi = (netProfit / starting_capital);
          const quarterRecord = await Quarters.create({
            user_id: user._id,
            account_id: account._id,
            year: ctx.session.year,
            quarter: ctx.session.quarter,
            roi: users_roi,
            commission: ctx.session.commissions,
            starting_capital,
            ending_capital
          });
          const userQuarter = await Quarters.find({ user_id: user._id });
          let accountROI = 0;
          for (let i = 0; i < userQuarter.length; i++) {
            accountROI += userQuarter[i].roi
          }
          accountROI = accountROI / userQuarter.length;
          await Accounts.updateOne({ user_id: user._id }, { current_balance: ending_capital, roi: users_roi });

          if (quarterRecord) {
            await ctx.reply(`Successful Entry for ${user.username}`);
          }
        }
      }
      await ctx.reply('Check db to confirm. Done');
    } catch (error) {
      console.error(error);
    }
  }

  if (isAdmin) {
    if (state === 'makeentryInProgress') {
      ctx.session.total_capital = Number(ctx.message.text);
      if (ctx.session.total_capital > 0) {
        ctx.session.state = 'askYear';
        const currentYear = new Date().getFullYear();
        ctx.session.year = currentYear;
        ctx.session.state = 'askQuarter';
        await ctx.reply(`Year automatically set to ${currentYear}. Type next to continue`);
        return;
      } else {
        await ctx.reply('Please input a valid amount');
        return
      }
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
      await ctx.reply(`Quarter automatically set to ${ctx.session.quarter}.`);
      ctx.session.state = 'askROI';
      await ctx.reply(`Input quarters ROI`);
      return;
    }

    if (state === 'askROI') {
      ctx.session.roi = Number(ctx.message.text);
      if (ctx.session.roi >= -1 && ctx.session.roi <= 1) {
        ctx.session.state = 'askCommissions';
        await ctx.reply(`Add Commissions? Respond with yes or no`);
        return;
      } else {
        await ctx.reply('Please input a valid ROI amount, between -1 and 1');
        return;
      }
    }

    if (state === 'askCommissions') {
      if ((ctx.message.text && ctx.message.text.toLowerCase() === 'yes') || ctx.message.text?.toLowerCase() === 'y') {
        ctx.session.commissions = true;
        await addEntries();
        ctx.session.state = null;
        return;
      } else if ((ctx.message.text && ctx.message.text.toLowerCase() === 'no') || ctx.message.text?.toLowerCase() === 'n') {
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
    if (state === 'withdrawalRequestInProgress') {
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
          ctx.session.state = null;
        } else {
          await ctx.reply('Insufficient Balance');
        }
      } else {
        await ctx.reply('Please input a valid amount');
      }
    }

    if (state === 'depositRequestInProgress') {
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
      const receipt = ctx.message.photo ? ctx.message.photo[0].file_id : ctx.message.document?.file_id;
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
            ctx.session.state = null;
            ctx.session.amount = 0;
          }
        }
      } else {
        await ctx.reply(`Send a Valid Receipt`);
      }
    }
    else {
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
    const user = await Users.create({ username, telegram_id: telegramId, security_q: securityQuestion, security_a: answer });

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
              { text: 'Check Recent Quarter', callback_data: 'usercommand2' },
            ],
            [
              { text: 'Investment Status', callback_data: 'usercommand3' },
              { text: 'Command 4', callback_data: 'command4' },
            ],
          ],
        },
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
              { text: 'View Transactions', callback_data: 'command2' },
            ],
            [
              { text: 'Command 3', callback_data: 'command3' },
              { text: 'Command 4', callback_data: 'command4' },
            ],
          ],
        },
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
      await ctx.reply('Input total trading capital at the start of this quarter.');
      ctx.session.state = 'makeentryInProgress';
    } else {
      await ctx.reply('User does not exist. Please /login to perform this action');
    }
  }
  else if (callbackData === 'usercommand1') {
    if (ctx.session.loggedIn) {
      const quarter = await Quarters.find({ user_id: ctx.session.userData._id });
      if (quarter) {
        for (let i = 0; i < quarter.length; i++) {
          await ctx.reply(
            `  <b>Investment Summary for ${quarter[i].quarter}</b>
  
    💰 Starting Balance: <code>${quarter[i].starting_capital}</code>
    📈 Ending Balance: <code>${quarter[i].ending_capital}</code>
    📊 Return on Investment (ROI): <code>${quarter[i].roi * 100}%</code>
  
    👍 Your investment has grown by ${quarter[i].ending_capital - quarter[i].starting_capital}!
  `, {
            parse_mode: 'HTML'
          });
        }
      }
    } else {
      await ctx.reply('User does not exist. Please /login to perform this action');
    }

  }
  else if (callbackData === 'usercommand2') {
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
  `, {
          parse_mode: 'HTML'
        });
      }
    } else {
      await ctx.reply('User does not exist. Please /login to perform this action');
    }
  }
  else if (callbackData === 'usercommand3') {
    if (ctx.session.loggedIn) {
      const account = await Accounts.findOne({ user_id: ctx.session.userData._id });
      const quarter = await Quarters.find({ user_id: ctx.session.userData._id });
      let accountROI = 0;
      for (let i = 0; i < quarter.length; i++) {
        accountROI += quarter[i].roi
      }
      accountROI = accountROI / quarter.length;
      if (account) {
        await ctx.reply(
          `<b>Investment Summary</b>

  \ud83d\udcb0 Initial Investment: <code>${account.initial_balance}</code>
  📈 Current Balance: <code>${account.current_balance}</code>
  📊 Return on Investment (ROI): <code>${accountROI * 100}%</code>
  <i>\ud83d\udc4d Your investment has grown by ${account.current_balance - account.initial_balance}!</i>`, {
          parse_mode: 'HTML'
        });
      }
    } else {
      await ctx.reply('User does not exist. Please /login to perform this action');
    } 
  }
});

