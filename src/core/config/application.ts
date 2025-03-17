import dotenv from 'dotenv';
dotenv.config();

export const settings = {
  secretKey: process.env.ACCESSTOKENSECRET as string,
  port: process.env.PORT,
  environment: process.env.ENVIRONMENT,
  mongoUriDev: process.env.MONGO_URI_DEVELOPMENT,
  mongoUriProd: process.env.MONGO_URI_PRODUCTION,
  botToken: process.env.TELEGRAMBOTTOKEN as string,
  webhookUrl: process.env.WEBHOOKURL as string,
  adminIds: {
    chatId1: process.env.ADMINCHATID1 as string,
    chatId2: process.env.ADMINCHATID2 as string
  }
};
