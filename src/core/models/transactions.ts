import mongoose, { Schema, Document } from 'mongoose';
import { TransactionType, TransactionStatus } from '../interfaces/models';
import { PhotoSize, Document as grammyDocument } from 'grammy/types';

export interface ITransactions extends Document {
  user_id: Schema.Types.ObjectId;
  quarter_id: Schema.Types.ObjectId;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  receipt: grammyDocument | PhotoSize;
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
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING
    },
    amount: {
      type: Number,
      required: true,
      maxlength: 225
    },
    receipt: {
      type: Object
    }
  },
  {
    timestamps: true,
    collection: 'transactions'
  }
);

export const Transactions = mongoose.model<ITransactions>('Transaction', TransactionSchema);
