import { Bot, session } from 'grammy';
import { settings } from './core/config/application';
import { composer } from './core/composers';
import { router as adminRouter } from './core/routers/admin';
import { router as loginRouter } from './core/routers/login';
import { router as depositRouter } from './core/routers/deposit';
import { router as withdrawalRouter } from './core/routers/withdraw';
import { deleteChatHistory, initial, MyContext } from './core/helpers';
import cron from 'node-cron';

export const bot = new Bot<MyContext>(settings.botToken);
export const messageStore = new Map<number, number[]>();

bot.use(session({ initial }));
bot.use(adminRouter);
bot.use(loginRouter);
bot.use(depositRouter);
bot.use(withdrawalRouter);
bot.use(composer);

cron.schedule('0 */4 * * *', () => {
  console.log('Running scheduled chat cleanup...');
  deleteChatHistory();
});

bot.catch((err) => {
  console.error(err);
});

export const startBot = (): Promise<void> => bot.start();
