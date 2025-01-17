import mongoose, { Schema, Document } from 'mongoose';
import { User, SecurityQuestions } from '../interfaces/models';

export interface IUser extends User, Document {}

const UserSchema: Schema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    security_q: {
      type: String,
      required: true,
      enum: Object.values(SecurityQuestions),
      trim: true
    },
    security_a: {
      type: String,
      required: true,
      maxlength: 225
    }
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

export const Users = mongoose.model<IUser>('User', UserSchema);
