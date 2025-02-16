import { CommandContext, Keyboard } from 'grammy';
import { MyContext, trackMessage } from '../helpers';
import { SecurityQuestions } from '../interfaces';

const { MOTHER_MAIDEN_NAME, NAME_OF_CITY_YOU_WERE_BORN_IN, NAME_OF_FIRST_PET, NAME_OF_YOUR_PRIMARY_SCHOOL } = SecurityQuestions;
export const questions: string[] = [MOTHER_MAIDEN_NAME, NAME_OF_CITY_YOU_WERE_BORN_IN, NAME_OF_FIRST_PET, NAME_OF_YOUR_PRIMARY_SCHOOL];

const buttonRows = questions.map((question) => [Keyboard.text(question)]);
const pickSecurityQuestion = '<b>Pick a Security Question for your Account.</b>';
const keyboard = Keyboard.from(buttonRows).resized().oneTime();
const messageIds: number[] = [];

export const handleRegister = async (ctx: CommandContext<MyContext>): Promise<void> => {
  const userId = ctx.message?.chat.id;
  messageIds.push(ctx.message?.message_id as number);

  const reply = await ctx.reply(pickSecurityQuestion, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
  messageIds.push(reply.message_id);
  ctx.session.route = 'securityQuestion';
  if (userId) trackMessage(userId as number, messageIds);
  messageIds.length = 0;
};
