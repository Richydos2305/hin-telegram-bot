import { Schema, model } from "mongoose";

const QuarterSchema = new Schema({
    
    currentYear: { 
        type: Number,
        //i was thinking of using date for this field so this can be automated rather than us putting it in manually.
        //type: Date,
        min: 2024,
    },

    currentQuarter: {
        type: Number,
        min: 1,
        max: 4,
        required: true
    },

    starting_capital: {
        type: Float64Array,
        min: 0
    },

    ending_capital: {
        type: Float64Array,
        min: 0
    },

    roi: {
        type: Float64Array,
        required: true,
        min: 0
    },

    commission: {
        type: Boolean,
        default: true
    },

    account: {
        type: Schema.Types.ObjectId,
        ref: 'Account'
    }


}, {
    timestamps: true,
    collection: 'quarters'
})

export const Quarters = model('Quarter', QuarterSchema);