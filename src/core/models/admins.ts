import mongoose, { Schema, Document } from 'mongoose';
import { Admin } from '../interfaces/models';

export interface IAdmin extends Admin, Document {}

const AdminSchema: Schema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
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
