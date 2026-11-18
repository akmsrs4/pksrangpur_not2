/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from '../../db/store.ts';
import {
  Download,
  Database,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Server,
  FlaskConical,
  RotateCcw,
} from 'lucide-react';

export const AdminBackupView: React.FC = () => {
  const store = useAppStore();
  const permissions = store.getEffectivePermissions();

  const [inputJson, setInputJson] = useState('');
  const [dryRunResult, setDryRunResult] = useState<any | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmCleanReset, setConfirmCleanReset] = useState(false);

  if (!permissions.can_export_backup && store.currentRole !== 'super_admin') {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
        <Lock className="w-12 h-12 text-stone-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-stone-900">ব্যাকআপ ও রিস্টোর সেন্টার সুরক্ষিত</h3>
        <p className="text-xs text-stone-500">শুধুমাত্র সুপার অ্যাডমিনের জন্য ব্যাকআপ ও রিস্টোর সুবিধা অনুমোদিত।</p>
      </div>
    );
  }

  const handleDownloadBackup = () => {
    const jsonStr = store.exportFullBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patgram_samity_backup_${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const escapeCsvCell = (val: unknown) => {
    const raw = String(val ?? '');
    const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${neutralized.replace(/"/g, '""')}"`;
  };

  const handleDownloadCSV = () => {
    const headers = ['TransactionCode', 'VoucherNo', 'Type', 'Amount', 'Category', 'DonorOrPayee', 'Date', 'Status'];
    const rows = store.transactions.map((t) => [
      t.transactionCode,
      t.voucherNo,
      t.type,
      t.amount,
      t.category,
      t.donorOrPayee,
      t.createdAt,
      t.status,
    ]);

    const csvContent = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((r) => r.map(escapeCsvCell).join(',')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial_ledger_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDryRunTest = () => {
    setErrorMsg(null);
    setRestoreStatus(null);
    if (!inputJson.trim()) {
      setErrorMsg('অনুগ্রহ করে ব্যাকআপ JSON টেক্সট পেস্ট করুন অথবা ফাইল আপলোড করুন।');
      return;
    }

    const val = store.validateBackupJSON(inputJson);
    if (!val.isValid) {
      setErrorMsg(val.error || 'অকার্যকর ব্যাকআপ ফাইল।');
      setDryRunResult(null);
    } else {
      setDryRunResult(val.summary);
    }
  };

  const handleFinalRestore = () => {
    const res = store.restoreFromBackupJSON(inputJson);
    if (res.success) {
      setRestoreStatus('ডাটাবেজ সফলভাবে রিস্টোর ও সক্রিয় করা হয়েছে!');
      setDryRunResult(null);
      setInputJson('');
    } else {
      setErrorMsg(res.error || 'রিস্টোরে ত্রুটি হয়েছে।');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setInputJson(text);
      };
      reader.readAsText(file);
    }
  };

  const handleToggleSandbox = () => {
    setErrorMsg(null);
    setRestoreStatus(null);
    if (store.isSandboxDemoActive) {
      const res = store.exitDemoSandboxData();
      if (res.success) {
        setRestoreStatus('স্যান্ডবক্স ডেমো বন্ধ করে আপনার আসল প্রোডাকশন অবস্থা পুনঃস্থাপিত হয়েছে।');
      } else {
        setErrorMsg(res.error || 'ত্রুটি হয়েছে।');
      }
    } else {
      const res = store.loadDemoSandboxData();
      if (res.success) {
        setRestoreStatus('টেস্ট ও ডেমো স্যান্ডবক্স চালু হয়েছে। পরীক্ষা শেষে আবার এক ক্লিকে আসল অবস্থায় ফিরতে পারবেন।');
      } else {
        setErrorMsg(res.error || 'ত্রুটি হয়েছে।');
      }
    }
  };

  const handleCleanReset = () => {
    setErrorMsg(null);
    setRestoreStatus(null);
    const res = store.resetToCleanProduction();
    setConfirmCleanReset(false);
    if (res.success) {
      setRestoreStatus('সকল পরীক্ষামূলক তথ্য মুছে ক্লিন প্রোডাকশন অবস্থা (৳০) পুনঃস্থাপিত হয়েছে।');
    } else {
      setErrorMsg(res.error || 'রিসেট ব্যর্থ হয়েছে।');
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-700" />
            <span>ডাটাবেজ ব্যাকআপ ও ড্রাই-রান রিস্টোর টেস্ট সেন্টার</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            কোনো একক ক্লাউড বা হোস্টিংয়ের ওপর নির্ভরশীল না থেকে ১-ক্লিকে অফলাইন ব্যাকআপ এবং সত্যতা পরীক্ষা।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadBackup}
            className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>১-ক্লিক সম্পূর্ণ ব্যাকআপ (JSON)</span>
          </button>
          <button
            onClick={handleDownloadCSV}
            className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs border border-stone-200 flex items-center gap-1.5 cursor-pointer"
          >
            <FileCode className="w-4 h-4" />
            <span>এক্সেল লেজার (CSV)</span>
          </button>
        </div>
      </div>

      {restoreStatus && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{restoreStatus}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Isolated Sandbox & Clean Reset Panel (Super Admin Only) */}
      {store.authenticatedRole === 'super_admin' && (
        <div className="p-6 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-amber-700" />
                <span>টেস্ট ও ডেমো স্যান্ডবক্স বনাম প্রোডাকশন ডাটা পৃথকীকরণ</span>
              </h3>
              <p className="text-xs text-amber-800">
                প্রকৃত হিসাব শুরু করার আগে চাইলে নমুনা ডেটা লোড করে ফিচারগুলো পরীক্ষা করতে পারেন; পরীক্ষা শেষে এক ক্লিকেই আসল ডাটায় ফিরে যাওয়া যাবে।
              </p>
            </div>
            <button
              onClick={handleToggleSandbox}
              className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs cursor-pointer shrink-0 ${
                store.isSandboxDemoActive
                  ? 'bg-emerald-800 hover:bg-emerald-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              {store.isSandboxDemoActive ? 'ডেমো বন্ধ করে আসল অবস্থায় ফিরুন' : 'টেস্টের জন্য ডেমো ডেটা লোড করুন'}
            </button>
          </div>

          <div className="pt-3 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-[11px] text-amber-900">
              সকল তহবিল ও হিসাব সম্পূর্ণ শূন্য (৳০) অবস্থায় রিসেট করতে চাইলে (আপনার সুপার অ্যাডমিন লগইন অক্ষত থাকবে):
            </span>
            {!confirmCleanReset ? (
              <button
                onClick={() => setConfirmCleanReset(true)}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ক্লিন প্রোডাকশন রিসেট (৳০)</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCleanReset}
                  className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold cursor-pointer"
                >
                  হ্যাঁ, নিশ্চিত মুছে ফেলুন
                </button>
                <button
                  onClick={() => setConfirmCleanReset(false)}
                  className="px-3 py-1.5 rounded-lg bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  বাতিল
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Supabase Free Plan Status Card */}
      <div className="p-5 rounded-2xl bg-stone-900 text-stone-200 border border-stone-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-white">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Supabase PostgreSQL কেন্দ্রীয় ক্লাউড কানেকশন গাইড</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
            সম্পূর্ণ বিনামূল্যে (100% Free Plan)
          </span>
        </div>
        <p className="text-xs text-stone-400 leading-relaxed">
          আপনার প্রজেক্টের রুটে <code className="text-amber-400 font-mono">supabase/schema.sql</code> ফাইলে সম্পূর্ণ PostgreSQL টেবিল, অপরিবর্তনীয় অডিট ট্রিগার ও RLS পলিসি স্ক্রিপ্ট প্রস্তুত রয়েছে। আপনি Supabase Free একাউন্টে ঢুকে SQL এডিটরে পেস্ট করলেই ক্লাউড ডাটাবেজ তৈরি হয়ে যাবে।
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-stone-300 pt-2 border-t border-stone-800">
          <div>• ৫০০ MB ডাটাবেজ (টেক্সট ও আর্থিক রেকর্ডে পর্যাপ্ত)</div>
          <div>• ১ GB ফাইল স্টোরেজ (ছবি ও ভাউচার রসিদ)</div>
          <div>• ৭ দিনের ইনঅ্যাক্টিভিটি নোটিফিকেশন ও সংরক্ষণ</div>
        </div>
      </div>

      {/* Restore Test Section */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-5">
        <div>
          <h3 className="text-base font-bold text-stone-900">
            রিস্টোর ড্রাই-রান টেস্ট ও ডাটা রিকভারি (Safe Restore Test)
          </h3>
          <p className="text-xs text-stone-500">
            পরীক্ষা ছাড়া কোনো ডাটাবেজ ওভাররাইট করা হয় না। ফাইল আপলোড করে প্রথমে 'ড্রাই-রান টেস্ট' করুন।
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-stone-700">
              ব্যাকআপ JSON ফাইল আপলোড করুন অথবা নিচে পেস্ট করুন:
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="text-xs text-stone-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100 cursor-pointer"
            />
          </div>

          <textarea
            rows={5}
            placeholder='{"version": "6.0", "data": { ... }}'
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-emerald-600"
          />

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleDryRunTest}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              ড্রাই-রান টেস্ট চালান (Dry-Run Test)
            </button>
          </div>
        </div>

        {dryRunResult && (
          <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-300 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>ড্রাই-রান টেস্ট সফল: ব্যাকআপ ফাইলটি নির্ভুল ও সামঞ্জস্যপূর্ণ!</span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  dryRunResult.isDualBalanceMatched
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-red-200 text-red-900'
                }`}
              >
                {dryRunResult.isDualBalanceMatched ? 'ডুয়াল ব্যালেন্স ১০০% মিল' : 'ব্যালেন্স গরমিল'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white p-3 rounded-xl border border-emerald-200">
              <div>
                <span className="text-stone-400 block">মোট সদস্য:</span>
                <span className="font-bold text-stone-900">{dryRunResult.membersCount} জন</span>
              </div>
              <div>
                <span className="text-stone-400 block">মোট লেনদেন:</span>
                <span className="font-bold text-stone-900">{dryRunResult.transactionsCount}টি</span>
              </div>
              <div>
                <span className="text-stone-400 block">তহবিল যোগফল:</span>
                <span className="font-bold text-emerald-800">৳{dryRunResult.fundBalanceSum.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-stone-400 block">অ্যাকাউন্ট যোগফল:</span>
                <span className="font-bold text-stone-900">৳{dryRunResult.accountBalanceSum.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-stone-600">
                আপনি কি নিশ্চিত যে বর্তমান ডাটাবেজ এই ব্যাকআপ দ্বারা রিস্টোর করবেন?
              </span>
              <button
                onClick={handleFinalRestore}
                className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow cursor-pointer"
              >
                হ্যাঁ, নিশ্চিত করে রিস্টোর সম্পন্ন করুন
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
