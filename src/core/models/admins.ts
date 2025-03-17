import mongoose, { Schema, Document } from 'mongoose';
import { Admin } from '../interfaces';

export interface IAdmin extends Admin, Document {}

const AdminSchema: Schema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    chat_id: {
      type: String,
      unique: true
    },
    password: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true,
    collection: 'admins'
  }
);

export const Admins = mongoose.model<IAdmin>('Admin', AdminSchema);
