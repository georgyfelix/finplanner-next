export type DefaultCategory = {
  name: string;
  type: 'expense' | 'income' | 'saving';
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Salary', type: 'income' },
  { name: 'Food', type: 'expense' },
  { name: 'Fuel', type: 'expense' },
  { name: 'Medical', type: 'expense' },
  { name: 'Travel/Tickets', type: 'expense' },
  { name: 'EMI', type: 'expense' },
  { name: 'Credit Card', type: 'expense' },
  { name: 'Misc.', type: 'expense' },
  { name: 'SIP', type: 'saving' },
  { name: 'Stock', type: 'saving' },
  { name: 'Gold', type: 'saving' },
  { name: 'Post Office RD', type: 'saving' },
];

export const PERSONAL_SUGGESTED_CATEGORIES: DefaultCategory[] = [
  { name: 'KSFE 8000x100', type: 'saving' },
  { name: 'KSFE 3000x50', type: 'saving' },
  { name: 'KSFE 10000x50', type: 'saving' },
  { name: 'Merchants Club Chit', type: 'saving' },
  { name: 'LIC', type: 'saving' },
  { name: 'Liya Fees Savings', type: 'saving' },
  { name: 'Travel Savings', type: 'saving' },
  { name: 'APY', type: 'saving' },
  { name: 'EMI Scooter', type: 'expense' },
  { name: 'Partial Expenses Paid', type: 'expense' },
  { name: 'Liya', type: 'expense' },
  { name: 'Liya Fees Payment', type: 'expense' },
  { name: 'Appa', type: 'expense' },
  { name: 'Amma', type: 'expense' },
  { name: 'Asianet', type: 'expense' },
  { name: 'Netflix', type: 'expense' },
  { name: 'YouTube Premium', type: 'expense' },
  { name: 'F1TV', type: 'expense' },
  { name: 'Spotify Premium', type: 'expense' },
  { name: 'Xbox', type: 'expense' },
];
