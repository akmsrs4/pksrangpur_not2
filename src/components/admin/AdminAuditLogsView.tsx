/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from '../../db/store.ts';
import { ShieldCheck, Search, Filter, Hash, Clock, User, Lock, Printer } from 'lucide-react';

export const AdminAuditLogsView: React.FC = () => {
  const store = useAppStore();
  const permissions = store.getEffectivePermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');

  if (store.currentRole !== 'super_admin' && !permissions.can_view_reports) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
        <Lock className="w-12 h-12 text-stone-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-stone-900">অডিট ট্রেইল সুরক্ষিত</h3>
        <p className="text-xs text-stone-500 mt-1">
          অডিট লগ দেখার অনুমতি কেবল সুপার অ্যাডমিন ও অনুমোদিত আর্থিক পর্যবেক্ষকের জন্য সংরক্ষিত।
        </p>
      </div>
    );
  }

  const filteredLogs = store.auditLogs.filter((log) => {
    const matchesAction = selectedAction === 'all' || log.action === selectedAction;
    const matchesSearch =
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.currentHash.includes(searchQuery);

    return matchesAction && matchesSearch;
  });

  const actions = Array.from(new Set(store.auditLogs.map((l) => l.action)));

  return (
    <div className="space-y-6">
      <div className="print-only border-b-2 border-stone-800 pb-3 mb-4 text-center">
        <h1 className="text-xl font-bold text-stone-900">{store.settings.organizationNameBn}</h1>
        <p className="text-xs text-stone-600">
          অপরিবর্তনীয় অডিট লগ প্রতিবেদন — মোট রেকর্ড: {filteredLogs.length}টি | তারিখ: {new Date().toISOString().substring(0, 10)}
        </p>
      </div>

      {/* Banner */}
      <div className="no-print bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <span>অপরিবর্তনীয় অডিট ট্রেইল (Immutable Audit Logs)</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            অ্যাডমিন প্যানেল থেকে কোনো লগ মোছা সম্ভব নয়; ডাটাবেজ ট্রিগার ও ক্রিপ্টোগ্রাফিক হ্যাশ চেইনে সংরক্ষিত।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-900 font-bold font-mono">
            মোট রেকর্ড: {store.auditLogs.length}টি
          </span>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>অডিট রিপোর্ট PDF</span>
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-stone-200">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-stone-400" />
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50"
          >
            <option value="all">সকল অ্যাকশন টাইপ</option>
            {actions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="বিবরণ, কর্মকর্তা বা হ্যাশ খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-emerald-600"
          />
        </div>
      </div>

      {/* Audit Logs Stream */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-stone-100">
          {filteredLogs.slice().reverse().map((log) => (
            <div key={log.id} className="p-4 sm:p-5 hover:bg-stone-50/70 transition-colors space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-200">
                    {log.action}
                  </span>
                  <span className="text-xs font-bold text-stone-900 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-stone-400" />
                    <span>{log.actorName}</span>
                    <span className="text-[11px] text-stone-400 font-normal">({log.actorRole})</span>
                  </span>
                </div>
                <div className="text-xs text-stone-400 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{log.timestamp}</span>
                </div>
              </div>

              <p className="text-xs text-stone-700 leading-relaxed font-medium">
                {log.description}
              </p>

              {/* Cryptographic Hash Verification Line */}
              <div className="pt-2 flex flex-wrap items-center gap-3 text-[10px] text-stone-400 font-mono">
                <div className="flex items-center gap-1">
                  <Hash className="w-3 h-3 text-stone-400" />
                  <span>বর্তমান হ্যাশ: <strong className="text-stone-600">{log.currentHash}</strong></span>
                </div>
                <div className="text-stone-300">|</div>
                <div>
                  পূর্ববর্তী হ্যাশ: <span className="text-stone-500">{log.previousHash || 'GENESIS'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
