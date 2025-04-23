import mongoose, { Schema, Document } from 'mongoose';
import { TransactionType, TransactionStatus, FileType, UserPlan } from '../interfaces';

export interface ITransactions extends Document {
  user_id: Schema.Types.ObjectId;
  quarter_id: Schema.Types.ObjectId;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  plan: UserPlan;
  receipt: {
    file: string;
    type: FileType;
  };
  createdAt?: Date;
}

const TransactionSchema: Schema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'Users',
      required: true
    },
    account_id: {
      type: Schema.Types.ObjectId,
      ref: 'Accounts',
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(TransactionType)
    },
    plan: {
      type: String,
      required: true,
      enum: Object.values(UserPlan)
    },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING
    },
    amount: {
      type: Number,
      required: true
    },
    receipt: {
      file: {
        type: String
      },
      type: {
        type: String,
        enum: Object.values(FileType)
      }
    }
  },
  {
    timestamps: true,
    collection: 'transactions'
  }
);

export const Transactions = mongoose.model<ITransactions>('Transaction', TransactionSchema);
