import mongoose, { Schema, Document } from 'mongoose';
import { User } from '../interfaces/models';

export interface IUser extends User, Document {}

const UserSchema: Schema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            maxlength: 50,
            trim: true
        },
        password: {
            type: String,
            required: true,
            maxlength: 225
        },
    },
    {
        timestamps: true,
        collection: 'users'
    }
);

export const Users = mongoose.model<IUser>('User', UserSchema);
