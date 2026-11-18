/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from '../../db/store.ts';
import {
  Users,
  DollarSign,
  AlertCircle,
  FileText,
  TrendingUp,
  ShieldCheck,
  ArrowRightLeft,
  Printer,
  CalendarDays,
} from 'lucide-react';

interface AdminOverviewProps {
  setActiveTab: (tab: string) => void;
}

type PdfReportScope = 'full_summary' | 'funds_accounts' | 'ledger_corrections';

export const AdminOverview: React.FC<AdminOverviewProps> = ({ setActiveTab }) => {
  const store = useAppStore();
  const permissions = store.getEffectivePermissions();
  const [selectedPdfScope, setSelectedPdfScope] = useState<PdfReportScope>('full_summary');

  const canManageAnyMembers = Boolean(permissions.can_manage_members || permissions.can_manage_student_wing);
  const canViewFinance = Boolean(permissions.can_view_finance);
  const canApproveFinance = Boolean(permissions.can_approve_finance);
  const canManageAid = Boolean(permissions.can_manage_funds || permissions.can_manage_student_wing || store.currentRole === 'super_admin');
  const canViewAudit = Boolean(store.currentRole === 'super_admin' || permissions.can_view_reports);

  // Respects Super Admin configurable permissions (both role preset and individual officer overrides)
  const canExportFinancialPDF = Boolean(
    store.currentRole === 'super_admin' || (permissions.can_view_finance && permissions.can_export_reports)
  );

  const pendingMembers = canManageAnyMembers ? store.members.filter((m) => m.status === 'pending') : [];
  const pendingTxns = canViewFinance ? store.transactions.filter((t) => t.status === 'pending_approval') : [];
  const pendingCorrections = canViewFinance ? store.corrections.filter((c) => c.approvalStatus === 'pending_approval') : [];
  const pendingAids = canManageAid ? store.aidApplications.filter((a) => a.status === 'submitted') : [];

  const totalFundBalance = store.funds.reduce((acc, f) => acc + f.currentBalance, 0);
  const totalAccountBalance = store.accounts.reduce((acc, a) => acc + a.currentBalance, 0);
  const isDualBalanceMatched = Math.abs(totalFundBalance - totalAccountBalance) < 0.01;

  const approvedTxns = store.transactions.filter((t) => t.status === 'approved' || t.status === 'corrected');
  const totalApprovedIncome = approvedTxns
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalApprovedExpense = approvedTxns
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalMembers = store.members.filter((m) => m.status === 'active').length;

  const handleExportToPDF = () => {
    if (!canExportFinancialPDF) return;
    store.logAudit(
      'EXPORT_FINANCIAL_PDF',
      'report',
      selectedPdfScope,
      `${store.currentUser.name} (${store.currentRole}) ড্যাশবোর্ড থেকে আর্থিক রিপোর্ট (${selectedPdfScope}) Export to PDF করেছেন।`
    );
    window.print();
  };

  const reportTitleMap: Record<PdfReportScope, string> = {
    full_summary: 'কেন্দ্রীয় আর্থিক সারাংশ ও পূর্ণাঙ্গ প্রতিবেদন',
    funds_accounts: '৭টি তহবিল ও ব্যাংক/ক্যাশ স্থিতি প্রতিবেদন',
    ledger_corrections: 'আর্থিক লেনদেন খতিয়ান ও সংশোধন অডিট প্রতিবেদন',
  };

  return (
    <div className="space-y-8">
      {/* Official Print-Only Financial Summary & Reports Document (Rendered ONLY for authorized finance roles) */}
      {canExportFinancialPDF && (
        <div className="print-only space-y-6 text-stone-900">
          <div className="border-b-2 border-stone-900 pb-4 text-center space-y-1">
            <h1 className="text-xl font-bold">{store.settings.organizationNameBn}</h1>
            <p className="text-xs text-stone-600">{store.settings.officeAddress}</p>
            <div className="text-sm font-bold pt-1">{reportTitleMap[selectedPdfScope]}</div>
            <div className="text-[11px] text-stone-600">
              তারিখ: {new Date().toISOString().substring(0, 10)} | প্রস্তুতকারক: {store.currentUser.name}
            </div>
          </div>

          {/* Summary Totals Strip */}
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="p-3 border border-stone-300 rounded">
              <div className="text-stone-500">মোট অনুমোদিত আয়</div>
              <div className="font-bold text-sm text-emerald-800">৳{totalApprovedIncome.toLocaleString()}</div>
            </div>
            <div className="p-3 border border-stone-300 rounded">
              <div className="text-stone-500">মোট অনুমোদিত ব্যয়</div>
              <div className="font-bold text-sm text-red-700">৳{totalApprovedExpense.toLocaleString()}</div>
            </div>
            <div className="p-3 border border-stone-300 rounded">
              <div className="text-stone-500">মোট তহবিল স্থিতি</div>
              <div className="font-bold text-sm">৳{totalFundBalance.toLocaleString()}</div>
            </div>
            <div className="p-3 border border-stone-300 rounded">
              <div className="text-stone-500">ব্যাংক ও ক্যাশ স্থিতি</div>
              <div className="font-bold text-sm">
                ৳{totalAccountBalance.toLocaleString()} ({isDualBalanceMatched ? 'মিল রয়েছে' : 'অমিল'})
              </div>
            </div>
          </div>

          {/* Funds & Accounts Breakdown */}
          {(selectedPdfScope === 'full_summary' || selectedPdfScope === 'funds_accounts') && (
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <h3 className="font-bold mb-2 border-b border-stone-300 pb-1">তহবিল অনুযায়ী স্থিতি</h3>
                <table className="w-full border border-stone-300">
                  <thead className="bg-stone-100">
                    <tr>
                      <th className="p-1.5 text-left border-b border-stone-300">কোড ও তহবিল</th>
                      <th className="p-1.5 text-right border-b border-stone-300">ব্যালেন্স</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.funds.map((f) => (
                      <tr key={f.id} className="border-b border-stone-200">
                        <td className="p-1.5">[{f.code}] {f.name}</td>
                        <td className="p-1.5 text-right font-mono font-bold">৳{f.currentBalance.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="font-bold mb-2 border-b border-stone-300 pb-1">অ্যাকাউন্ট অনুযায়ী স্থিতি</h3>
                <table className="w-full border border-stone-300">
                  <thead className="bg-stone-100">
                    <tr>
                      <th className="p-1.5 text-left border-b border-stone-300">অ্যাকাউন্ট</th>
                      <th className="p-1.5 text-right border-b border-stone-300">ব্যালেন্স</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.accounts.map((a) => (
                      <tr key={a.id} className="border-b border-stone-200">
                        <td className="p-1.5">{a.name}</td>
                        <td className="p-1.5 text-right font-mono font-bold">৳{a.currentBalance.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ledger & Corrections Table */}
          {(selectedPdfScope === 'full_summary' || selectedPdfScope === 'ledger_corrections') && (
            <div className="space-y-4 text-xs">
              <div>
                <h3 className="font-bold mb-2 border-b border-stone-300 pb-1">
                  আর্থিক লেনদেন খতিয়ান ({store.transactions.length}টি)
                </h3>
                <table className="w-full border border-stone-300 text-[11px]">
                  <thead className="bg-stone-100">
                    <tr>
                      <th className="p-1.5 text-left border-b border-stone-300">তারিখ ও কোড</th>
                      <th className="p-1.5 text-left border-b border-stone-300">ভাউচার</th>
                      <th className="p-1.5 text-left border-b border-stone-300">ধরন ও খাত</th>
                      <th className="p-1.5 text-left border-b border-stone-300">অবস্থা</th>
                      <th className="p-1.5 text-right border-b border-stone-300">পরিমাণ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-stone-500">কোনো লেনদেন রেকর্ড নেই।</td>
                      </tr>
                    ) : (
                      store.transactions.map((t) => (
                        <tr key={t.id} className="border-b border-stone-200">
                          <td className="p-1.5">{t.createdAt.substring(0, 10)} ({t.transactionCode})</td>
                          <td className="p-1.5 font-mono">{t.voucherNo}</td>
                          <td className="p-1.5">
                            {t.type === 'income' ? 'আয়' : t.type === 'expense' ? 'ব্যয়' : 'স্থানান্তর'} — {t.category}
                          </td>
                          <td className="p-1.5">{t.status}</td>
                          <td className="p-1.5 text-right font-mono font-bold">৳{t.amount.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {store.corrections.length > 0 && (
                <div>
                  <h3 className="font-bold mb-2 border-b border-stone-300 pb-1">
                    আর্থিক সংশোধন হিস্ট্রি ({store.corrections.length}টি)
                  </h3>
                  <table className="w-full border border-stone-300 text-[11px]">
                    <thead className="bg-stone-100">
                      <tr>
                        <th className="p-1.5 text-left border-b border-stone-300">কোড ও তারিখ</th>
                        <th className="p-1.5 text-right border-b border-stone-300">পূর্বের অঙ্ক</th>
                        <th className="p-1.5 text-right border-b border-stone-300">সংশোধিত অঙ্ক</th>
                        <th className="p-1.5 text-left border-b border-stone-300">কারণ</th>
                        <th className="p-1.5 text-left border-b border-stone-300">অবস্থা</th>
                      </tr>
                    </thead>
                    <tbody>
                      {store.corrections.map((c) => (
                        <tr key={c.id} className="border-b border-stone-200">
                          <td className="p-1.5">{c.correctionCode} ({c.createdAt.substring(0, 10)})</td>
                          <td className="p-1.5 text-right font-mono">৳{c.previousAmount.toLocaleString()}</td>
                          <td className="p-1.5 text-right font-mono font-bold">৳{c.correctedAmount.toLocaleString()}</td>
                          <td className="p-1.5">{c.correctionReason}</td>
                          <td className="p-1.5">{c.approvalStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Official Signature Strip */}
          <div className="pt-10 grid grid-cols-3 gap-6 text-center text-xs">
            <div>
              <div className="h-8 border-b border-dashed border-stone-400 mb-1" />
              <div className="font-bold">অর্থ সম্পাদক / কোষাধ্যক্ষ</div>
            </div>
            <div>
              <div className="h-8 border-b border-dashed border-stone-400 mb-1" />
              <div className="font-bold">সাধারণ সম্পাদক</div>
            </div>
            <div>
              <div className="h-8 border-b border-dashed border-stone-400 mb-1" />
              <div className="font-bold">সভাপতি / সুপার অ্যাডমিন</div>
            </div>
          </div>
        </div>
      )}

      {/* Alert banner if there are pending actions */}
      {(pendingMembers.length > 0 || pendingTxns.length > 0 || pendingCorrections.length > 0 || pendingAids.length > 0) && (
        <div className="no-print p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm">অনুমোদনের অপেক্ষায় পেন্ডিং কার্যক্রম রয়েছে</div>
              <div className="text-xs text-amber-700 flex flex-wrap gap-x-2">
                {canManageAnyMembers && <span>{pendingMembers.length} জন সদস্য আবেদন</span>}
                {canViewFinance && <span>· {pendingTxns.length}টি আর্থিক এন্ট্রি</span>}
                {canViewFinance && <span>· {pendingCorrections.length}টি আর্থিক সংশোধনী</span>}
                {canManageAid && <span>· {pendingAids.length}টি মানবিক সহায়তা আবেদন</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pendingMembers.length > 0 && canManageAnyMembers && (
              <button
                onClick={() => setActiveTab('members')}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
              >
                সদস্য যাচাই ({pendingMembers.length})
              </button>
            )}
            {pendingTxns.length > 0 && canApproveFinance && (
              <button
                onClick={() => setActiveTab('finance')}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
              >
                লেনদেন অনুমোদন ({pendingTxns.length})
              </button>
            )}
            {pendingCorrections.length > 0 && canApproveFinance && (
              <button
                onClick={() => setActiveTab('corrections')}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                সংশোধন ({pendingCorrections.length})
              </button>
            )}
            {pendingAids.length > 0 && canManageAid && (
              <button
                onClick={() => setActiveTab('notices-aid')}
                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold cursor-pointer"
              >
                সহায়তা আবেদন ({pendingAids.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Active Members */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span>সক্রিয় সদস্য সংখ্যা</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-stone-900 tabular-nums">
            {canManageAnyMembers ? `${totalMembers} জন` : 'সুরক্ষিত'}
          </div>
          <div className="text-xs text-stone-500 flex items-center justify-between pt-1 border-t border-stone-100">
            <span>পেন্ডিং আবেদন:</span>
            <span className="font-semibold text-amber-600">
              {canManageAnyMembers ? `${pendingMembers.length} জন` : '-'}
            </span>
          </div>
        </div>

        {/* Total Fund Balance (If authorized) */}
        {permissions.can_view_finance ? (
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
              <span>মোট তহবিল উদ্বৃত্ত</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-800 tabular-nums">
              ৳{totalFundBalance.toLocaleString()}
            </div>
            <div className="text-xs text-stone-500 flex items-center justify-between pt-1 border-t border-stone-100">
              <span>সক্রিয় তহবিল সংখ্যা:</span>
              <span className="font-semibold text-stone-800">{store.funds.filter((f) => f.isActive).length}টি</span>
            </div>
          </div>
        ) : (
          <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2 opacity-75">
            <div className="text-xs text-stone-500 font-medium">আর্থিক তথ্য</div>
            <div className="text-sm font-semibold text-stone-600">সুরক্ষিত (অনুমতি প্রয়োজন)</div>
            <div className="text-[11px] text-stone-400">সুপার অ্যাডমিনের অনুমতি প্রয়োজন</div>
          </div>
        )}

        {/* Total Accounts Balance (If authorized) */}
        {permissions.can_view_finance ? (
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
              <span>ব্যাংক ও নগদ ক্যাশ ব্যালেন্স</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-stone-900 tabular-nums">
              ৳{totalAccountBalance.toLocaleString()}
            </div>
            <div className="text-xs flex items-center justify-between pt-1 border-t border-stone-100">
              <span className="text-stone-500">ডুয়াল ব্যালেন্স সামঞ্জস্য:</span>
              <span className={`font-bold ${isDualBalanceMatched ? 'text-emerald-700' : 'text-red-600'}`}>
                {isDualBalanceMatched ? '১০০% নির্ভুল মিল' : 'অমিল চিহ্নিত'}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2 opacity-75">
            <div className="text-xs text-stone-500 font-medium">অ্যাকাউন্ট ব্যালেন্স</div>
            <div className="text-sm font-semibold text-stone-600">সুরক্ষিত</div>
            <div className="text-[11px] text-stone-400">অনুমতি নেই</div>
          </div>
        )}

        {/* Security & Audit Count */}
        {canViewAudit ? (
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
              <span>নিরাপত্তা ও অডিট লগ</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-stone-900 tabular-nums">
              {store.auditLogs.length}টি লগ
            </div>
            <div className="text-xs text-stone-500 flex items-center justify-between pt-1 border-t border-stone-100">
              <span>ক্রিপ্টোগ্রাফিক হ্যাশ চেইন:</span>
              <span className="font-semibold text-emerald-700">সুরক্ষিত ও সক্রিয়</span>
            </div>
          </div>
        ) : (
          <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2 opacity-75">
            <div className="text-xs text-stone-500 font-medium">সিস্টেম অডিট</div>
            <div className="text-sm font-semibold text-stone-600">সুরক্ষিত</div>
            <div className="text-[11px] text-stone-400">সুপার অ্যাডমিনের জন্য সংরক্ষিত</div>
          </div>
        )}
      </div>

      {/* Authorized Financial Summary & Reports PDF Export Center (Strictly only Treasurer, Secretary, President, Super Admin) */}
      {canExportFinancialPDF && (
        <div className="no-print bg-emerald-950 text-white p-5 sm:p-6 rounded-2xl border border-emerald-800 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <FileText className="w-4 h-4" />
              <span>আর্থিক সারাংশ ও রিপোর্ট ডাউনলোড কেন্দ্র</span>
            </div>
            <p className="text-xs text-emerald-200">
              সুপার অ্যাডমিনের অনুমোদিত কর্মকর্তাগণ এখান থেকে অফিসিয়াল আর্থিক PDF প্রতিবেদন ডাউনলোড ও প্রিন্ট করতে পারবেন।
            </p>
            <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-emerald-100">
              <span>অনুমোদিত আয়: <strong className="text-amber-300">৳{totalApprovedIncome.toLocaleString()}</strong></span>
              <span>অনুমোদিত ব্যয়: <strong className="text-red-300">৳{totalApprovedExpense.toLocaleString()}</strong></span>
              <span>নিট স্থিতি: <strong className="text-white">৳{totalFundBalance.toLocaleString()}</strong></span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <select
              value={selectedPdfScope}
              onChange={(e) => setSelectedPdfScope(e.target.value as PdfReportScope)}
              className="px-3 py-2.5 rounded-xl bg-emerald-900 border border-emerald-700 text-xs text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="full_summary">সম্পূর্ণ আর্থিক সারাংশ ও রিপোর্ট</option>
              <option value="funds_accounts">৭টি তহবিল ও ব্যাংক/ক্যাশ স্থিতি</option>
              <option value="ledger_corrections">লেনদেন খতিয়ান ও সংশোধন হিস্ট্রি</option>
            </select>
            <button
              type="button"
              onClick={handleExportToPDF}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-extrabold flex items-center justify-center gap-2 shadow cursor-pointer transition-colors whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>Export to PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* Funds Breakdown Quick Strip (If permitted) */}
      {permissions.can_view_finance && (
        <div className="no-print bg-white p-6 rounded-2xl border border-stone-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-stone-900">
              ৭টি বিশেষায়িত তহবিল ও ব্যালেন্স স্থিতি
            </h3>
            <button
              onClick={() => setActiveTab('finance')}
              className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
            >
              সম্পূর্ণ আর্থিক লেজার দেখুন →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {store.funds.map((fund) => (
              <div
                key={fund.id}
                className="p-4 rounded-xl border border-stone-200 bg-stone-50/60 hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                    {fund.code}
                  </span>
                  <span className="text-[11px] text-stone-400">তহবিল</span>
                </div>
                <div className="text-xs font-semibold text-stone-800 line-clamp-1 mb-1">
                  {fund.name}
                </div>
                <div className="text-base font-bold text-stone-900 tabular-nums">
                  ৳{fund.currentBalance.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Action Buttons */}
      <div className="no-print grid grid-cols-2 sm:grid-cols-4 gap-4">
        {canManageAnyMembers && (
          <button
            onClick={() => setActiveTab('members')}
            className="p-4 rounded-xl bg-white border border-stone-200 hover:border-emerald-500 hover:shadow-sm text-left transition-all cursor-pointer"
          >
            <Users className="w-5 h-5 text-emerald-700 mb-2" />
            <div className="text-xs font-bold text-stone-900">সদস্য প্রশাসন</div>
            <div className="text-[11px] text-stone-500">আবেদন যাচাই ও অনুমোদন</div>
          </button>
        )}

        {permissions.can_entry_finance && (
          <button
            onClick={() => setActiveTab('finance')}
            className="p-4 rounded-xl bg-white border border-stone-200 hover:border-emerald-500 hover:shadow-sm text-left transition-all cursor-pointer"
          >
            <DollarSign className="w-5 h-5 text-emerald-700 mb-2" />
            <div className="text-xs font-bold text-stone-900">আর্থিক এন্ট্রি ও ভাউচার</div>
            <div className="text-[11px] text-stone-500">আয়, ব্যয় ও স্থানান্তর</div>
          </button>
        )}

        {permissions.can_manage_committees && (
          <button
            onClick={() => setActiveTab('committees')}
            className="p-4 rounded-xl bg-white border border-stone-200 hover:border-emerald-500 hover:shadow-sm text-left transition-all cursor-pointer"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-700 mb-2" />
            <div className="text-xs font-bold text-stone-900">কমিটি ও পদবি</div>
            <div className="text-[11px] text-stone-500">পদবি যুক্ত ও আর্কাইভ</div>
          </button>
        )}

        {(permissions.can_event_view_module ||
          permissions.can_event_create ||
          permissions.can_event_view_applications ||
          store.currentRole === 'super_admin') && (
          <button
            onClick={() => setActiveTab('events')}
            className="p-4 rounded-xl bg-white border border-stone-200 hover:border-emerald-500 hover:shadow-sm text-left transition-all cursor-pointer"
          >
            <CalendarDays className="w-5 h-5 text-emerald-700 mb-2" />
            <div className="text-xs font-bold text-stone-900">অনুষ্ঠান ও আয়োজন</div>
            <div className="text-[11px] text-stone-500">{store.events.length}টি অনুষ্ঠান · উপস্থিতি ও ফান্ড</div>
          </button>
        )}

        {(permissions.can_export_backup || store.currentRole === 'super_admin') && (
          <button
            onClick={() => setActiveTab('backup')}
            className="p-4 rounded-xl bg-white border border-stone-200 hover:border-emerald-500 hover:shadow-sm text-left transition-all cursor-pointer"
          >
            <ArrowRightLeft className="w-5 h-5 text-emerald-700 mb-2" />
            <div className="text-xs font-bold text-stone-900">ব্যাকআপ ও রিস্টোর টেস্ট</div>
            <div className="text-[11px] text-stone-500">১-ক্লিক ফুল ডাটা এক্সপোর্ট</div>
          </button>
        )}
      </div>
    </div>
  );
};
