export enum SecurityQuestions {
  MOTHER_MAIDEN_NAME = "What is your mother's maiden name?",
  NAME_OF_FIRST_PET = 'What is the name of your first pet?',
  NAME_OF_CITY_YOU_WERE_BORN_IN = 'What is the name of the city where you were born?',
  NAME_OF_YOUR_PRIMARY_SCHOOL = 'What is the name of your primary school?'
}
export enum TransactionType {
  DEPOSIT = 'Deposit',
  WITHDRAWAL = 'Withdrawal'
}

export enum statusType {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum FileType {
  PHOTO = 'Photo',
  DOCUMENT = 'Document'
}

export enum TransactionStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  DENIED = 'Denied'
}

export enum UserPlan {
  HIGH_RISK = 'High',
  MEDIUM_RISK = 'Medium',
  LOW_RISK = 'Low'
}

export interface User {
  username: string;
  first_name: string;
  telegram_id: string;
  chat_id: string;
  security_q: SecurityQuestions;
  security_a: string;
}

export interface Admin {
  username: string;
  password: string;
  chat_id: string;
  current_balance?: number;
}

export enum SessionState {
  ASK_ROI = 'askROI',
  ASK_COMMISSIONS = 'askCommissions',
  TRANSACTION_RECEIPT_UPLOAD = 'transactionRequestReceiptUpload',
  TRANSACTION_IN_PROGRESS = 'transactionRequestInProgress',
  LOGIN_IN_PROGRESS = 'loginInProgress',
  ADMIN_LOGIN_IN_PROGRESS = 'adminLoginInProgress'
}

export enum QuarterBeginningMonths {
  Q1 = 'January',
  Q2 = 'April',
  Q3 = 'July',
  Q4 = 'October'
}

export const quarterStartMonths = new Map<string, number>([
  ['January', 1],
  ['April', 4],
  ['July', 7],
  ['October', 10]
]);

export const quarterMap = new Map<number, QuarterBeginningMonths>([
  [1, QuarterBeginningMonths.Q2],
  [2, QuarterBeginningMonths.Q3],
  [3, QuarterBeginningMonths.Q4]
]);
