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

import { initial, MyContext } from './core/helpers';

export const bot = new Bot<MyContext>(settings.botToken);

bot.use(session({ initial }));

bot.use(adminRouter);
bot.use(loginRouter);
bot.use(registerRouter);
bot.use(depositRouter);
bot.use(withdrawalRouter);

bot.use(composer);

bot.start();

connectMongoDB();

const app = express();
const port = settings.port || 5000;
app.listen(port, () => {
  console.log(`Server running on Port ${port}`);
});
