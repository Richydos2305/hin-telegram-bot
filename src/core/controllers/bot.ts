import { Bot, Keyboard, session } from 'grammy';
import { SecurityQuestions, TransactionType } from '../interfaces/models';
import { MyContext, initial } from '../helpers/index';
import { settings } from '../config/application';
import { Users, IUser } from '../models/users';
import { Admins, IAdmin } from '../models/admins';
import { Accounts } from '../models/accounts';
import { Transactions } from '../models/transactions';

let securityQuestion: string;
let answer;
let telegramId;
let username;
let loggedInUser: IUser;
let loggedInAdmin: IAdmin;

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
  const { state, loggedIn } = ctx.session;

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
    const user = await Users.create({ username, telegram_id: telegramId, security_q: securityQuestion, security_a: answer });

    if (user) await ctx.reply(`Your details have been taken... Registration complete!`);
    await Accounts.create({ user_id: user._id });
    ctx.session.state = null;
  } else if (state === 'loginInProgress') {
    if (ctx.message.text === loggedInUser.security_a) {
      await ctx.reply('Authentication Successful');
      ctx.session.userData = loggedInUser;
      ctx.session.loggedIn = true;
      ctx.session.state = null;
    } else {
      await ctx.reply('Wrong Answer. Try /login for another attempt');
    }
  } else if (state === 'adminLoginInProgress') {
    if (ctx.message.text === loggedInAdmin.password) {
      await ctx.reply('Admin Authentication Successful. Your available commands are: ');
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
