import { CommandContext, Keyboard } from 'grammy';
import { MyContext, trackMessage } from '../helpers';
import { Users } from '../models/users';
import { SecurityQuestions } from '../interfaces';

const messageIds: number[] = [];
const { MOTHER_MAIDEN_NAME, NAME_OF_CITY_YOU_WERE_BORN_IN, NAME_OF_FIRST_PET, NAME_OF_YOUR_PRIMARY_SCHOOL } = SecurityQuestions;
export const questions: string[] = [MOTHER_MAIDEN_NAME, NAME_OF_CITY_YOU_WERE_BORN_IN, NAME_OF_FIRST_PET, NAME_OF_YOUR_PRIMARY_SCHOOL];

const buttonRows = questions.map((question) => [Keyboard.text(question)]);
const pickSecurityQuestion = '<b>Pick a Security Question for your Account.</b>';
const keyboard = Keyboard.from(buttonRows).resized().oneTime();

export const handleLogin = async (ctx: CommandContext<MyContext>): Promise<void> => {
  const user = await Users.findOne({ username: ctx.message?.from.username });

  const userId = ctx.message?.chat.id;
  messageIds.push(ctx.message?.message_id as number);

  if (user) {
    ctx.session.userData = user;
    if (user.security_q) {
      const reply = await ctx.reply(user.security_q);
      messageIds.push(reply.message_id);
      ctx.session.route = 'loginInProgress';
    } else {
      const reply = await ctx.reply(pickSecurityQuestion, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
      messageIds.push(reply.message_id);
      ctx.session.route = 'securityQuestion';
    }
  } else {
    const reply = await ctx.reply('**User does not exist** 🚫\n\n You are not authorised to use this bot.');
    messageIds.push(reply.message_id);
  }
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
};
