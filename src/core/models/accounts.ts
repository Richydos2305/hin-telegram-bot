import { Schema, model } from "mongoose";

const AccountSchema = new Schema({
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

    roi: {
        type: Number,
        default: 0,
        min: -1,
        max: 1
    }

}, {
    timestamps: true,
    collection: 'accounts'
});

export const Accounts = model('Account', AccountSchema);
