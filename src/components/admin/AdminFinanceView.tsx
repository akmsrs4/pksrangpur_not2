/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../db/store.ts';
import {
  DollarSign,
  PlusCircle,
  ArrowRightLeft,
  FileText,
  Printer,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Building,
  Wallet,
  Eye,
  Lock,
  FileDown,
  Trash2,
  RotateCcw,
  Archive,
} from 'lucide-react';
import { FinancialTransaction, TransactionType } from '../../types.ts';

export const AdminFinanceView: React.FC = () => {
  const store = useAppStore();
  const permissions = store.getEffectivePermissions();

  // Form State
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [voucherModalTxn, setVoucherModalTxn] = useState<FinancialTransaction | null>(null);

  const [type, setType] = useState<TransactionType>('income');
  const [voucherNo, setVoucherNo] = useState('');
  const [fundId, setFundId] = useState(store.funds[0]?.id || '');
  const [toFundId, setToFundId] = useState(store.funds[1]?.id || '');
  const [accountId, setAccountId] = useState(store.accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(store.accounts[1]?.id || '');
  const [amount, setAmount] = useState<number>(5000);
  const [category, setCategory] = useState('সাধারণ চাঁদা');
  const [donorOrPayee, setDonorOrPayee] = useState('');
  const [description, setDescription] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);

  // New Fund Form State
  const [newFundName, setNewFundName] = useState('');
  const [newFundCode, setNewFundCode] = useState('');
  const [newFundDesc, setNewFundDesc] = useState('');

  // New Account Form State
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<'bank' | 'cash' | 'mobile_banking'>('bank');
  const [newAccountNumber, setNewAccountNumber] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rejectModalTxn, setRejectModalTxn] = useState<FinancialTransaction | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteConfirmTxnId, setDeleteConfirmTxnId] = useState<string | null>(null);
  const [deleteFundConfirmId, setDeleteFundConfirmId] = useState<string | null>(null);
  const [voidModalTxn, setVoidModalTxn] = useState<FinancialTransaction | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Keep selected fund/account IDs valid after Supabase hydration
  useEffect(() => {
    const activeFunds = store.funds.filter((f) => f.isActive);
    if (activeFunds.length > 0) {
      if (!activeFunds.some((f) => f.id === fundId)) {
        setFundId(activeFunds[0].id);
      }
      if (!activeFunds.some((f) => f.id === toFundId)) {
        setToFundId((activeFunds[1] || activeFunds[0]).id);
      }
    }
    const activeAccounts = store.accounts.filter((a) => a.isActive);
    if (activeAccounts.length > 0) {
      if (!activeAccounts.some((a) => a.id === accountId)) {
        setAccountId(activeAccounts[0].id);
      }
      if (!activeAccounts.some((a) => a.id === toAccountId)) {
        setToAccountId((activeAccounts[1] || activeAccounts[0]).id);
      }
    }
  }, [store.funds, store.accounts, fundId, toFundId, accountId, toAccountId]);

  // Protection check
  if (!permissions.can_view_finance) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
        <Lock className="w-12 h-12 text-stone-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-stone-900">আর্থিক তথ্য সুরক্ষিত</h3>
        <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
          আপনার বর্তমান রোল ({store.currentUser.name})-এর জন্য আর্থিক তথ্য দেখার অনুমতি সক্রিয় নেই। সুপার অ্যাডমিন ড্যাশবোর্ড থেকে অনুমতি প্রদান করলে দেখতে পাবেন।
        </p>
      </div>
    );
  }

  const handleTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = store.addTransaction({
      voucherNo: voucherNo.trim(),
      type,
      fundId,
      toFundId: type === 'fund_transfer' ? toFundId : undefined,
      accountId,
      toAccountId: type === 'fund_transfer' ? toAccountId : undefined,
      amount: Number(amount),
      category: category.trim(),
      donorOrPayee: donorOrPayee.trim() || 'পাটগ্রাম কল্যাণ সমিতি',
      description: description.trim(),
      autoApprove,
    });

    if (res.success) {
      setSuccessMessage('লেনদেনটি সফলভাবে অন্তর্ভুক্ত হয়েছে!');
      setShowEntryModal(false);
      setVoucherNo('');
      setDescription('');
    } else {
      setErrorMessage(res.error || 'লেনদেন অন্তর্ভুক্তকরণে ত্রুটি দেখা দিয়েছে।');
    }
  };

  const handleApproveTxn = (txnId: string) => {
    setErrorMessage(null);
    const res = store.approveTransaction(txnId);
    if (res.success) {
      setSuccessMessage('লেনদেনটি চূড়ান্ত অনুমোদিত ও ব্যালেন্স হালনাগাদ হয়েছে!');
    } else {
      setErrorMessage(res.error || 'লেনদেন অনুমোদনে ত্রুটি হয়েছে।');
    }
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalTxn) return;
    setErrorMessage(null);
    const res = store.rejectTransaction(rejectModalTxn.id, rejectReason);
    if (res.success) {
      setSuccessMessage('লেনদেনটি বাতিল হিসেবে চিহ্নিত করা হয়েছে।');
      setRejectModalTxn(null);
      setRejectReason('');
    } else {
      setErrorMessage(res.error || 'বাতিল করতে সমস্যা হয়েছে।');
    }
  };

  const handleDeletePendingTxn = (txnId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const res = store.deleteTransaction(txnId);
    setDeleteConfirmTxnId(null);
    if (res.success) {
      setSuccessMessage('অপেক্ষমাণ / বাতিলকৃত লেনদেনটি স্থায়ীভাবে মুছে ফেলা হয়েছে।');
    } else {
      setErrorMessage(res.error || 'লেনদেন মুছে ফেলা যায়নি।');
    }
  };

  const handleVoidTxnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidModalTxn) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    const res = store.requestCorrection({
      originalTransactionId: voidModalTxn.id,
      correctedAmount: 0,
      correctedCategory: voidModalTxn.category,
      correctedFundId: voidModalTxn.fundId,
      correctedAccountId: voidModalTxn.accountId,
      correctedToFundId: voidModalTxn.toFundId,
      correctedToAccountId: voidModalTxn.toAccountId,
      correctedDonorOrPayee: voidModalTxn.donorOrPayee,
      correctedDescription: voidModalTxn.description,
      correctionReason: voidReason,
    });
    if (res.success) {
      setSuccessMessage(
        res.correction?.approvalStatus === 'pending_approval'
          ? `৳০ রিভার্স/বাতিল প্রস্তাব (${res.correction.correctionCode}) তৈরি হয়েছে এবং দ্বৈত অনুমোদনের অপেক্ষায় রয়েছে।`
          : `লেনদেন ${voidModalTxn.transactionCode} সফলভাবে ৳০ (রিভার্স/বাতিল) হয়ে ব্যালেন্স সমন্বয় হয়েছে!`
      );
      setVoidModalTxn(null);
      setVoidReason('');
    } else {
      setErrorMessage(res.error || 'রিভার্স/বাতিল প্রক্রিয়ায় ত্রুটি হয়েছে।');
    }
  };

  const handleToggleFundActive = (targetFundId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const res = store.toggleFundActive(targetFundId);
    if (res.success) {
      setSuccessMessage(res.isActive ? 'তহবিলটি পুনরায় সক্রিয় করা হয়েছে।' : 'তহবিলটি নিষ্ক্রিয় (আর্কাইভ) করা হয়েছে।');
    } else {
      setErrorMessage(res.error || 'তহবিলের অবস্থা পরিবর্তন করা যায়নি।');
    }
  };

  const handleDeleteFund = (targetFundId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const res = store.deleteFund(targetFundId);
    setDeleteFundConfirmId(null);
    if (res.success) {
      setSuccessMessage('অব্যবহৃত তহবিলটি সফলভাবে মুছে ফেলা হয়েছে।');
    } else {
      setErrorMessage(res.error || 'তহবিল মুছে ফেলা যায়নি।');
    }
  };

  const handleAddFund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFundName.trim()) return;
    setErrorMessage(null);

    const res = store.addFund({
      name: newFundName.trim(),
      code: newFundCode.trim().toUpperCase() || 'CUST',
      description: newFundDesc.trim(),
      isActive: true,
      isDefault: false,
    });

    if (res.success) {
      setShowFundModal(false);
      setNewFundName('');
      setNewFundCode('');
      setNewFundDesc('');
      setSuccessMessage('নতুন তহবিল সফলভাবে তৈরি হয়েছে!');
    } else {
      setErrorMessage(res.error || 'তহবিল তৈরিতে ত্রুটি হয়েছে।');
    }
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;
    setErrorMessage(null);

    const res = store.addAccount({
      name: newAccountName.trim(),
      type: newAccountType,
      accountNumber: newAccountNumber.trim(),
      isActive: true,
    });

    if (res.success) {
      setShowAccountModal(false);
      setNewAccountName('');
      setNewAccountNumber('');
      setSuccessMessage('নতুন অ্যাকাউন্ট সফলভাবে যুক্ত হয়েছে!');
    } else {
      setErrorMessage(res.error || 'অ্যাকাউন্ট যুক্ত করতে ত্রুটি হয়েছে।');
    }
  };

  const totalFundBalance = store.funds.reduce((acc, f) => acc + f.currentBalance, 0);
  const totalAccountBalance = store.accounts.reduce((acc, a) => acc + a.currentBalance, 0);
  const totalApprovedIncome = store.transactions
    .filter((t) => (t.status === 'approved' || t.status === 'corrected') && t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalApprovedExpense = store.transactions
    .filter((t) => (t.status === 'approved' || t.status === 'corrected') && t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const canExportReports = Boolean(
    store.currentRole === 'super_admin' || permissions.can_export_reports
  );

  const handlePrintFinancialReport = () => {
    if (!canExportReports) return;
    store.logAudit(
      'EXPORT_FINANCIAL_PDF',
      'report',
      'finance_ledger',
      `${store.currentUser.name} (${store.currentRole}) আর্থিক খতিয়ান Export to PDF করেছেন।`
    );
    window.print();
  };

  const handleExportFinanceCSV = () => {
    const escapeCsv = (val: string | number) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'Transaction Code',
      'Voucher No',
      'Date',
      'Type',
      'Fund',
      'Account',
      'Category',
      'Donor/Payee',
      'Amount (BDT)',
      'Status',
      'Created By',
      'Approved By',
    ];
    const rows = store.transactions.map((t) => {
      const fName = store.funds.find((f) => f.id === t.fundId)?.name || t.fundId;
      const aName = store.accounts.find((a) => a.id === t.accountId)?.name || t.accountId;
      return [
        escapeCsv(t.transactionCode),
        escapeCsv(t.voucherNo),
        escapeCsv(t.createdAt),
        escapeCsv(t.type),
        escapeCsv(fName),
        escapeCsv(aName),
        escapeCsv(t.category),
        escapeCsv(t.donorOrPayee),
        escapeCsv(t.amount),
        escapeCsv(t.status),
        escapeCsv(t.createdByName),
        escapeCsv(t.approvedBy || ''),
      ].join(',');
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `patgram_financial_summary_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Official Print-Only Financial Report Header (Hidden when printing a single voucher) */}
      {!voucherModalTxn && (
        <div className="print-only border-b-2 border-stone-800 pb-4 mb-4 space-y-2 text-center">
          <h1 className="text-xl font-bold text-stone-900">{store.settings.organizationNameBn}</h1>
          <p className="text-xs text-stone-600">{store.settings.officeAddress}</p>
          <div className="text-sm font-bold text-stone-900">
            কেন্দ্রীয় আর্থিক সামারি ও লেনদেন প্রতিবেদন | তারিখ: {new Date().toISOString().substring(0, 10)}
          </div>
          <div className="grid grid-cols-4 gap-2 pt-2 text-xs text-left">
            <div className="p-2 border border-stone-300 rounded">
              <div className="text-stone-500">মোট অনুমোদিত আয়</div>
              <div className="font-bold text-emerald-800">৳{totalApprovedIncome.toLocaleString()}</div>
            </div>
            <div className="p-2 border border-stone-300 rounded">
              <div className="text-stone-500">মোট অনুমোদিত ব্যয়</div>
              <div className="font-bold text-red-700">৳{totalApprovedExpense.toLocaleString()}</div>
            </div>
            <div className="p-2 border border-stone-300 rounded">
              <div className="text-stone-500">তহবিল মোট স্থিতি</div>
              <div className="font-bold text-stone-900">৳{totalFundBalance.toLocaleString()}</div>
            </div>
            <div className="p-2 border border-stone-300 rounded">
              <div className="text-stone-500">ব্যাংক ও ক্যাশ স্থিতি</div>
              <div className="font-bold text-stone-900">৳{totalAccountBalance.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner & Action Buttons */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-700" />
            <span>আর্থিক ব্যবস্থাপনা ও মাল্টি-ফান্ড লেজার</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            ৭টি বিশেষায়িত তহবিল, ব্যাংক ও ক্যাশ অ্যাকাউন্ট ট্র্যাকিং এবং ডুয়াল-ব্যালেন্স ভেরিফিকেশন।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canExportReports && (
            <>
              <button
                type="button"
                onClick={handlePrintFinancialReport}
                className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs shadow flex items-center gap-1.5 cursor-pointer"
                title="আর্থিক সামারি ও পূর্ণাঙ্গ খতিয়ান PDF হিসেবে সংরক্ষণ করুন"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>Export to PDF</span>
              </button>
              <button
                type="button"
                onClick={handleExportFinanceCSV}
                className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs border border-stone-300 flex items-center gap-1.5 cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-emerald-700" />
                <span>লেজার CSV</span>
              </button>
            </>
          )}

          {permissions.can_entry_finance && (
            <button
              onClick={() => {
                setVoucherNo(`V-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
                setShowEntryModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>নতুন লেনদেন এন্ট্রি</span>
            </button>
          )}

          {permissions.can_manage_funds && (
            <button
              onClick={() => setShowFundModal(true)}
              className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs border border-stone-200 cursor-pointer"
            >
              + নতুন তহবিল
            </button>
          )}

          {permissions.can_manage_accounts && (
            <button
              onClick={() => setShowAccountModal(true)}
              className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs border border-stone-200 cursor-pointer"
            >
              + নতুন অ্যাকাউন্ট
            </button>
          )}
        </div>
      </div>

      {/* Success / Error notification */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-stone-400 hover:text-stone-600">
            ×
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-stone-400 hover:text-stone-600">
            ×
          </button>
        </div>
      )}

      {/* Balances Section: Funds vs Accounts */}
      <div className={`${voucherModalTxn ? 'no-print' : ''} grid grid-cols-1 lg:grid-cols-2 gap-6`}>
        {/* Funds Ledger */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900">তহবিল অনুযায়ী স্থিতি (Funds Ledger)</h3>
              <p className="text-[11px] text-stone-500">মোট তহবিল: {store.funds.length}টি</p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-stone-400 block">তহবিলের মোট যোগফল:</span>
              <span className="text-base font-extrabold text-emerald-800 tabular-nums">
                ৳{totalFundBalance.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {store.funds.map((fund) => (
              <div
                key={fund.id}
                className={`flex items-center justify-between gap-2 p-3 rounded-xl border ${
                  fund.isActive ? 'bg-stone-50 border-stone-100' : 'bg-stone-100/80 border-stone-200 opacity-75'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900">
                      {fund.code}
                    </span>
                    <span className="text-xs font-bold text-stone-800">{fund.name}</span>
                    {!fund.isActive && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-700">
                        নিষ্ক্রিয়
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-400 mt-0.5 line-clamp-1">
                    {fund.description}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-sm font-bold text-stone-900 tabular-nums">
                    ৳{fund.currentBalance.toLocaleString()}
                  </div>
                  {permissions.can_manage_funds && !fund.isDefault && (
                    <div className="flex items-center gap-1 no-print">
                      <button
                        type="button"
                        onClick={() => handleToggleFundActive(fund.id)}
                        title={fund.isActive ? 'নিষ্ক্রিয় / আর্কাইভ করুন' : 'পুনরায় সক্রিয় করুন'}
                        className="p-1 text-stone-500 hover:text-amber-700 hover:bg-amber-50 rounded cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                      {deleteFundConfirmId === fund.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteFund(fund.id)}
                            className="px-1.5 py-0.5 rounded bg-red-700 text-white text-[10px] font-bold cursor-pointer"
                          >
                            নিশ্চিত
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteFundConfirmId(null)}
                            className="px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 text-[10px] cursor-pointer"
                          >
                            না
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteFundConfirmId(fund.id)}
                          title="অব্যবহৃত তহবিল মুছে ফেলুন"
                          className="p-1 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Accounts Ledger */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900">অ্যাকাউন্ট অনুযায়ী ব্যালেন্স (Bank & Cash)</h3>
              <p className="text-[11px] text-stone-500">মোট অ্যাকাউন্ট: {store.accounts.length}টি</p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-stone-400 block">অ্যাকাউন্টের মোট যোগফল:</span>
              <span className="text-base font-extrabold text-stone-900 tabular-nums">
                ৳{totalAccountBalance.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {store.accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-stone-200 text-stone-700 flex items-center justify-center">
                    {acc.type === 'bank' ? (
                      <Building className="w-4 h-4" />
                    ) : (
                      <Wallet className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-800">{acc.name}</div>
                    <div className="text-[11px] text-stone-400">
                      {acc.accountNumber || 'সাধারণ নগদ তহবিল'}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-bold text-stone-900 tabular-nums">
                  ৳{acc.currentBalance.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions History Table */}
      <div className={`${voucherModalTxn ? 'no-print' : ''} bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden`}>
        <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">আর্থিক লেনদেনের খতিয়ান (Ledger Records)</h3>
            <p className="text-xs text-stone-500">মোট লেনদেন রেকর্ড: {store.transactions.length}টি</p>
          </div>
          <div className="text-xs text-stone-500">
            * ফান্ড স্থানান্তরে আয় বা ব্যয় কোনোটিতেই ডাবল গণনা হয় না।
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-3 px-4">তারিখ ও কোড</th>
                <th className="py-3 px-4">ভাউচার নং</th>
                <th className="py-3 px-4">ধরন</th>
                <th className="py-3 px-4">তহবিল ও অ্যাকাউন্ট</th>
                <th className="py-3 px-4">বিবরণ ও পক্ষ</th>
                <th className="py-3 px-4 text-right">পরিমাণ (টাকা)</th>
                <th className="py-3 px-4 text-center">অবস্থা</th>
                <th className="py-3 px-4 text-center no-print">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {store.transactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-stone-500 text-xs">
                    এখনো কোনো আর্থিক লেনদেন যুক্ত হয়নি। উপরের "নতুন লেনদেন এন্ট্রি" বাটনে ক্লিক করে হিসাব শুরু করুন।
                  </td>
                </tr>
              )}
              {store.transactions.map((txn) => {
                const fund = store.funds.find((f) => f.id === txn.fundId);
                const toFund = store.funds.find((f) => f.id === txn.toFundId);
                const acc = store.accounts.find((a) => a.id === txn.accountId);

                return (
                  <tr key={txn.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-stone-900 font-bold">{txn.transactionCode}</div>
                      <div className="text-[11px] text-stone-400">{txn.createdAt.substring(0, 10)}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-stone-700">
                      {txn.voucherNo}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          txn.type === 'income'
                            ? 'bg-emerald-100 text-emerald-800'
                            : txn.type === 'expense'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {txn.type === 'income' ? (
                          <>
                            <TrendingUp className="w-3 h-3" /> আয়
                          </>
                        ) : txn.type === 'expense' ? (
                          <>
                            <TrendingDown className="w-3 h-3" /> ব্যয়
                          </>
                        ) : (
                          <>
                            <ArrowRightLeft className="w-3 h-3" /> স্থানান্তর
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-stone-900">
                        {fund?.name || txn.fundId}
                        {toFund && <span className="text-blue-600"> → {toFund.name}</span>}
                      </div>
                      <div className="text-[11px] text-stone-400">{acc?.name || txn.accountId}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-medium text-stone-900 truncate">{txn.category}</div>
                      <div className="text-[11px] text-stone-500 truncate">{txn.donorOrPayee}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-sm tabular-nums">
                      <span
                        className={
                          txn.type === 'income'
                            ? 'text-emerald-700'
                            : txn.type === 'expense'
                            ? 'text-red-600'
                            : 'text-blue-700'
                        }
                      >
                        {txn.type === 'income' ? '+' : txn.type === 'expense' ? '-' : ''}৳
                        {txn.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          txn.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : txn.status === 'pending_approval'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : txn.status === 'corrected'
                            ? 'bg-purple-50 text-purple-800 border border-purple-200'
                            : 'bg-red-50 text-red-800'
                        }`}
                      >
                        {txn.status === 'approved'
                          ? 'অনুমোদিত'
                          : txn.status === 'pending_approval'
                          ? 'অপেক্ষমাণ'
                          : txn.status === 'corrected'
                          ? 'সংশোধিত'
                          : 'বাতিল'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center no-print">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setVoucherModalTxn(txn)}
                          title="ভাউচার রশিদ দেখুন / প্রিন্ট"
                          className="p-1 text-stone-500 hover:text-emerald-700 hover:bg-stone-100 rounded cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {txn.status === 'pending_approval' && permissions.can_approve_finance && (
                          <>
                            <button
                              onClick={() => handleApproveTxn(txn.id)}
                              title="অনুমোদন করুন"
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setRejectModalTxn(txn);
                                setRejectReason('');
                              }}
                              title="বাতিল / প্রত্যাখ্যান করুন"
                              className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {(txn.status === 'pending_approval' || txn.status === 'rejected') &&
                          (store.currentRole === 'super_admin' ||
                            permissions.can_approve_finance ||
                            permissions.can_correct_finance) &&
                          (deleteConfirmTxnId === txn.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeletePendingTxn(txn.id)}
                                className="px-2 py-0.5 rounded bg-red-700 text-white text-[10px] font-bold cursor-pointer"
                              >
                                মুছুন
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmTxnId(null)}
                                className="px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 text-[10px] cursor-pointer"
                              >
                                না
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmTxnId(txn.id)}
                              title="অপেক্ষমাণ / বাতিলকৃত লেনদেন স্থায়ীভাবে মুছে ফেলুন"
                              className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ))}

                        {(txn.status === 'approved' || txn.status === 'corrected') &&
                          txn.amount > 0 &&
                          permissions.can_correct_finance && (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidModalTxn(txn);
                                setVoidReason('');
                              }}
                              title="কারণ লিখে ৳০ (রিভার্স/বাতিল) করুন"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>রিভার্স (৳০)</span>
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print-Only Signature Footer */}
      {!voucherModalTxn && (
        <div className="print-only pt-10 grid grid-cols-3 gap-6 text-center text-xs">
          <div>
            <div className="h-8 border-b border-dashed border-stone-400 mb-1" />
            <div className="font-semibold text-stone-800">অর্থ সম্পাদক / কোষাধ্যক্ষ</div>
          </div>
          <div>
            <div className="h-8 border-b border-dashed border-stone-400 mb-1" />
            <div className="font-semibold text-stone-800">সাধারণ সম্পাদক</div>
          </div>
          <div>
            <div className="h-8 border-b border-dashed border-stone-400 mb-1" />
            <div className="font-semibold text-stone-800">সভাপতি / সুপার অ্যাডমিন</div>
          </div>
        </div>
      )}

      {/* New Transaction Entry Modal with Dual Balance Verification */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-8 shadow-2xl max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="flex items-start justify-between pb-4 border-b border-stone-100 mb-6">
              <div>
                <h3 className="text-lg font-bold text-stone-900">নতুন আর্থিক লেনদেন অন্তর্ভুক্তকরণ</h3>
                <p className="text-xs text-stone-500">ভাউচার নম্বর ডুপ্লিকেট চেকার ও ব্যালেন্স সুরক্ষা সংযুক্ত।</p>
              </div>
              <button
                onClick={() => setShowEntryModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleTransactionSubmit} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`py-2 text-xs font-bold rounded-lg border cursor-pointer ${
                    type === 'income'
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-stone-50 text-stone-700 border-stone-200'
                  }`}
                >
                  আয় (Income)
                </button>
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`py-2 text-xs font-bold rounded-lg border cursor-pointer ${
                    type === 'expense'
                      ? 'bg-red-700 text-white border-red-700'
                      : 'bg-stone-50 text-stone-700 border-stone-200'
                  }`}
                >
                  ব্যয় (Expense)
                </button>
                <button
                  type="button"
                  onClick={() => setType('fund_transfer')}
                  className={`py-2 text-xs font-bold rounded-lg border cursor-pointer ${
                    type === 'fund_transfer'
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-stone-50 text-stone-700 border-stone-200'
                  }`}
                >
                  স্থানান্তর (Transfer)
                </button>
              </div>

              {/* Voucher & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    ভাউচার নম্বর *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="উদা: V-2026-10"
                    value={voucherNo}
                    onChange={(e) => setVoucherNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    পরিমাণ (টাকা) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Fund & Account Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {type === 'fund_transfer' ? 'উৎস তহবিল *' : 'তহবিল নির্বাচন *'}
                  </label>
                  <select
                    value={fundId}
                    onChange={(e) => setFundId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
                  >
                    {store.funds
                      .filter((f) => f.isActive)
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} (উদ্বৃত্ত: ৳{f.currentBalance.toLocaleString()})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {type === 'fund_transfer' ? 'উৎস পেমেন্ট অ্যাকাউন্ট *' : 'পেমেন্ট চ্যানেল *'}
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
                  >
                    {store.accounts
                      .filter((a) => a.isActive)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (ব্যালেন্স: ৳{a.currentBalance.toLocaleString()})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Target Fund and Target Account if fund_transfer */}
              {type === 'fund_transfer' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-blue-50/60 rounded-xl border border-blue-200">
                  <div>
                    <label className="block text-xs font-semibold text-blue-900 mb-1">
                      গন্তব্য তহবিল *
                    </label>
                    <select
                      value={toFundId}
                      onChange={(e) => setToFundId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-blue-300 rounded-lg bg-white"
                    >
                      {store.funds
                        .filter((f) => f.isActive)
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-blue-900 mb-1">
                      গন্তব্য অ্যাকাউন্ট *
                    </label>
                    <select
                      value={toAccountId}
                      onChange={(e) => setToAccountId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-blue-300 rounded-lg bg-white"
                    >
                      {store.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Category & Donor/Payee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">খাত / ক্যাটাগরি</label>
                  <input
                    type="text"
                    required
                    placeholder="উদা: সদস্য চাঁদা / চিকিৎসা সাহায্য"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">দাতা / প্রাপক</label>
                  <input
                    type="text"
                    placeholder="উদা: মো. আফজাল হোসেন"
                    value={donorOrPayee}
                    onChange={(e) => setDonorOrPayee(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">বিস্তারিত বিবরণ</label>
                <textarea
                  rows={2}
                  placeholder="লেনদেনের প্রেক্ষিত ও তথ্য..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>

              {/* Auto approve toggle if user has permission */}
              {permissions.can_approve_finance && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="autoApprove"
                    checked={autoApprove}
                    onChange={(e) => setAutoApprove(e.target.checked)}
                    className="rounded text-emerald-800"
                  />
                  <label htmlFor="autoApprove" className="text-xs text-stone-700 cursor-pointer">
                    তাৎক্ষণিক চূড়ান্ত অনুমোদন করুন এবং ব্যালেন্স হালনাগাদ করুন
                  </label>
                </div>
              )}

              <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 rounded-xl shadow cursor-pointer"
                >
                  লেনদেন সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Fund Modal */}
      {showFundModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <h3 className="text-base font-bold text-stone-900 mb-4">নতুন বিশেষায়িত তহবিল যুক্ত করুন</h3>
            <form onSubmit={handleAddFund} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">তহবিলের নাম *</label>
                <input
                  type="text"
                  required
                  placeholder="উদা: পাঠাগার ও প্রকাশনা তহবিল"
                  value={newFundName}
                  onChange={(e) => setNewFundName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">কোড (সংক্ষিপ্ত)</label>
                <input
                  type="text"
                  placeholder="উদা: LIB"
                  value={newFundCode}
                  onChange={(e) => setNewFundCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">উদ্দেশ্য / বিবরণ</label>
                <textarea
                  rows={2}
                  placeholder="তহবিলের উদ্দেশ্য সংক্ষেপে লিখুন..."
                  value={newFundDesc}
                  onChange={(e) => setNewFundDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFundModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-stone-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 text-white rounded-lg text-xs font-bold"
                >
                  তহবিল তৈরি করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <h3 className="text-base font-bold text-stone-900 mb-4">নতুন পেমেন্ট অ্যাকাউন্ট যুক্ত করুন</h3>
            <form onSubmit={handleAddAccount} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">অ্যাকাউন্টের নাম *</label>
                <input
                  type="text"
                  required
                  placeholder="উদা: রূপালী ব্যাংক লিমিটেড"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">ধরন</label>
                <select
                  value={newAccountType}
                  onChange={(e) => setNewAccountType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
                >
                  <option value="bank">ব্যাংক একাউন্ট (Bank Account)</option>
                  <option value="cash">নগদ ক্যাশ (Cash in Hand)</option>
                  <option value="mobile_banking">মোবাইল ব্যাংকিং (bKash/Nagad)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">অ্যাকাউন্ট / ফোন নম্বর</label>
                <input
                  type="text"
                  placeholder="হিসাব নম্বর বা মোবাইল নম্বর..."
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-stone-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 text-white rounded-lg text-xs font-bold"
                >
                  অ্যাকাউন্ট যুক্ত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Voucher Print / Preview Modal */}
      {voucherModalTxn && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-8 shadow-2xl relative max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <button
              onClick={() => setVoucherModalTxn(null)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1 no-print"
            >
              ×
            </button>

            {/* Official Voucher Header */}
            <div className="text-center pb-4 border-b-2 border-stone-800 mb-6 space-y-1">
              <h3 className="font-bold text-base text-stone-900">{store.settings.organizationNameBn}</h3>
              <p className="text-xs text-stone-500">কেন্দ্রীয় আর্থিক ভাউচার ও রসিদ</p>
              <div className="text-[11px] font-mono text-stone-600">
                ভাউচার নং: <strong>{voucherModalTxn.voucherNo}</strong> · ট্রানজাকশন কোড:{' '}
                {voucherModalTxn.transactionCode}
              </div>
            </div>

            <div className="space-y-3 text-xs mb-8">
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500">তারিখ:</span>
                <span className="font-semibold text-stone-800">{voucherModalTxn.createdAt}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500">লেনদেনের ধরন:</span>
                <span className="font-bold text-stone-900 uppercase">
                  {voucherModalTxn.type === 'income'
                    ? 'আয় (Income)'
                    : voucherModalTxn.type === 'expense'
                    ? 'ব্যয় (Expense)'
                    : 'ফান্ড স্থানান্তর'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500">তহবিল:</span>
                <span className="font-semibold text-stone-800">
                  {store.funds.find((f) => f.id === voucherModalTxn.fundId)?.name}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500">অ্যাকাউন্ট:</span>
                <span className="font-semibold text-stone-800">
                  {store.accounts.find((a) => a.id === voucherModalTxn.accountId)?.name}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500">খাত ও উদ্দেশ্য:</span>
                <span className="font-medium text-stone-800">{voucherModalTxn.category}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500">দাতা / প্রাপক:</span>
                <span className="font-medium text-stone-800">{voucherModalTxn.donorOrPayee}</span>
              </div>
              <div className="py-2 bg-stone-50 p-3 rounded-lg border border-stone-200 flex justify-between items-center text-sm font-bold">
                <span className="text-stone-800">মোট পরিমাণ:</span>
                <span className="text-emerald-800 font-mono text-base">
                  ৳{voucherModalTxn.amount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Signature Area */}
            <div className="pt-6 border-t border-stone-200 grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="h-8 border-b border-dashed border-stone-400 mb-1"></div>
                <div className="text-stone-600 font-medium">প্রস্তুতকারীর স্বাক্ষর</div>
                <div className="text-[10px] text-stone-400">{voucherModalTxn.createdByName}</div>
              </div>
              <div>
                <div className="h-8 border-b border-dashed border-stone-400 mb-1"></div>
                <div className="text-stone-600 font-medium">অনুমোদনকারীর স্বাক্ষর</div>
                <div className="text-[10px] text-stone-400">
                  {voucherModalTxn.approvedBy || 'অনুমোদনের অপেক্ষায়'}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-2 no-print">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>প্রিন্ট ভাউচার</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Transaction Reason Modal */}
      {rejectModalTxn && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <h3 className="text-base font-bold text-stone-900">
              লেনদেন বাতিল / প্রত্যাখ্যান ({rejectModalTxn.transactionCode})
            </h3>
            <p className="text-xs text-stone-600">
              অপেক্ষমাণ এই লেনদেনটি বাতিল করার কারণ উল্লেখ করুন (ব্যালেন্স অপরিবর্তিত থাকবে)।
            </p>
            <form onSubmit={handleRejectSubmit} className="space-y-3">
              <textarea
                rows={3}
                required
                minLength={3}
                placeholder="বাতিল করার কারণ লিখুন..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectModalTxn(null)}
                  className="px-3 py-1.5 text-xs text-stone-600 cursor-pointer"
                >
                  ফিরে যান
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  নিশ্চিত করে বাতিল করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Void / Reversal (৳0) Modal for Approved Transactions */}
      {voidModalTxn && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-700" />
              <span>অনুমোদিত লেনদেন রিভার্স / বাতিল (৳০)</span>
            </h3>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
              <div>
                লেনদেন কোড: <strong className="font-mono">{voidModalTxn.transactionCode}</strong> (ভাউচার:{' '}
                <strong className="font-mono">{voidModalTxn.voucherNo}</strong>)
              </div>
              <div>
                বর্তমান পরিমাণ: <strong className="font-mono">৳{voidModalTxn.amount.toLocaleString()}</strong>
              </div>
              <div className="text-[11px] text-amber-800 pt-1">
                সতর্কতা: এটি অডিট ট্রেইল অক্ষুণ্ণ রেখে লেনদেনের পরিমাণ ৳০ করবে এবং তহবিল ও অ্যাকাউন্ট ব্যালেন্স পূর্বাবস্থায় ফিরিয়ে নেবে।
              </div>
            </div>
            <form onSubmit={handleVoidTxnSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  বাতিল / রিভার্সের বিস্তারিত কারণ (কমপক্ষে ৫ অক্ষর) *
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={5}
                  placeholder="উদা: ভুলবশত ডাবল এন্ট্রি হয়েছিল অথবা চেক ডিজঅনার হওয়ায় লেনদেন বাতিল করা হলো..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVoidModalTxn(null)}
                  className="px-3 py-1.5 text-xs text-stone-600 cursor-pointer"
                >
                  ফিরে যান
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  কারণসহ রিভার্স (৳০) করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
