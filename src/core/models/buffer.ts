import { Schema, model } from 'mongoose';

const HinBufferSchema = new Schema(
  {
    amount: {
      type: Number,
      default: 0
    },
    amount_allocated: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    collection: 'hinBuffer'
  }
);

export const HinBuffer = model('HinBuffer', HinBufferSchema);
