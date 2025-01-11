import { Router } from '@grammyjs/router';
import { formatNumber, makeAnEntry, MyContext } from '../helpers';
import { FileType, TransactionStatus, TransactionType } from '../interfaces';
import { pickTransactionStatus, transactionConfirmationkeyboard } from '../command/admin';
import { Accounts } from '../models/accounts';
import { Users } from '../models/users';
import { Transactions } from '../models/transactions';
import { bot } from '../..';

const router = new Router<MyContext>((ctx) => ctx.session.route);

router.route('adminLoginInProgress', async (ctx) => {
  if (ctx.message && ctx.message.text === ctx.session.userData.password) {
    await ctx.reply('Admin Authentication Successful. Your available commands are: ', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Make Entry', callback_data: 'make_entry' },
            { text: 'View Transactions', callback_data: 'view_transactions' }
          ],
          [
            { text: 'Command 3', callback_data: 'command3' },
            { text: 'Command 4', callback_data: 'command4' }
          ]
        ]
      }
    });
    ctx.session.isAdmin = true;
    ctx.session.route = '';
  } else {
    await ctx.reply('Invalid Password. Try /admin for another attempt');
    ctx.session.userData = null;
    ctx.session.route = '';
  }
});

router.route('askROI', async (ctx) => {
  const { message } = ctx;
  if (message) {
    if (!isNaN(Number(message.text))) {
      ctx.session.roi = Number(message.text);
      if (ctx.session.roi >= -100) {
        await ctx.reply(`Add Commissions? Respond with yes or no`);
        ctx.session.route = 'askCommissions';
      } else {
        await ctx.reply('Please input a valid ROI amount, between -100% and 200%');
      }
    } else {
      await ctx.reply('Please input a valid ROI amount, between -100% and 200%');
    }
  }
});

router.route('askCommissions', async (ctx) => {
  const { message } = ctx;
  if (message) {
    if (message.text && (message.text.toLowerCase() === 'yes' || message.text.toLowerCase() === 'y')) {
      ctx.session.commissions = true;
      await makeAnEntry(ctx);
      ctx.session.route = '';
    } else if (message.text && (message.text.toLowerCase() === 'no' || message.text.toLowerCase() === 'n')) {
      ctx.session.commissions = false;
      await makeAnEntry(ctx);
      ctx.session.route = '';
    } else {
      await ctx.reply('Respond with yes or no');
    }
  }
});

router.route('viewUserTransaction', async (ctx) => {
  const { message } = ctx;
  const { transactions } = ctx.session;
  if (ctx.session.transactions.length > 0) {
    if (message) {
      const username = message.text;
      const userTransaction = transactions.find((obj) => obj.user.username === username);
      if (userTransaction && userTransaction.transaction.type === TransactionType.DEPOSIT) {
        if (userTransaction.transaction.receipt.type === FileType.DOCUMENT) {
          await ctx.replyWithDocument(userTransaction.transaction.receipt.file, { caption: 'Here is the receipt' });
        } else if (userTransaction.transaction.receipt.type === FileType.PHOTO) {
          await ctx.replyWithPhoto(userTransaction.transaction.receipt.file, { caption: 'Here is the receipt' });
        }
      }
      await ctx.reply(pickTransactionStatus, {
        parse_mode: 'HTML',
        reply_markup: transactionConfirmationkeyboard
      });
      ctx.session.currentTransaction = userTransaction;
      ctx.session.route = 'transactionRequestInProgress';
    }
  }
});

router.route('transactionRequestInProgress', async (ctx) => {
  const { message } = ctx;
  const { currentTransaction } = ctx.session;
  if (message) {
    const account = await Accounts.findOne({ _id: currentTransaction.transaction.account_id });
    const user = await Users.findById(currentTransaction.transaction.user_id);
    console.log(`Transaction Status: ${message.text} Current Transaction: ${currentTransaction}`);

    if (message.text === TransactionStatus.APPROVED && account && currentTransaction.transaction.type === TransactionType.DEPOSIT) {
      account.current_balance += currentTransaction.transaction.amount;
      account.initial_balance += currentTransaction.transaction.amount;
      await account.save();
      await Transactions.findByIdAndUpdate(currentTransaction.transaction._id, { status: message.text });
      await ctx.reply('Okay. Will let the user know it has been approved');
      if (user)
        await bot.api.sendMessage(
          user.chat_id,
          `**Deposit Approved!** 📈\n\nYour Deposit Request of ${formatNumber(currentTransaction.transaction.amount)} has been approved. Thank you for choosing us! We wish you continued success. 🙏`
        );
      ctx.session.route = '';
      ctx.session.currentTransaction = null;
      ctx.session.transactions = [];
    } else if (message.text === TransactionStatus.APPROVED && account && currentTransaction.transaction.type === TransactionType.WITHDRAWAL) {
      await ctx.reply('Okay. Upload the Receipt as a response to this message and the user will be notified');
      ctx.session.route = 'transactionRequestReceiptUpload';
    } else if (
      message.text === TransactionStatus.DENIED &&
      account &&
      (currentTransaction.transaction.type === TransactionType.WITHDRAWAL || currentTransaction.transaction.type === TransactionType.DEPOSIT)
    ) {
      await Transactions.findByIdAndUpdate(currentTransaction.transaction._id, { status: message.text });
      await ctx.reply('Okay. Will let the user know it has been denied');
      if (user)
        await bot.api.sendMessage(
          user.chat_id,
          `**Transaction Denied!** 🚫\n\nUnfortunately, your transaction request of ₦${formatNumber(currentTransaction.transaction.amount)} has been denied.\n\nPlease review and correct the details you provided, as they may be invalid. 📝`
        );
    }
  }
});

router.route('transactionRequestReceiptUpload', async (ctx) => {
  const { message } = ctx;
  const { currentTransaction } = ctx.session;
  if (message) {
    let receipt: { file: string; type: FileType } | null = null;
    if (message.photo) {
      receipt = {
        file: message.photo[0].file_id,
        type: FileType.PHOTO
      };
    } else if (message.document) {
      receipt = {
        file: message.document.file_id,
        type: FileType.DOCUMENT
      };
    }
    if (receipt) {
      await Transactions.findByIdAndUpdate(currentTransaction.transaction._id, {
        status: TransactionStatus.APPROVED,
        receipt
      });
      const account = await Accounts.findOne({ _id: currentTransaction.transaction.account_id });

      if (account) {
        account.current_balance -= currentTransaction.transaction.amount;
        account.initial_balance -= currentTransaction.transaction.amount;
        await account.save();
      }
      await ctx.reply('Okay. Will let the user know it has been approved');
      const user = await Users.findById(currentTransaction.transaction.user_id);
      if (user)
        await bot.api.sendMessage(
          user.chat_id,
          `**Withdrawal Approved!** 🎉\n\nYour Withdrawal Request of ₦${formatNumber(currentTransaction.transaction.amount)} has been approved.\n\nThank you for your patronage! We appreciate your business. 😊`
        );
      ctx.session.route = '';
      ctx.session.currentTransaction = null;
      ctx.session.transactions = [];
    } else {
      await ctx.reply(`**Invalid Receipt** 🚫\n\nPlease send a valid receipt to proceed.'`);
    }
  }
});

export { router };
