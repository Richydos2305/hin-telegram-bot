import { connectMongoDB } from './core/database';
import express from 'express';
import { settings } from './core/config/application';
import routes from './core/routes';
import errorHandler from './core/middleware/errorhandler';
import { webhookCallback, Bot } from 'grammy';
import { bot } from './core/controllers/bot';

const app = express();
const port = settings.port || 5000;

connectMongoDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(webhookCallback(bot, 'express'));
app.use('/', routes);

const setWebhook = async (): Promise<void> => {
  const webhookUrl = `${settings.webhookUrl}/webhook`;
  await bot.api.setWebhook(webhookUrl);
};

setWebhook().catch(console.error);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on Port ${port}`);
});
