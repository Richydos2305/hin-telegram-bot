import { connectMongoDB } from './core/database';
import express from 'express';
import { settings } from './core/config/application';
import routes from './core/routes';
import errorHandler from './core/middleware/errorhandler';

const app = express();
const port = settings.port || 5000;

connectMongoDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', routes);

app.use(errorHandler);

app.listen(port, () => {
	console.log(`Server running on Port ${port}`);
});
