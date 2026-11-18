/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from '../../db/store.ts';
import {
  Shield,
  LayoutDashboard,
  DollarSign,
  FileEdit,
  Users,
  ShieldCheck,
  Database,
  History,
  Settings,
  ArrowLeft,
  UserCheck,
  LogOut,
  Bell,
  AlertTriangle,
  CalendarDays,
} from 'lucide-react';
import { AdminOverview } from './AdminOverview.tsx';
import { AdminFinanceView } from './AdminFinanceView.tsx';
import { AdminCorrectionsView } from './AdminCorrectionsView.tsx';
import { AdminMembersView } from './AdminMembersView.tsx';
import { AdminCommitteesView } from './AdminCommitteesView.tsx';
import { AdminPermissionsView } from './AdminPermissionsView.tsx';
import { AdminBackupView } from './AdminBackupView.tsx';
import { AdminAuditLogsView } from './AdminAuditLogsView.tsx';
import { AdminSettingsView } from './AdminSettingsView.tsx';
import { AdminNoticesAidView } from './AdminNoticesAidView.tsx';
import { AdminEventsView } from './AdminEventsView.tsx';
import { AdminAuthGate } from './AdminAuthGate.tsx';
import { Role } from '../../types.ts';

interface AdminPortalProps {
  onBackToPublic: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onBackToPublic }) => {
  const store = useAppStore();
  const [activeAdminTab, setActiveAdminTab] = useState('overview');

  if (!store.isAuthenticated) {
    return <AdminAuthGate onBackToPublic={onBackToPublic} />;
  }

  const roleLabels: Record<Role, string> = {
    super_admin: 'সুপার অ্যাডমিন (Super Admin)',
    finance_secretary: 'অর্থ সম্পাদক (Finance Secretary)',
    president: 'সভাপতি (President)',
    general_secretary: 'সাধারণ সম্পাদক (General Secretary)',
    general_admin: 'সাধারণ সদস্য অ্যাডমিন',
    student_admin: 'ছাত্র সংগঠন অ্যাডমিন',
    event_admin: 'অনুষ্ঠান ও আয়োজন অ্যাডমিন (Event Admin)',
  };

  const effectivePerms = store.getEffectivePermissions();
  const canAccessEvents = Boolean(
    store.currentRole === 'super_admin' ||
      effectivePerms.can_event_view_module ||
      effectivePerms.can_event_create ||
      effectivePerms.can_event_view_applications
  );

  const allNavItems = [
    { id: 'overview', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
    { id: 'finance', label: 'আর্থিক খতিয়ান', icon: DollarSign },
    { id: 'corrections', label: 'আর্থিক সংশোধন', icon: FileEdit },
    { id: 'members', label: 'সদস্য প্রশাসন', icon: Users },
    { id: 'events', label: 'অনুষ্ঠান ও আয়োজন', icon: CalendarDays },
    { id: 'committees', label: 'কমিটি ও পদবি', icon: ShieldCheck },
    { id: 'notices-aid', label: 'নোটিশ ও সহায়তা', icon: Bell },
    { id: 'permissions', label: 'পারমিশন ও কর্মকর্তা', icon: UserCheck },
    { id: 'backup', label: 'ব্যাকআপ ও রিস্টোর', icon: Database },
    { id: 'audit', label: 'অডিট লগ', icon: History },
    { id: 'settings', label: 'সিস্টেম সেটিংস', icon: Settings },
  ];

  const navItems = allNavItems.filter((item) => {
    if (item.id === 'permissions') return store.authenticatedRole === 'super_admin';
    if (item.id === 'events') return canAccessEvents;
    return true;
  });

  return (
    <div className="min-h-screen bg-stone-100/90 text-stone-900 pb-20">
      {/* Top Admin Control Bar */}
      <div className="no-print bg-stone-900 text-white px-4 sm:px-8 py-3.5 border-b border-stone-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToPublic}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>পাবলিক ওয়েবসাইটে ফিরুন</span>
          </button>
          <div className="h-4 w-px bg-stone-700 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-800 text-amber-400 flex items-center justify-center font-bold text-xs">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-white block leading-tight">
                {store.settings.organizationNameBn} — অ্যাডমিন কনসোল
              </span>
              <span className="text-[11px] text-stone-400">
                লগইন: <strong className="text-emerald-300">{store.currentUser.name}</strong> ({store.authenticatedEmail})
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {store.authenticatedRole === 'super_admin' ? (
            <div className="flex items-center gap-2 bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800 text-xs">
              <span className="text-stone-400">রোল প্রিভিউ:</span>
              <select
                value={store.currentRole}
                onChange={(e) => store.switchRole(e.target.value as Role)}
                className="bg-stone-900 text-amber-300 font-semibold px-2 py-1 rounded-md border border-stone-700 focus:outline-none cursor-pointer"
              >
                {(Object.keys(roleLabels) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r]}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-stone-800 text-amber-300 text-xs font-semibold">
              দায়িত্ব: {roleLabels[store.authenticatedRole]}
            </div>
          )}

          <button
            onClick={() => store.logout()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/70 hover:bg-red-900 text-red-200 border border-red-800/60 text-xs font-bold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>লগআউট</span>
          </button>
        </div>
      </div>

      {/* Sandbox Demo Mode Active Warning */}
      {store.isSandboxDemoActive && (
        <div className="no-print bg-amber-600 text-white px-4 sm:px-8 py-2.5 text-xs font-bold flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>সতর্কতা: বর্তমানে টেস্ট ও ডেমো স্যান্ডবক্স মোড চালু আছে (এটি আসল হিসাব নয়)।</span>
          </div>
          {store.authenticatedRole === 'super_admin' && (
            <button
              onClick={() => store.exitDemoSandboxData()}
              className="px-3 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-amber-300 text-[11px] font-bold cursor-pointer"
            >
              ডেমো বন্ধ করে আসল অবস্থায় ফিরুন
            </button>
          )}
        </div>
      )}

      {/* Database Sync Error Notification */}
      {store.lastSyncError && (
        <div className="no-print bg-red-700 text-white px-4 sm:px-8 py-2.5 text-xs font-semibold flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-300" />
            <span>ডাটাবেজ সিঙ্ক সতর্কতা: {store.lastSyncError}</span>
          </div>
          <button
            onClick={() => store.clearSyncError()}
            className="px-3 py-1 rounded-lg bg-red-900 hover:bg-red-950 text-white text-[11px] font-bold cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      )}

      {/* Main Admin Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="no-print flex items-center gap-1.5 overflow-x-auto pb-4 mb-6 border-b border-stone-200 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeAdminTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveAdminTab(item.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-emerald-800 text-white shadow-sm'
                    : 'bg-white text-stone-600 hover:bg-stone-200/80 border border-stone-200/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div>
          {activeAdminTab === 'overview' && <AdminOverview setActiveTab={setActiveAdminTab} />}
          {activeAdminTab === 'finance' && <AdminFinanceView />}
          {activeAdminTab === 'corrections' && <AdminCorrectionsView />}
          {activeAdminTab === 'members' && <AdminMembersView />}
          {activeAdminTab === 'events' && <AdminEventsView />}
          {activeAdminTab === 'committees' && <AdminCommitteesView />}
          {activeAdminTab === 'notices-aid' && <AdminNoticesAidView />}
          {activeAdminTab === 'permissions' && store.authenticatedRole === 'super_admin' && (
            <AdminPermissionsView />
          )}
          {activeAdminTab === 'backup' && <AdminBackupView />}
          {activeAdminTab === 'audit' && <AdminAuditLogsView />}
          {activeAdminTab === 'settings' && <AdminSettingsView />}
        </div>
      </div>
    </div>
  );
};
