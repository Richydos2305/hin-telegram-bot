import { settings } from '../config/application';
import { connect } from 'mongoose';

const mongo_uri = (settings.environment === 'production'? settings.mongoUriProd: settings.mongoUriDev) || 'your_mongodb_connection_string';

export const connectMongoDB = async () => {
    try {
        await connect(mongo_uri);
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};
