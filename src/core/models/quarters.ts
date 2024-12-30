import { Schema, model } from "mongoose";

const QuarterSchema = new Schema({

    year: {
        type: Number,
        min: 2024,
        required: true
    },

    quarter: {
        type: Number,
        min: 1,
        max: 4,
        required: true
    },

    starting_capital: {
        type: Number,
        min: 0,
        default: 0
    },

    ending_capital: {
        type: Number,
        min: 0,
        default: 0
    },

    roi: {
        type: Number,
        required: true,
        min: -1,
        max: 1
    },

    commission: {
        type: Boolean,
        default: true
    },

    account_id: {
        type: Schema.Types.ObjectId,
        ref: 'Accounts',
        required: true
    },

    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    }

}, {
    timestamps: true,
    collection: 'quarters'
})

export const Quarters = model('Quarter', QuarterSchema);
