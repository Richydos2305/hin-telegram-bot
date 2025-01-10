import { connectMongoDB } from './core/database';
import express from 'express';
import { settings } from './core/config/application';
import routes from './core/routes';
import errorHandler from './core/middleware/errorhandler';
import { webhookCallback } from 'grammy';
// import { bot } from './core/command/bot';
// import { apiThrottler } from '@grammyjs/transformer-throttler'
import { Bot, session } from 'grammy';
import { composer } from './scaling/composers';
import { router as addRouter } from './scaling/routers/add';
import { router as multiplyRouter } from './scaling/routers/multiply';

import type { CustomContext } from './scaling/types/CustomContext';
import type { SessionData } from './scaling/types/SessionData';

const app = express();
const port = settings.port || 5000;
const bot = new Bot<CustomContext>(settings.botToken);

connectMongoDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(webhookCallback(bot, 'express'));
app.use('/', routes);

app.listen(port, () => {
  console.log(`Server running on Port ${port}`);
});
// const setWebhook = async (): Promise<void> => {
//   const webhookUrl = `${settings.webhookUrl}/webhook`;
//   await bot.api.setWebhook(webhookUrl);
// };

// setWebhook().catch(console.error);

app.use(errorHandler);

// 3. Attach a session middleware and specify the initial data
bot.use(
  session({
    initial: (): SessionData => ({
      route: '',
      leftOperand: 0,
      rightOperand: 0
    })
  })
);

// 4. Attach all routers to the bot as middleware
bot.use(addRouter);
bot.use(multiplyRouter);

// 5. Attach all composers to the bot as middleware
bot.use(composer);
