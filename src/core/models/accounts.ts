import { Schema, model } from "mongoose";

const AccountSchema = new Schema({
   user:{
       type: Schema.Types.ObjectId,
       ref: 'User'
   },
   //This field holds the profit made every quarter plus initial balance
   current_balance: {
    type: Float64Array,
    default: 0
   },

   //This field holds the total amount the user has invested, profit shoud not be added
   initial_balance: {
    type: Float64Array,
    default: 0
   }
},{
    timestamps: true,
    collection: 'accounts'
});

export const Accounts = model('Account', AccountSchema);