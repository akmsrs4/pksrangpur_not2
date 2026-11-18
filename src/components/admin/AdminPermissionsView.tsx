/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../db/store.ts';
import { supabase, isSupabaseConfigured } from '../../lib/supabase.ts';
import {
  ShieldCheck,
  Lock,
  ShieldAlert,
  UserPlus,
  Users,
  CheckCircle2,
  XCircle,
  History,
  RefreshCw,
  SlidersHorizontal,
  RotateCcw,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { AdminPermissions, AdminUserAccount, Role } from '../../types.ts';

export const AdminPermissionsView: React.FC = () => {
  const store = useAppStore();
  const permissions = store.rolePermissions;

  const [selectedRole, setSelectedRole] = useState<Role>('finance_secretary');
  const [supabaseProfiles, setSupabaseProfiles] = useState<AdminUserAccount[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  // Per-officer individual permission modal
  const [editingOfficer, setEditingOfficer] = useState<AdminUserAccount | null>(null);

  // New Officer Form (Local Mode)
  const [newOfficerName, setNewOfficerName] = useState('');
  const [newOfficerEmail, setNewOfficerEmail] = useState('');
  const [newOfficerPassword, setNewOfficerPassword] = useState('');
  const [newOfficerRole, setNewOfficerRole] = useState<Role>('finance_secretary');
  const [accountMsg, setAccountMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [confirmDeleteOfficerId, setConfirmDeleteOfficerId] = useState<string | null>(null);
  const [isDeletingOfficer, setIsDeletingOfficer] = useState(false);

  const loadProfiles = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || store.authenticatedRole !== 'super_admin') return;
    setIsLoadingProfiles(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, role, status, created_at')
        .order('created_at', { ascending: false });
      if (error) {
        setAccountMsg({ type: 'error', text: `কর্মকর্তার তালিকা লোড করতে সমস্যা: ${error.message}` });
      } else if (data) {
        setSupabaseProfiles(
          data.map((p: Record<string, unknown>) => ({
            id: String(p.id),
            email: String(p.email),
            fullName: String(p.full_name),
            phone: p.phone ? String(p.phone) : undefined,
            role: p.role as Role,
            status: p.status as AdminUserAccount['status'],
            createdAt: String(p.created_at),
          }))
        );
      }
    } finally {
      setIsLoadingProfiles(false);
    }
  }, [store.authenticatedRole]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  if (store.currentRole !== 'super_admin') {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
        <Lock className="w-12 h-12 text-stone-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-stone-900">পারমিশন কন্ট্রোল সংরক্ষিত</h3>
        <p className="text-xs text-stone-500">
          শুধুমাত্র সুপার অ্যাডমিন (Super Admin) অন্যান্য কর্মকর্তাদের রোল ও অনুমতি নির্ধারণ করতে পারেন।
        </p>
      </div>
    );
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

  const permissionDefinitions: { key: keyof AdminPermissions; label: string; group: string }[] = [
    { key: 'can_view_finance', label: 'আর্থিক তথ্য ও হিসাব প্রদর্শন (View Financial Info)', group: 'অর্থ ও তহবিল' },
    { key: 'can_entry_finance', label: 'নতুন আয়/ব্যয় এন্ট্রি তৈরি (Make Financial Entry)', group: 'অর্থ ও তহবিল' },
    { key: 'can_approve_finance', label: 'আর্থিক এন্ট্রি চূড়ান্ত অনুমোদন (Approve Transactions)', group: 'অর্থ ও তহবিল' },
    { key: 'can_view_reports', label: 'আর্থিক রিপোর্ট ও খতিয়ান প্রদর্শন (View Reports)', group: 'অর্থ ও তহবিল' },
    { key: 'can_export_reports', label: 'আর্থিক সামারি ও ভাউচার এক্সপোর্ট/প্রিন্ট (Export Reports)', group: 'অর্থ ও তহবিল' },
    { key: 'can_correct_finance', label: 'ভুল আর্থিক এন্ট্রি সংশোধনের প্রস্তাব (Make Correction)', group: 'অর্থ ও তহবিল' },
    { key: 'can_view_correction_history', label: 'সংশোধন ইতিহাস ও অডিট ট্রেইল দেখা (View Correction History)', group: 'অর্থ ও তহবিল' },
    { key: 'can_manage_funds', label: 'নতুন তহবিল তৈরি ও ব্যবস্থাপনা (Fund Management)', group: 'তহবিল ও অ্যাকাউন্ট' },
    { key: 'can_manage_accounts', label: 'নতুন ব্যাংক/ক্যাশ অ্যাকাউন্ট যুক্ত করা (Account Management)', group: 'তহবিল ও অ্যাকাউন্ট' },
    { key: 'can_manage_members', label: 'সাধারণ সদস্য আবেদন যাচাই ও অনুমোদন (Manage Members)', group: 'সদস্যপদ' },
    { key: 'can_manage_student_wing', label: 'ছাত্র সদস্যদের আবেদন ও উইং ব্যবস্থাপনা (Student Wing)', group: 'সদস্যপদ' },
    { key: 'can_manage_committees', label: 'কমিটি তৈরি ও পদবি সংযোজন/লুকানো (Manage Committees)', group: 'সাংগঠনিক' },
    { key: 'can_manage_notices', label: 'বিজ্ঞপ্তি ও প্রেস বিজ্ঞপ্তি প্রকাশ/মুছে ফেলা (Manage Notices)', group: 'সাংগঠনিক' },
    { key: 'can_manage_settings', label: 'সিস্টেম সেটিংস ও যোগাযোগের তথ্য পরিবর্তন (Manage Settings)', group: 'সিস্টেম' },
    { key: 'can_export_backup', label: 'ডাটাবেজ ব্যাকআপ ও রিস্টোর (Export/Restore Database)', group: 'সিস্টেম' },
    { key: 'can_event_view_module', label: 'অনুষ্ঠান মডিউল প্রবেশাধিকার (View Event Module)', group: 'অনুষ্ঠান ও আয়োজন' },
    { key: 'can_event_create', label: 'নতুন অনুষ্ঠান তৈরি (Create Event)', group: 'অনুষ্ঠান ও আয়োজন' },
    { key: 'can_event_edit', label: 'অনুষ্ঠান তথ্য ও স্ট্যাটাস সম্পাদনা (Edit Event)', group: 'অনুষ্ঠান ও আয়োজন' },
    { key: 'can_event_manage_categories', label: 'অংশগ্রহণ ক্যাটাগরি ও ফি নির্ধারণ (Fee Categories)', group: 'অনুষ্ঠান ও আয়োজন' },
    { key: 'can_event_view_applications', label: 'অংশগ্রহণ আবেদন তালিকা দেখা (View Applications)', group: 'অনুষ্ঠান ও আয়োজন' },
    { key: 'can_event_approve_application', label: 'উপস্থিতি অনুমোদন/প্রত্যাখ্যান ও স্পট এন্ট্রি', group: 'অনুষ্ঠান ও আয়োজন' },
    { key: 'can_event_verify_payment', label: 'পেমেন্ট যাচাই ও বকেয়া সংগ্রহ (Verify Payment)', group: 'অনুষ্ঠান ও আয়োজন' },
    { key: 'can_event_manage_refund', label: 'ভেরিফায়েড পেমেন্ট রিফান্ড (Manage Refunds)', group: 'অনুষ্ঠান ও আয়োজন' },
    { key: 'can_event_manage_ledger', label: 'অনুষ্ঠান ফান্ডে অনুদান ও খরচ এন্ট্রি (Event Ledger)', group: 'অনুষ্ঠান ও আয়োজন' },
    { key: 'can_event_view_finance_summary', label: 'অনুষ্ঠান ফান্ড ও আয়-ব্যয় সারসংক্ষেপ দেখা', group: 'অনুষ্ঠান ও আয়োজন' },
    { key: 'can_event_export_reports', label: '৯টি অনুষ্ঠান রিপোর্ট (PDF ও CSV) এক্সপোর্ট', group: 'অনুষ্ঠান ও আয়োজন' },
    { key: 'can_event_manage_settings', label: 'অনুষ্ঠান পাবলিশ ও নিবন্ধন সেটিংস পরিবর্তন', group: 'অনুষ্ঠান ও আয়োজন' },
    { key: 'can_event_view_logs', label: 'অনুষ্ঠান সংক্রান্ত অডিট লগ দেখা (Event Logs)', group: 'অনুষ্ঠান ও আয়োজন' },
    { key: 'can_event_delete_test_data', label: 'খসড়া অনুষ্ঠান ও অবৈধ টেস্ট আবেদন মোছা (Delete Test)', group: 'অনুষ্ঠান ও আয়োজন' },
  ];

  const handleToggle = (key: keyof AdminPermissions, currentVal: boolean) => {
    if (selectedRole === 'super_admin') return;
    store.updateRolePermission(selectedRole, key, !currentVal);
  };

  const handleCreateOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMsg(null);
    if (isSupabaseConfigured) {
      const res = await store.createOfficerViaEdgeFunction({
        fullName: newOfficerName,
        email: newOfficerEmail,
        password: newOfficerPassword,
        role: newOfficerRole,
      });
      if (res.success) {
        setAccountMsg({
          type: 'success',
          text: `নতুন কর্মকর্তা "${newOfficerName}" (${newOfficerEmail}) সরাসরি লাইভ ডাটাবেজে তৈরি ও সক্রিয় হয়েছে।`,
        });
        setNewOfficerName('');
        setNewOfficerEmail('');
        setNewOfficerPassword('');
        await loadProfiles();
      } else {
        setAccountMsg({ type: 'error', text: res.error || 'অ্যাকাউন্ট তৈরিতে ত্রুটি হয়েছে।' });
      }
      return;
    }

    const res = await store.createOfficerBySuperAdmin({
      fullName: newOfficerName,
      email: newOfficerEmail,
      password: newOfficerPassword,
      role: newOfficerRole,
    });
    if (res.success) {
      setAccountMsg({
        type: 'success',
        text: `নতুন কর্মকর্তা "${newOfficerName}" (${newOfficerEmail})-এর লগইন অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।`,
      });
      setNewOfficerName('');
      setNewOfficerEmail('');
      setNewOfficerPassword('');
    } else {
      setAccountMsg({ type: 'error', text: res.error || 'অ্যাকাউন্ট তৈরিতে ত্রুটি হয়েছে।' });
    }
  };

  const handleSupabaseUserUpdate = async (id: string, updates: { role?: Role; status?: AdminUserAccount['status'] }) => {
    if (!supabase) return;
    setAccountMsg(null);
    const targetAcc = supabaseProfiles.find((p) => p.id === id);

    let updateErr: { message: string } | null = null;
    const { error: rpcErr } = await supabase.rpc('approve_officer_profile', {
      p_user_id: id,
      p_role: updates.role || null,
      p_status: updates.status || null,
    });
    if (rpcErr) {
      const msg = (rpcErr.message || '').toLowerCase();
      if (rpcErr.code === '42883' || rpcErr.code === 'PGRST202' || msg.includes('could not find the function')) {
        const { error: directErr } = await supabase.from('profiles').update(updates).eq('id', id);
        updateErr = directErr;
      } else {
        updateErr = rpcErr;
      }
    }

    if (updateErr) {
      setAccountMsg({ type: 'error', text: `কর্মকর্তা আপডেট ব্যর্থ হয়েছে: ${updateErr.message}` });
      return;
    }
    setSupabaseProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    const effectiveRole = updates.role || targetAcc?.role;
    if (effectiveRole && (updates.role || updates.status === 'active')) {
      const shouldUsePreset = Boolean(updates.role || targetAcc?.status === 'pending_approval');
      await store.syncSingleUserPermissionsToSupabase(id, effectiveRole, {
        useRolePreset: shouldUsePreset,
      });
    }
    setAccountMsg({
      type: 'success',
      text: 'কর্মকর্তার অ্যাকাউন্ট তথ্য ও রোল অনুযায়ী পারমিশন সফলভাবে হালনাগাদ হয়েছে।',
    });
  };

  const handleDeleteOfficer = async (acc: AdminUserAccount) => {
    if (isDeletingOfficer) return;
    setAccountMsg(null);
    setIsDeletingOfficer(true);
    try {
      const res = isSupabaseConfigured
        ? await store.deleteSupabaseOfficer(acc.id)
        : store.deleteAdminAccount(acc.id);
      setConfirmDeleteOfficerId(null);
      if (res.success) {
        if (isSupabaseConfigured) {
          setSupabaseProfiles((prev) => prev.filter((p) => p.id !== acc.id));
        }
        setAccountMsg({
          type: 'success',
          text: `কর্মকর্তা "${acc.fullName}" (${acc.email})-এর অ্যাকাউন্ট নিরাপদভাবে মুছে ফেলা হয়েছে।`,
        });
      } else {
        setAccountMsg({
          type: 'error',
          text: res.error || 'কর্মকর্তা অ্যাকাউন্ট মুছে ফেলা যায়নি।',
        });
      }
    } finally {
      setIsDeletingOfficer(false);
    }
  };

  const handleForceSyncRole = async () => {
    setSyncNotice('ডাটাবেজে পারমিশন সিঙ্ক হচ্ছে...');
    const res = await store.syncRolePermissionsBatchToSupabase(selectedRole);
    if (res.success) {
      setSyncNotice(
        res.count > 0
          ? `সফলভাবে ${res.count} জন "${roleLabels[selectedRole]}" অ্যাকাউন্টের পারমিশন ডাটাবেজে সংরক্ষিত হয়েছে।`
          : `বর্তমানে "${roleLabels[selectedRole]}" রোল-এ কোনো নিবন্ধিত অ্যাকাউন্ট নেই, তবে সেটিংস সংরক্ষিত আছে।`
      );
    } else {
      setSyncNotice(`সিঙ্ক ত্রুটি: ${res.error}`);
    }
  };

  const accountsList = isSupabaseConfigured ? supabaseProfiles : store.adminAccounts;
  const pendingApprovalAccounts = accountsList.filter((a) => a.status === 'pending_approval');

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <span>সুপার অ্যাডমিন পারমিশন ও কর্মকর্তা অ্যাকাউন্ট কন্ট্রোল</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            এখান থেকেই অর্থ সম্পাদক, সভাপতি বা অন্যান্য কর্মকর্তার অ্যাকাউন্ট অনুমোদন, রোল নির্ধারণ এবং ব্যক্তিগত অনুমতি নিয়ন্ত্রণ করুন।
          </p>
        </div>

        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>প্রতিটি পারমিশন পরিবর্তনের ইতিহাস অপরিবর্তনীয় অডিট লগে সংরক্ষিত হয়।</span>
        </div>
      </div>

      {/* Pending Officer Registration Alert */}
      {pendingApprovalAccounts.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">
                নতুন {pendingApprovalAccounts.length} জন কর্মকর্তা নিবন্ধন অনুমোদনের অপেক্ষায় রয়েছে!
              </div>
              <div className="text-amber-800 mt-0.5">
                নিচের তালিকা থেকে যাচাই করে রোল নির্ধারণ ও “অনুমোদন দিন” বাটনে ক্লিক করলে তারা লগইন করতে পারবেন।
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin User Accounts & Officer Approvals */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700" />
              <span>নিবন্ধিত কর্মকর্তা ও অ্যাডমিন অ্যাকাউন্ট তালিকা ({accountsList.length} জন)</span>
            </h3>
            <span className="text-[11px] text-stone-500">
              নতুন নিবন্ধন করলে এখান থেকে অনুমোদন, রোল পরিবর্তন ও ব্যক্তিগত অনুমতি নির্ধারণ করুন
            </span>
          </div>
          {isSupabaseConfigured && (
            <button
              type="button"
              onClick={() => void loadProfiles()}
              disabled={isLoadingProfiles}
              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingProfiles ? 'animate-spin' : ''}`} />
              <span>তালিকা রিফ্রেশ</span>
            </button>
          )}
        </div>

        {accountMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
              accountMsg.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            <span>{accountMsg.text}</span>
            <button onClick={() => setAccountMsg(null)} className="text-stone-400 hover:text-stone-700 cursor-pointer">
              ×
            </button>
          </div>
        )}

        {accountsList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
                <tr>
                  <th className="py-2.5 px-3 font-bold">নাম ও ইমেইল</th>
                  <th className="py-2.5 px-3 font-bold">দায়িত্ব (Role)</th>
                  <th className="py-2.5 px-3 font-bold">অবস্থা</th>
                  <th className="py-2.5 px-3 font-bold text-right">নিয়ন্ত্রণ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {accountsList.map((acc) => {
                  const isSelf = acc.email.toLowerCase() === store.authenticatedEmail.toLowerCase();
                  return (
                    <tr key={acc.id} className="hover:bg-stone-50/60">
                      <td className="py-3 px-3">
                        <div className="font-bold text-stone-900">{acc.fullName}</div>
                        <div className="text-[11px] text-stone-500 font-mono">{acc.email}</div>
                      </td>
                      <td className="py-3 px-3">
                        {isSelf ? (
                          <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 font-bold text-[11px]">
                            {roleLabels[acc.role]}
                          </span>
                        ) : (
                          <select
                            value={acc.role}
                            onChange={(e) =>
                              isSupabaseConfigured
                                ? handleSupabaseUserUpdate(acc.id, { role: e.target.value as Role })
                                : store.updateAdminAccount(acc.id, { role: e.target.value as Role })
                            }
                            className="px-2 py-1 text-[11px] border border-stone-300 rounded-lg bg-white font-semibold"
                          >
                            {(Object.keys(roleLabels) as Role[]).map((r) => (
                              <option key={r} value={r}>
                                {roleLabels[r]}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            acc.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : acc.status === 'pending_approval'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {acc.status === 'active'
                            ? 'সক্রিয়'
                            : acc.status === 'pending_approval'
                              ? 'অনুমোদনের অপেক্ষায়'
                              : 'স্থগিত'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {!isSelf && acc.role !== 'super_admin' && (
                            <button
                              type="button"
                              onClick={() => setEditingOfficer(acc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 text-[11px] font-bold cursor-pointer"
                            >
                              <SlidersHorizontal className="w-3 h-3 text-emerald-700" />
                              <span>ব্যক্তিগত অনুমতি</span>
                            </button>
                          )}
                          {!isSelf && acc.status !== 'active' && (
                            <button
                              onClick={() =>
                                isSupabaseConfigured
                                  ? handleSupabaseUserUpdate(acc.id, { status: 'active' })
                                  : store.updateAdminAccount(acc.id, { status: 'active' })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>অনুমোদন দিন</span>
                            </button>
                          )}
                          {!isSelf && acc.status === 'active' && (
                            <button
                              onClick={() =>
                                isSupabaseConfigured
                                  ? handleSupabaseUserUpdate(acc.id, { status: 'suspended' })
                                  : store.updateAdminAccount(acc.id, { status: 'suspended' })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold cursor-pointer"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>স্থগিত</span>
                            </button>
                          )}
                          {!isSelf && acc.role !== 'super_admin' && (
                            confirmDeleteOfficerId === acc.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={isDeletingOfficer}
                                  onClick={() => void handleDeleteOfficer(acc)}
                                  className="px-2 py-1 rounded-lg bg-red-700 hover:bg-red-800 disabled:opacity-60 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  নিশ্চিত
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteOfficerId(null)}
                                  className="px-2 py-1 rounded-lg bg-stone-200 text-stone-700 text-[11px] font-semibold cursor-pointer"
                                >
                                  না
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteOfficerId(acc.id)}
                                title="আবেদন বাতিল / টেস্ট অ্যাকাউন্ট মুছুন"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100 hover:bg-red-50 text-stone-600 hover:text-red-700 border border-stone-200 hover:border-red-200 text-[11px] font-bold cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>মুছুন</span>
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-xs text-stone-500 py-4 text-center">
            এখনো কোনো অতিরিক্ত কর্মকর্তা অ্যাকাউন্ট যুক্ত হয়নি।
          </div>
        )}

        {/* Hybrid Officer Account Creator (Direct + Signup/Approval Notice) */}
        <form onSubmit={handleCreateOfficer} className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-emerald-700" />
              <span>
                {isSupabaseConfigured
                  ? 'সরাসরি নতুন কর্মকর্তা তৈরি করুন (Super Admin Direct Edge Function)'
                  : 'নতুন কর্মকর্তা লগইন অ্যাকাউন্ট তৈরি করুন'}
              </span>
            </div>
            {isSupabaseConfigured && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                হাইব্রিড মোড সক্রিয়
              </span>
            )}
          </div>

          {accountMsg && (
            <div
              className={`p-2.5 rounded-lg text-xs ${
                accountMsg.type === 'success'
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {accountMsg.text}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              required
              placeholder="কর্মকর্তার নাম"
              value={newOfficerName}
              onChange={(e) => setNewOfficerName(e.target.value)}
              className="px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
            />
            <input
              type="email"
              required
              placeholder="ইমেইল (লগইন আইডি)"
              value={newOfficerEmail}
              onChange={(e) => setNewOfficerEmail(e.target.value)}
              className="px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
              value={newOfficerPassword}
              onChange={(e) => setNewOfficerPassword(e.target.value)}
              className="px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
            />
            <select
              value={newOfficerRole}
              onChange={(e) => setNewOfficerRole(e.target.value as Role)}
              className="px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white font-semibold"
            >
              <option value="finance_secretary">অর্থ সম্পাদক</option>
              <option value="president">সভাপতি</option>
              <option value="general_secretary">সাধারণ সম্পাদক</option>
              <option value="general_admin">সাধারণ সদস্য অ্যাডমিন</option>
              <option value="student_admin">ছাত্র সংগঠন অ্যাডমিন</option>
              <option value="event_admin">অনুষ্ঠান ও আয়োজন অ্যাডমিন</option>
            </select>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {isSupabaseConfigured ? (
              <span className="text-[11px] text-stone-500">
                বিকল্পভাবে কর্মকর্তা নিজেও লগইন প্যানেলের “কর্মকর্তা নিবন্ধন” ট্যাব থেকে আবেদন করতে পারবেন এবং আপনি এখান থেকে অনুমোদন দেবেন।
              </span>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shrink-0"
            >
              অ্যাকাউন্ট তৈরি ও সক্রিয় করুন
            </button>
          </div>
        </form>
      </div>

      {/* Role Picker Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-stone-200">
        <span className="text-xs font-semibold text-stone-500 mr-2">ভূমিকা (Role) নির্বাচন:</span>
        {(Object.keys(roleLabels) as Role[]).map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRole(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedRole === r
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
            }`}
          >
            {roleLabels[r]}
          </button>
        ))}
      </div>

      {/* Permissions Grid */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              {roleLabels[selectedRole]}-এর দায়িত্ব ও অনুমোদনের তালিকা
            </h3>
            <p className="text-xs text-stone-500">
              {selectedRole === 'super_admin'
                ? 'সুপার অ্যাডমিনের সমস্ত ক্ষমতা প্রযুক্তিগতভাবে পূর্ণাঙ্গ ও অপরিবর্তনযোগ্য।'
                : 'চেকবক্স অন/অফ করে সাথে সাথে এই রোলের ক্ষমতা বাড়াতে বা কমাতে পারেন (ডাটাবেজেও সিঙ্ক হবে)।'}
            </p>
          </div>
          {isSupabaseConfigured && selectedRole !== 'super_admin' && (
            <button
              type="button"
              onClick={handleForceSyncRole}
              className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              ডাটাবেজে সিঙ্ক করুন
            </button>
          )}
        </div>

        {syncNotice && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
            {syncNotice}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {permissionDefinitions.map((perm) => {
            const isEnabled = permissions[selectedRole]?.[perm.key] || false;
            const isLocked = selectedRole === 'super_admin';

            return (
              <div
                key={perm.key}
                onClick={() => !isLocked && handleToggle(perm.key, isEnabled)}
                className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                  isLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer hover:border-emerald-600/40'
                } ${isEnabled ? 'bg-emerald-50/50 border-emerald-200' : 'bg-stone-50 border-stone-200'}`}
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-0.5">
                    {perm.group}
                  </span>
                  <div className={`text-xs font-bold ${isEnabled ? 'text-emerald-950' : 'text-stone-700'}`}>
                    {perm.label}
                  </div>
                </div>

                <div className="shrink-0 mt-0.5">
                  <div
                    className={`w-9 h-5 rounded-full transition-colors relative ${
                      isEnabled ? 'bg-emerald-700' : 'bg-stone-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                        isEnabled ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Permission Change History Logs */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-700" />
            <span>পারমিশন পরিবর্তনের ইতিহাস (Permission Change Logs)</span>
          </h3>
          <span className="text-xs font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-lg">
            মোট রেকর্ড: {store.permissionChangeLogs.length}টি
          </span>
        </div>

        {store.permissionChangeLogs.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {store.permissionChangeLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-stone-900">{roleLabels[log.targetRole]}</span> —{' '}
                  <code className="text-[11px] bg-white px-1.5 py-0.5 rounded border border-stone-200">
                    {log.permissionKey}
                  </code>
                  : <span className="text-stone-500">{log.oldValue ? 'চালু' : 'বন্ধ'}</span> →{' '}
                  <strong className={log.newValue ? 'text-emerald-700' : 'text-red-700'}>
                    {log.newValue ? 'চালু' : 'বন্ধ'}
                  </strong>
                </div>
                <div className="text-[11px] text-stone-500">
                  {log.changedByName} · {log.timestamp}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-stone-500 py-4 text-center">
            এখনো কোনো পারমিশন পরিবর্তন করা হয়নি।
          </div>
        )}
      </div>

      {/* Individual Officer Permission Modal */}
      {editingOfficer && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-stone-200">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  {editingOfficer.fullName} — ব্যক্তিগত অনুমতি কাস্টমাইজেশন
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  ইমেইল: <span className="font-mono">{editingOfficer.email}</span> · রোল: {roleLabels[editingOfficer.role]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => store.resetUserPermissionsToRole(editingOfficer.id, editingOfficer.role)}
                  className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>রোলের প্রিসেটে রিসেট করুন</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingOfficer(null)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                >
                  সম্পন্ন
                </button>
              </div>
            </div>

            {(() => {
              const { perms, isCustom } = store.getUserPermissionsForAdminView(
                editingOfficer.id,
                editingOfficer.role
              );
              return (
                <div className="space-y-4">
                  <div className="text-[11px] px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-stone-600">
                    বর্তমান অবস্থা:{' '}
                    <strong className="text-emerald-800">
                      {isCustom ? 'ব্যক্তিগতভাবে কাস্টমাইজ করা' : 'রোলের ডিফল্ট প্রিসেট অনুসরণ করছে'}
                    </strong>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {permissionDefinitions.map((perm) => {
                      const isEnabled = perms[perm.key] || false;
                      return (
                        <div
                          key={perm.key}
                          onClick={() =>
                            store.updateUserPermission(
                              editingOfficer.id,
                              editingOfficer.role,
                              perm.key,
                              !isEnabled
                            )
                          }
                          className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer hover:border-emerald-600/40 ${
                            isEnabled ? 'bg-emerald-50/50 border-emerald-200' : 'bg-stone-50 border-stone-200'
                          }`}
                        >
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-0.5">
                              {perm.group}
                            </span>
                            <div className={`text-xs font-bold ${isEnabled ? 'text-emerald-950' : 'text-stone-700'}`}>
                              {perm.label}
                            </div>
                          </div>
                          <div className="shrink-0 mt-0.5">
                            <div
                              className={`w-9 h-5 rounded-full transition-colors relative ${
                                isEnabled ? 'bg-emerald-700' : 'bg-stone-300'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                                  isEnabled ? 'right-0.5' : 'left-0.5'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
