import mongoose from "mongoose";
import { TransactionType, UserPlan } from "../interfaces";
import { Transactions,  } from "../models/transactions";

function add(a: number, b: number): number {
  return a + b;
}

describe('add', () => {
  it('should return the sum of two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('should return 0 when adding 0 + 0', () => {
    expect(add(0, 0)).toBe(0);
  });
});
describe('Deposit and Withdrawal', () => {
  it('should create a deposit transaction with HIGH_RISK plan', async () => {
    const transaction = new Transactions({
      user_id: new mongoose.Types.ObjectId(),
      account_id: new mongoose.Types.ObjectId(),
      type: TransactionType.DEPOSIT,
      plan: UserPlan.HIGH_RISK,
      amount: 1000
    });

    await transaction.save();

    const savedTransaction = await Transactions.findById(transaction._id);
    expect(savedTransaction).toBeDefined();
    expect(savedTransaction?.type).toBe(TransactionType.DEPOSIT);
    expect(savedTransaction?.plan).toBe(UserPlan.HIGH_RISK);
  });

  it('should create a withdrawal transaction with LOW_RISK plan', async () => {
    const transaction = new Transactions({
      user_id: new mongoose.Types.ObjectId(),
      account_id: new mongoose.Types.ObjectId(),
      type: TransactionType.WITHDRAWAL,
      plan: UserPlan.LOW_RISK,
      amount: 500
    });

    await transaction.save();

    const savedTransaction = await Transactions.findById(transaction._id);
    expect(savedTransaction).toBeDefined();
    expect(savedTransaction?.type).toBe(TransactionType.WITHDRAWAL);
    expect(savedTransaction?.plan).toBe(UserPlan.LOW_RISK);
  });
});

