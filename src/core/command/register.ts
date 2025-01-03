import { CommandContext, Keyboard } from 'grammy';
import { MyContext } from '../helpers';
import { SecurityQuestions } from '../interfaces/models';

const { MOTHER_MAIDEN_NAME, NAME_OF_CITY_YOU_WERE_BORN_IN, NAME_OF_FIRST_PET, NAME_OF_YOUR_PRIMARY_SCHOOL } = SecurityQuestions;
const questions: string[] = [MOTHER_MAIDEN_NAME, NAME_OF_CITY_YOU_WERE_BORN_IN, NAME_OF_FIRST_PET, NAME_OF_YOUR_PRIMARY_SCHOOL];

const buttonRows = questions.map((question) => [Keyboard.text(question)]);
const pickSecurityQuestion = '<b>Pick a Security Question for your Account.</b>';
const keyboard = Keyboard.from(buttonRows).resized().oneTime();

export const handleRegister = async (ctx: CommandContext<MyContext>): Promise<void> => {
  await ctx.reply(pickSecurityQuestion, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
  ctx.session.state = 'securityQuestion';
};
