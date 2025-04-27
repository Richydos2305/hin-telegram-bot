import { Schema, model } from 'mongoose';
import { statusType } from '../interfaces';

const MediumRiskAccountSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'Users',
      required: true
    },

    current_balance: {
      type: Number,
      default: 0
    },

    initial_balance: {
      type: Number,
      default: 0
    },

    quarters: {
      type: Number,
      default: 0
    },

    status: {
      type: String,
      enum: Object.values(statusType),
      default: statusType.ACTIVE
    },

    start_date: {
      type: Date,
      default: Date.now
    },

    completion_date: {
      type: Date,
      default: (): Date => {
        const now = new Date();
        now.setFullYear(now.getFullYear() + 1);
        return now;
      }
    }
  },
  {
    timestamps: false,
    collection: 'mediumRiskAccounts'
  }
);

export const MediumRiskAccounts = model('MediumRiskAccount', MediumRiskAccountSchema);
