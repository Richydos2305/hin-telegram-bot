import { Schema, model } from 'mongoose';
import { statusType } from '../interfaces';
import { getAccountDates } from '../helpers/helpers';

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
      default: getAccountDates().startDate
    },

    completion_date: {
      type: Date,
      default: getAccountDates().endDate
    }
  },
  {
    timestamps: false,
    collection: 'mediumRiskAccounts'
  }
);

export const MediumRiskAccounts = model('MediumRiskAccount', MediumRiskAccountSchema);
