import express from 'express';
import { connectMongoDB } from './core/database';
import { settings } from './core/config/application';
import { Bot, session } from 'grammy';
import { composer } from './core/composers';
import { router as adminRouter } from './core/routers/admin';
import { router as registerRouter } from './core/routers/register';
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
bot.use(registerRouter);
bot.use(depositRouter);
bot.use(withdrawalRouter);

bot.use(composer);

cron.schedule('0 */4 * * *', () => {
  console.log('Running scheduled chat cleanup...');
  deleteChatHistory();
});

bot.start();

connectMongoDB();

const app = express();
const port = settings.port || 5000;
app.get('/status', (req, res) => {
  res.status(200).send('Hello, World!');
});
app.listen(port, () => {
  console.log(`Server running on Port ${port}`);
});
