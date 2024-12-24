import dotenv from 'dotenv';
dotenv.config();

export const settings = {
  secretKey: process.env.ACCESSTOKENSECRET as string,
  port: process.env.PORT,
  environment: process.env.ENVIRONMENT,
  mongoUriDev: process.env.MONGO_URI_DEVELOPMENT,
  mongoUriProd: process.env.MONGO_URI_PRODUCTION,
  botToken: process.env.TELEGRAMBOTTOKEN as string,
  webhookUrl: process.env.WEBHOOKURL as string
};
