import app from './app';
import { connectMongoDB } from './core/database';
import { settings } from './core/config/application';
import { startBot } from './bot';

const port = settings.port || 5000;

async function bootstrap(): Promise<void> {
  await connectMongoDB();
  app.listen(port, () => {
    console.log(`Server running on Port ${port}`);
  });
  await startBot();
}

bootstrap();
