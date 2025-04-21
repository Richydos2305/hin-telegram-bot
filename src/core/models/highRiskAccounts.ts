import { Schema, model } from 'mongoose';

const HighRiskAccountSchema = new Schema(
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
    }
  },
  {
    timestamps: true,
    collection: 'highRiskAccounts'
  }
);

export const HighRiskAccounts = model('HighRiskAccount', HighRiskAccountSchema);
