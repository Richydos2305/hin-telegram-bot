import { Bot, InlineKeyboard, Keyboard, session, SessionFlavor, Context } from 'grammy';
import { SecurityQuestions } from '../interfaces/models';
import { MyContext, initial } from '../helpers/index';
import { settings } from '../config/application';
import { Users, IUser } from '../models/users';
import { Admins, IAdmin } from '../models/admins';

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
    await ctx.reply('User does not exist. Try /register instead.');
  }
  await ctx.reply(`Welcome ${ctx.message?.from.first_name}. Your available commands are: `);
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

bot.on('message', async (ctx) => {
  const { state } = ctx.session;

  if (state === 'securityQuestion') {
    const selectedQuestion = ctx.message.text;

    if (selectedQuestion && questions.includes(selectedQuestion)) {
      securityQuestion = selectedQuestion;
      await ctx.reply(`So ${ctx.message.text}`);
      ctx.session.state = 'securityAnswer';
    } else {
      await ctx.reply('Please select a valid security question by using the /register command.');
    }
  } else if (state === 'securityAnswer') {
    answer = ctx.message.text as string;
    telegramId = ctx.message.from.id;
    username = ctx.message.from.first_name;
    const user = await Users.create({ username, telegram_id: telegramId, security_q: securityQuestion, security_a: answer });

    if (user) await ctx.reply(`Your details have been taken... Registration complete!`);
    ctx.session.state = null;
  } else if (state === 'loginInProgress') {
    if (ctx.message.text === loggedInUser.security_a) {
      await ctx.reply('Authentication Successful');
      ctx.session.loggedIn = true;
      ctx.session.state = null;
    } else {
      await ctx.reply('Wrong Answer. Try /login for another attempt');
    }
  } else if (state === 'adminLoginInProgress') {
    if (ctx.message.text === loggedInAdmin.password) {
      await ctx.reply('Admin Authentication Successful');
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
