/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from '../../db/store.ts';
import {
  FileEdit,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Lock,
  Search,
  Check,
  Printer,
} from 'lucide-react';
import { FinancialCorrection, FinancialTransaction } from '../../types.ts';

export const AdminCorrectionsView: React.FC = () => {
  const store = useAppStore();
  const permissions = store.getEffectivePermissions();

  const [selectedTxnId, setSelectedTxnId] = useState<string>('');
  const [correctedAmount, setCorrectedAmount] = useState<number>(0);
  const [correctedCategory, setCorrectedCategory] = useState<string>('');
  const [correctedFundId, setCorrectedFundId] = useState<string>('');
  const [correctedAccountId, setCorrectedAccountId] = useState<string>('');
  const [correctedToFundId, setCorrectedToFundId] = useState<string>('');
  const [correctedToAccountId, setCorrectedToAccountId] = useState<string>('');
  const [correctedDonorOrPayee, setCorrectedDonorOrPayee] = useState<string>('');
  const [correctedDescription, setCorrectedDescription] = useState<string>('');
  const [correctionReason, setCorrectionReason] = useState<string>('');

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!permissions.can_view_finance && !permissions.can_correct_finance) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
        <Lock className="w-12 h-12 text-stone-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-stone-900">সংশোধন প্যানেল সুরক্ষিত</h3>
        <p className="text-xs text-stone-500">আপনার রোলের জন্য আর্থিক সংশোধনের অনুমতি নেই।</p>
      </div>
    );
  }

  // Pre-fill form when user picks a transaction to correct
  const handleSelectTxn = (txnId: string) => {
    setSelectedTxnId(txnId);
    const txn = store.transactions.find((t) => t.id === txnId);
    if (txn) {
      setCorrectedAmount(txn.amount);
      setCorrectedCategory(txn.category);
      setCorrectedFundId(txn.fundId);
      setCorrectedAccountId(txn.accountId);
      setCorrectedToFundId(txn.toFundId || '');
      setCorrectedToAccountId(txn.toAccountId || '');
      setCorrectedDonorOrPayee(txn.donorOrPayee);
      setCorrectedDescription(txn.description);
      setCorrectionReason('');
    }
  };

  const selectedTxn = store.transactions.find((t) => t.id === selectedTxnId);

  const handleProposeCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const res = store.requestCorrection({
      originalTransactionId: selectedTxnId,
      correctedAmount: Number(correctedAmount),
      correctedCategory,
      correctedFundId,
      correctedAccountId,
      correctedToFundId: selectedTxn?.type === 'fund_transfer' ? correctedToFundId || undefined : undefined,
      correctedToAccountId: selectedTxn?.type === 'fund_transfer' ? correctedToAccountId || undefined : undefined,
      correctedDonorOrPayee,
      correctedDescription,
      correctionReason,
    });

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `সংশোধনী প্রস্তাব ${res.correction?.correctionCode} সফলভাবে তৈরি হয়েছে! (${
          res.correction?.requiresDualApproval
            ? 'পার্থক্য ৩০,০০০ টাকার অধিক হওয়ায় অন্য দায়িত্বপ্রাপ্তের অনুমোদনের অপেক্ষায় রয়েছে'
            : 'সরাসরি কার্যকর হয়েছে'
        })`,
      });
      setSelectedTxnId('');
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'সংশোধন প্রক্রিয়াকরণে ত্রুটি হয়েছে।',
      });
    }
  };

  const handleApprove = (corrId: string) => {
    const res = store.approveCorrection(corrId, 'যাচাইপূর্বক অনুমোদন প্রদান করা হলো।');
    if (res.success) {
      setStatusMessage({ type: 'success', text: 'আর্থিক সংশোধনী সফলভাবে অনুমোদিত ও ব্যালেন্স হালনাগাদ হয়েছে!' });
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'অনুমোদনে ত্রুটি হয়েছে।' });
    }
  };

  const threshold = store.settings.correctionThresholdAmount || 30000;
  const approvedTxns = store.transactions.filter((t) => t.status === 'approved' || t.status === 'corrected');

  return (
    <div className="space-y-8">
      {/* Print-Only Header */}
      <div className="print-only border-b-2 border-stone-800 pb-3 mb-4 text-center">
        <h1 className="text-xl font-bold text-stone-900">{store.settings.organizationNameBn}</h1>
        <p className="text-xs text-stone-600">আর্থিক সংশোধন ও ডুয়াল-অ্যাপ্রুভাল অডিট রিপোর্ট — তারিখ: {new Date().toISOString().substring(0, 10)}</p>
      </div>

      {/* Header Banner */}
      <div className="no-print bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-emerald-700" />
            <span>আর্থিক এন্ট্রি সংশোধন ও অপরিবর্তনীয় অডিট হিস্ট্রি</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            কোনো এন্ট্রি সরাসরি মোছা যায় না; মূল লেনদেন বহাল রেখে সাইড-বাই-সাইড সংশোধনী ট্র্যাক করা হয়।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(permissions.can_export_reports || permissions.can_view_correction_history || store.currentRole === 'super_admin') && (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>সংশোধন রিপোর্ট PDF</span>
            </button>
          )}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center gap-2 max-w-md">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              পার্থক্য <strong>৳{threshold.toLocaleString()}</strong>-এর বেশি হলে কাউন্টার অনুমোদন বাধ্যতামূলক (সুপার অ্যাডমিন সরাসরি কার্যকর করতে পারেন)।
            </span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Propose a Correction Section */}
      {permissions.can_correct_finance && (
        <div className="no-print bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-5">
          <h3 className="text-base font-bold text-stone-900">
            অনুমোদিত লেনদেনের ভুল সংশোধনী প্রস্তাব করুন
          </h3>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-stone-700">
              ১. যে লেনদেনের তথ্যে ভুল রয়েছে তা নির্বাচন করুন:
            </label>
            <select
              value={selectedTxnId}
              onChange={(e) => handleSelectTxn(e.target.value)}
              className="w-full px-3 py-2.5 text-xs border border-stone-300 rounded-lg bg-stone-50 font-medium"
            >
              <option value="">-- লেনদেন নির্বাচন করুন --</option>
              {approvedTxns.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.transactionCode} ({t.voucherNo}) — ৳{t.amount.toLocaleString()} — {t.category} ({t.donorOrPayee})
                </option>
              ))}
            </select>
          </div>

          {selectedTxnId && (
            <form onSubmit={handleProposeCorrection} className="p-5 bg-stone-50/80 rounded-xl border border-stone-200 space-y-4">
              <div className="text-xs font-bold text-stone-800 pb-2 border-b border-stone-200">
                সংশোধিত নতুন তথ্য পূরণ করুন:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    সংশোধিত পরিমাণ (টাকা) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={correctedAmount}
                    onChange={(e) => setCorrectedAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono font-bold bg-white"
                  />
                  <p className="text-[11px] text-stone-500 mt-1">
                    ০ দিলে লেনদেনটি সম্পূর্ণ বাতিল (রিভার্স) হয়ে তহবিল ও অ্যাকাউন্ট ব্যালেন্স পূর্বাবস্থায় ফিরে যাবে।
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    সংশোধিত খাত / ক্যাটাগরি *
                  </label>
                  <input
                    type="text"
                    required
                    value={correctedCategory}
                    onChange={(e) => setCorrectedCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">সংশোধিত তহবিল</label>
                  <select
                    value={correctedFundId}
                    onChange={(e) => setCorrectedFundId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
                  >
                    {store.funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">সংশোধিত পেমেন্ট অ্যাকাউন্ট</label>
                  <select
                    value={correctedAccountId}
                    onChange={(e) => setCorrectedAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
                  >
                    {store.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedTxn?.type === 'fund_transfer' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-stone-200/70">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">সংশোধিত গন্তব্য তহবিল (To Fund)</label>
                    <select
                      value={correctedToFundId}
                      onChange={(e) => setCorrectedToFundId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
                    >
                      <option value="">-- অপরিবর্তিত / প্রযোজ্য নয় --</option>
                      {store.funds.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">সংশোধিত গন্তব্য পেমেন্ট অ্যাকাউন্ট (To Account)</label>
                    <select
                      value={correctedToAccountId}
                      onChange={(e) => setCorrectedToAccountId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
                    >
                      <option value="">-- অপরিবর্তিত / প্রযোজ্য নয় --</option>
                      {store.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  সংশোধনের বিস্তারিত কারণ (বাধ্যতামূলক) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="উদা: ক্যাশ ভাউচারে অঙ্কের টাইপিং ভুল হয়েছিল অথবা অনুদানের খাত ভুল তহবিলে যুক্ত হয়েছিল..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedTxnId('')}
                  className="px-4 py-2 text-xs text-stone-600 hover:bg-stone-200 rounded-lg cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 rounded-xl shadow cursor-pointer"
                >
                  সংশোধনী সাবমিট করুন
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Corrections History & Audit Trail with Side-by-Side Comparison */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              আর্থিক সংশোধনের সম্পূর্ণ ইতিহাস ও অডিট রেকর্ড
            </h3>
            <p className="text-xs text-stone-500">
              প্রতিটি সংশোধনে মূল লেনদেনের সাথে সংশোধিত তথ্যের স্পষ্ট তুলনা।
            </p>
          </div>
          <span className="text-xs font-bold text-stone-700 px-3 py-1 bg-stone-100 rounded-lg">
            মোট সংশোধন রেকর্ড: {store.corrections.length}টি
          </span>
        </div>

        {store.corrections.length > 0 ? (
          <div className="p-6 space-y-6">
            {store.corrections.map((corr) => {
              const origTxn = store.transactions.find((t) => t.id === corr.originalTransactionId);

              return (
                <div
                  key={corr.id}
                  className="p-5 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-4"
                >
                  {/* Header of Correction Record */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-xs px-2.5 py-1 rounded bg-purple-100 text-purple-900 border border-purple-200">
                        {corr.correctionCode}
                      </span>
                      <span className="text-xs text-stone-600">
                        মূল লেনদেন: <strong className="font-mono text-stone-900">{origTxn?.transactionCode || corr.originalTransactionId}</strong> ({origTxn?.voucherNo})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          corr.approvalStatus === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {corr.approvalStatus === 'approved' ? 'অনুমোদিত ও কার্যকর' : 'অনুমোদনের অপেক্ষায় (Pending)'}
                      </span>

                      {corr.approvalStatus === 'pending_approval' && permissions.can_approve_finance && (
                        <button
                          onClick={() => handleApprove(corr.id)}
                          className="px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>অনুমোদন দিন</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Side-by-Side Comparison Box */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Previous Information */}
                    <div className="p-4 bg-white rounded-xl border border-stone-200 space-y-2 text-xs">
                      <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider pb-1 border-b border-stone-100">
                        পূর্ববর্তী তথ্য (আসল রেকর্ড)
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">পরিমাণ:</span>
                        <span className="font-mono font-bold text-stone-900 line-through text-red-600">
                          ৳{corr.previousAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">খাত:</span>
                        <span className="text-stone-700">{corr.previousCategory}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">তহবিল:</span>
                        <span className="text-stone-700">
                          {store.funds.find((f) => f.id === corr.previousFundId)?.name || corr.previousFundId}
                        </span>
                      </div>
                    </div>

                    {/* Corrected Information */}
                    <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2 text-xs">
                      <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider pb-1 border-b border-emerald-100">
                        সংশোধিত নতুন তথ্য
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500">পরিমাণ:</span>
                        <span className="font-mono font-bold text-emerald-800 text-sm flex items-center gap-1.5">
                          ৳{corr.correctedAmount.toLocaleString()}
                          {corr.correctedAmount === 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-sans">
                              পূর্ণ বাতিল / রিভার্স
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">খাত:</span>
                        <span className="text-emerald-950 font-medium">{corr.correctedCategory}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">তহবিল:</span>
                        <span className="text-emerald-950 font-medium">
                          {store.funds.find((f) => f.id === corr.correctedFundId)?.name || corr.correctedFundId}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mandatory Reason Box */}
                  <div className="p-3 bg-white rounded-xl border border-stone-200 text-xs">
                    <span className="font-bold text-stone-800">সংশোধনের কারণ: </span>
                    <span className="text-stone-700">{corr.correctionReason}</span>
                  </div>

                  {/* Metadata Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400 pt-1">
                    <div>
                      প্রস্তাবক: <strong className="text-stone-700">{corr.correctedByName}</strong> ({corr.correctedByRole})
                    </div>
                    {corr.approvedBy && (
                      <div>
                        অনুমোদনকারী: <strong className="text-emerald-800">{corr.approvedBy}</strong> ({corr.approvedAt})
                      </div>
                    )}
                    <div>তারিখ: {corr.createdAt}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-stone-500 text-xs">
            এখনো কোনো আর্থিক সংশোধনী প্রস্তাব বা রেকর্ড তৈরি হয়নি।
          </div>
        )}
      </div>
    </div>
  );
};
