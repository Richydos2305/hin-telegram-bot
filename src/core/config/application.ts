import dotenv from 'dotenv';
dotenv.config();

export const settings = {
  secretKey: process.env.ACCESSTOKENSECRET as string || 'qwerty',
  port: process.env.PORT || 5000,
  environment: process.env.ENVIRONMENT || 'development',
  mongoUriDev: process.env.MONGO_URI_DEVELOPMENT || 'mongodb+srv://tolu:tolu@cluster0.diyqz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
  mongoUriProd: process.env.MONGO_URI_PRODUCTION,
  botToken: process.env.TELEGRAMBOTTOKEN as string || '7920810885:AAGNxyWIa8Hv1PUveWTButF0VpRBVkOdiSE',
  webhookUrl: process.env.WEBHOOKURL as string
};
