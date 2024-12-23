import mongoose, { Schema, Document } from 'mongoose';
import { TransactionType, TransactionStatus } from '../interfaces/models';

export interface ITransactions extends Document {
  user_id: Schema.Types.ObjectId;
  quarter_id: Schema.Types.ObjectId;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
}

const TransactionSchema: Schema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'Users',
      required: true
    },
    quarter_id: {
      type: Schema.Types.ObjectId,
      ref: 'Quarters',
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(TransactionType)
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(TransactionStatus)
    },
    amount: {
      type: Number,
      required: true,
      maxlength: 225
    }
  },
  {
    timestamps: true,
    collection: 'transactions'
  }
);

export const Transactions = mongoose.model<ITransactions>('Transaction', TransactionSchema);
