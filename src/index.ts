import express from 'express';
import { Bot, session } from 'grammy';
import { composer } from './scaling/composers';
import { router as addRouter } from './scaling/routers/add';
import { router as multiplyRouter } from './scaling/routers/multiply';
import { settings } from './core/config/application';

import type { CustomContext } from './scaling/types/CustomContext';
import type { SessionData } from './scaling/types/SessionData';

// 1. Create a bot with a token (get it from https://t.me/BotFather)
const bot = new Bot<CustomContext>(settings.botToken); // <-- place your token inside this string

// 2. Attach an api throttler transformer to the bot

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

// 6. Start the bot
bot.start();

const app = express();
const port = settings.port || 5000;
app.listen(port, () => {
  console.log(`Server running on Port ${port}`);
});
