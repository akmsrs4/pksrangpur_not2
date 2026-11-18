/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  AdminPermissions,
  AdminUserAccount,
  AidApplication,
  AuditLog,
  CommitteePosition,
  CommitteeTerm,
  EventApplication,
  EventApplicationLog,
  EventApplicationStatus,
  EventCategoryBreakdownItem,
  EventDashboardStats,
  EventFeeCategory,
  EventItem,
  EventLedgerEntry,
  EventLedgerEntryType,
  EventPaymentMethod,
  FinancialAccount,
  FinancialCorrection,
  FinancialFund,
  FinancialTransaction,
  FounderEntry,
  Member,
  MemberStatus,
  MemberType,
  Notice,
  PermissionChangeLog,
  Role,
  SystemSettings,
  ThemePreset,
  TransactionType,
} from '../types.ts';
import { THEME_PRESET_MAP } from '../config/themePresets.ts';
import {
  DEMO_SANDBOX_ACCOUNTS,
  DEMO_SANDBOX_AID_APPLICATIONS,
  DEMO_SANDBOX_COMMITTEES,
  DEMO_SANDBOX_FUNDS,
  DEMO_SANDBOX_MEMBERS,
  DEMO_SANDBOX_NOTICES,
  DEMO_SANDBOX_TRANSACTIONS,
  INITIAL_ACCOUNTS,
  INITIAL_AID_APPLICATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_COMMITTEES,
  INITIAL_EVENTS,
  INITIAL_EVENT_APPLICATIONS,
  INITIAL_EVENT_CATEGORIES,
  INITIAL_EVENT_LEDGER_ENTRIES,
  INITIAL_EVENT_LOGS,
  INITIAL_FUNDS,
  INITIAL_MEMBERS,
  INITIAL_NOTICES,
  INITIAL_ROLE_PERMISSIONS,
  INITIAL_SETTINGS,
  INITIAL_TRANSACTIONS,
} from './initialData.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { ORGANIZATION_CONFIG } from '../config/organization.ts';
import { toIsoTimestamp } from '../utils/dateFormat.ts';

const LEGACY_PREFIX_V5 = 'patgram_kalyan_samity_v5_';
const STORAGE_KEY_PREFIX = 'patgram_kalyan_samity_prod_v6_';

export function roundBDT(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function nextSequentialCode(prefix: string, year: number, existingCodes: string[], padLen: number): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}-${year}-(\\d+)$`);
  let maxNum = 0;
  for (const code of existingCodes) {
    const m = code.match(pattern);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  let candidateNum = maxNum + 1;
  let candidate = `${prefix}-${year}-${String(candidateNum).padStart(padLen, '0')}`;
  const existingSet = new Set(existingCodes.map((c) => c.toUpperCase()));
  while (existingSet.has(candidate.toUpperCase())) {
    candidateNum += 1;
    candidate = `${prefix}-${year}-${String(candidateNum).padStart(padLen, '0')}`;
  }
  return candidate;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(val?: string | null): boolean {
  return Boolean(val && UUID_REGEX.test(val));
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Simple deterministic hash generator for tamper-evident audit chain
function generateHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0') + '-' + Date.now().toString(16);
}

// Salted SHA-256 password hashing using browser/Node Web Crypto API
async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return generateHash(`${salt}:${password}`);
}

export class AppStore {
  private listeners: Set<() => void> = new Set();

  public settings: SystemSettings;
  public rolePermissions: Record<Role, AdminPermissions>;
  public userPermissions: Record<string, AdminPermissions>;
  public isSandboxDemoActive = false;
  public lastSyncError: string | null = null;

  // Auth State
  public isAuthenticated = false;
  public authMode: 'supabase' | 'local' = isSupabaseConfigured ? 'supabase' : 'local';
  public authenticatedRole: Role = 'general_admin';
  public authenticatedEmail = '';
  public currentRole: Role = 'general_admin';
  public currentUser = {
    id: 'guest',
    name: 'অতিথি ব্যবহারকারী',
    email: '',
    role: 'general_admin' as Role,
  };

  public adminAccounts: AdminUserAccount[];
  public funds: FinancialFund[];
  public accounts: FinancialAccount[];
  public transactions: FinancialTransaction[];
  public corrections: FinancialCorrection[];
  public members: Member[];
  public committees: CommitteeTerm[];
  public notices: Notice[];
  public aidApplications: AidApplication[];
  public auditLogs: AuditLog[];
  public permissionChangeLogs: PermissionChangeLog[];
  public events: EventItem[];
  public eventCategories: EventFeeCategory[];
  public eventApplications: EventApplication[];
  public eventLedgerEntries: EventLedgerEntry[];
  public eventLogs: EventApplicationLog[];
  public publicEventCounts: Record<string, { totalParticipants: number; approvedParticipants: number }> = {};

  // Mutex lock to emulate PostgreSQL row-level concurrency lock during writes
  private isLocked = false;

  constructor() {
    this.migrateAuthFromLegacyV5();

    const savedSettings = this.load<Partial<SystemSettings>>('settings', INITIAL_SETTINGS);
    this.settings = {
      ...INITIAL_SETTINGS,
      ...savedSettings,
      enableStudentWing: savedSettings.enableStudentWing ?? INITIAL_SETTINGS.enableStudentWing,
      studentWingNameBn: savedSettings.studentWingNameBn ?? INITIAL_SETTINGS.studentWingNameBn,
      enableEventsModule: savedSettings.enableEventsModule ?? INITIAL_SETTINGS.enableEventsModule,
      themePreset: savedSettings.themePreset ?? INITIAL_SETTINGS.themePreset,
      heroImageUrl: savedSettings.heroImageUrl ?? INITIAL_SETTINGS.heroImageUrl,
      articles: {
        ...INITIAL_SETTINGS.articles,
        ...(savedSettings.articles || {}),
      },
      founders: Array.isArray(savedSettings.founders)
        ? savedSettings.founders
        : INITIAL_SETTINGS.founders,
    };
    this.applyThemeToDocument(this.settings.themePreset);

    const savedRolePerms = this.load<Partial<Record<Role, Partial<AdminPermissions>>>>('rolePermissions', {});
    this.rolePermissions = (Object.keys(INITIAL_ROLE_PERMISSIONS) as Role[]).reduce((acc, roleKey) => {
      acc[roleKey] = {
        ...INITIAL_ROLE_PERMISSIONS[roleKey],
        ...(savedRolePerms[roleKey] || {}),
      };
      return acc;
    }, {} as Record<Role, AdminPermissions>);

    const savedUserPerms = this.load<Record<string, Partial<AdminPermissions>>>('userPermissions', {});
    this.userPermissions = Object.entries(savedUserPerms).reduce((acc, [uid, p]) => {
      acc[uid] = { ...INITIAL_ROLE_PERMISSIONS.general_admin, ...p };
      return acc;
    }, {} as Record<string, AdminPermissions>);

    this.isSandboxDemoActive = this.load('isSandboxDemoActive', false);
    this.adminAccounts = this.load('adminAccounts', []);
    this.funds = this.load('funds', INITIAL_FUNDS);
    this.accounts = this.load('accounts', INITIAL_ACCOUNTS);
    this.transactions = this.load('transactions', INITIAL_TRANSACTIONS);
    this.corrections = this.load('corrections', []);
    this.members = this.load('members', INITIAL_MEMBERS);
    this.committees = this.load('committees', INITIAL_COMMITTEES);
    this.notices = this.load('notices', INITIAL_NOTICES);
    this.aidApplications = this.load('aidApplications', INITIAL_AID_APPLICATIONS);
    this.auditLogs = this.load('auditLogs', INITIAL_AUDIT_LOGS);
    this.permissionChangeLogs = this.load('permissionChangeLogs', []);
    this.events = this.load('events', INITIAL_EVENTS);
    this.eventCategories = this.load('eventCategories', INITIAL_EVENT_CATEGORIES);
    this.eventApplications = this.load('eventApplications', INITIAL_EVENT_APPLICATIONS);
    this.eventLedgerEntries = this.load('eventLedgerEntries', INITIAL_EVENT_LEDGER_ENTRIES);
    this.eventLogs = this.load('eventLogs', INITIAL_EVENT_LOGS);

    if (isSupabaseConfigured && supabase) {
      this.initSupabaseSession();
      this.hydratePublicFromSupabase();
    } else {
      const savedSession = this.load<{
        id: string;
        email: string;
        name: string;
        role: Role;
      } | null>('authSession', null);
      if (savedSession) {
        const account = this.adminAccounts.find(
          (a) => a.id === savedSession.id && a.status === 'active'
        );
        if (account) {
          this.isAuthenticated = true;
          this.authenticatedRole = account.role;
          this.authenticatedEmail = account.email;
          this.currentRole = account.role;
          this.currentUser = {
            id: account.id,
            name: account.fullName,
            email: account.email,
            role: account.role,
          };
        }
      }
    }
  }

  // Migrate registered admin accounts/sessions once from v5 so real accounts survive demo cleanup
  private migrateAuthFromLegacyV5() {
    try {
      if (typeof localStorage === 'undefined') return;
      const alreadyMigrated = localStorage.getItem(STORAGE_KEY_PREFIX + 'migratedFromV5');
      if (alreadyMigrated) return;

      const v5Admins = localStorage.getItem(LEGACY_PREFIX_V5 + 'adminAccounts');
      const v6Admins = localStorage.getItem(STORAGE_KEY_PREFIX + 'adminAccounts');
      if (v5Admins && !v6Admins) {
        localStorage.setItem(STORAGE_KEY_PREFIX + 'adminAccounts', v5Admins);
      }

      const v5Session = localStorage.getItem(LEGACY_PREFIX_V5 + 'authSession');
      const v6Session = localStorage.getItem(STORAGE_KEY_PREFIX + 'authSession');
      if (v5Session && !v6Session) {
        localStorage.setItem(STORAGE_KEY_PREFIX + 'authSession', v5Session);
      }

      const v5Perms = localStorage.getItem(LEGACY_PREFIX_V5 + 'rolePermissions');
      const v6Perms = localStorage.getItem(STORAGE_KEY_PREFIX + 'rolePermissions');
      if (v5Perms && !v6Perms) {
        localStorage.setItem(STORAGE_KEY_PREFIX + 'rolePermissions', v5Perms);
      }

      localStorage.setItem(STORAGE_KEY_PREFIX + 'migratedFromV5', 'true');
    } catch {
      // ignore storage unavailable
    }
  }

  private async initSupabaseSession() {
    if (!supabase) return;
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        await this.syncSupabaseProfile(data.session.user.id, data.session.user.email || '');
      }
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          await this.syncSupabaseProfile(session.user.id, session.user.email || '');
        } else {
          this.clearAuthSessionState();
        }
      });
    } catch (e) {
      console.error('Supabase session init error:', e);
    }
  }

  public clearSyncError() {
    this.lastSyncError = null;
    this.notify();
  }

  private reportSyncError(context: string, err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err || 'ডাটাবেজ সংযোগ ত্রুটি');
    this.lastSyncError = `${context}: ${msg}`;
    console.error(`[SyncError] ${context}:`, err);
    this.notify();
  }

  private canPersistToSupabase(): boolean {
    return Boolean(isSupabaseConfigured && supabase && !this.isSandboxDemoActive);
  }

  public getEffectivePermissions(role: Role = this.currentRole): AdminPermissions {
    if (role === 'super_admin') {
      return { ...INITIAL_ROLE_PERMISSIONS.super_admin };
    }

    const baseRolePerms = {
      ...INITIAL_ROLE_PERMISSIONS[role],
      ...(this.rolePermissions[role] || {}),
    };

    if (
      role === this.authenticatedRole &&
      this.currentUser.id &&
      this.currentUser.id !== 'guest' &&
      this.userPermissions[this.currentUser.id]
    ) {
      return {
        ...baseRolePerms,
        ...this.userPermissions[this.currentUser.id],
      };
    }

    return baseRolePerms;
  }

  public getUserPermissionsForAdminView(
    userId: string,
    role: Role
  ): { perms: AdminPermissions; isCustom: boolean } {
    if (role === 'super_admin') {
      return { perms: this.getEffectivePermissions('super_admin'), isCustom: false };
    }
    const custom = this.userPermissions[userId];
    return {
      perms: {
        ...INITIAL_ROLE_PERMISSIONS[role],
        ...(this.rolePermissions[role] || {}),
        ...(custom || {}),
      },
      isCustom: Boolean(custom),
    };
  }

  // Hydrate strictly public non-sensitive tables from Supabase (no private members/phones)
  private async hydratePublicFromSupabase() {
    if (!supabase) return;
    try {
      const [noticesRes, committeesRes, publicPosRes, settingsRes] = await Promise.all([
        supabase.from('notices').select('*').order('publish_date', { ascending: false }),
        supabase.from('committees').select('*').order('start_year', { ascending: false }),
        supabase.from('public_committee_members').select('*').order('priority', { ascending: true }),
        supabase.from('system_settings').select('config').eq('id', 'default').maybeSingle(),
      ]);

      if (!settingsRes.error && settingsRes.data?.config) {
        const cfg = settingsRes.data.config as Partial<SystemSettings>;
        this.settings = {
          ...INITIAL_SETTINGS,
          ...cfg,
          enableStudentWing: cfg.enableStudentWing ?? INITIAL_SETTINGS.enableStudentWing,
          studentWingNameBn: cfg.studentWingNameBn ?? INITIAL_SETTINGS.studentWingNameBn,
          enableEventsModule: cfg.enableEventsModule ?? INITIAL_SETTINGS.enableEventsModule,
          themePreset: cfg.themePreset ?? INITIAL_SETTINGS.themePreset,
          heroImageUrl: cfg.heroImageUrl ?? INITIAL_SETTINGS.heroImageUrl,
          articles: {
            ...INITIAL_SETTINGS.articles,
            ...(cfg.articles || {}),
          },
          founders: Array.isArray(cfg.founders) ? cfg.founders : INITIAL_SETTINGS.founders,
        };
        this.save('settings', this.settings);
        this.applyThemeToDocument(this.settings.themePreset);
      }

      if (!noticesRes.error && noticesRes.data) {
        this.notices = noticesRes.data.map((n: Record<string, unknown>) => ({
          id: String(n.id),
          title: String(n.title),
          category: (n.category as Notice['category']) || 'general',
          content: String(n.content),
          publishDate: String(n.publish_date || '').substring(0, 10),
          isPinned: Boolean(n.is_pinned),
          author: String(n.author || ''),
          attachmentUrl: n.attachment_url ? String(n.attachment_url) : undefined,
        }));
        this.save('notices', this.notices);
      }

      if (!committeesRes.error && committeesRes.data) {
        const positions = (publicPosRes.data || []) as Record<string, unknown>[];
        this.committees = committeesRes.data.map((c: Record<string, unknown>) => ({
          id: String(c.id),
          title: String(c.title),
          wing: (c.wing as CommitteeTerm['wing']) || 'central',
          startYear: Number(c.start_year),
          endYear: Number(c.end_year),
          isCurrent: Boolean(c.is_current),
          positions: positions
            .filter((p) => String(p.committee_id) === String(c.id))
            .map((p) => ({
              id: String(p.id),
              title: String(p.position_title),
              memberNameBn: String(p.member_name_bn),
              memberNameEn: p.member_name_en ? String(p.member_name_en) : undefined,
              photoUrl: p.photo_url ? String(p.photo_url) : undefined,
              priority: Number(p.priority),
              isPublished: true,
            })),
        }));
        this.save('committees', this.committees);
      }

      // Public Events & Categories (non-blocking if live DB hasn't run event migration yet)
      try {
        const [evRes, catRes, countsRes] = await Promise.all([
          supabase.from('public_events_view').select('*').order('event_date', { ascending: true }),
          supabase.from('public_event_fee_categories_view').select('*').order('priority', { ascending: true }),
          supabase.rpc('get_public_event_counts'),
        ]);
        if (!evRes.error && evRes.data) {
          this.events = evRes.data.map((e: Record<string, unknown>) => this.mapEventRow(e));
          this.save('events', this.events);
        }
        if (!catRes.error && catRes.data) {
          this.eventCategories = catRes.data.map((c: Record<string, unknown>) => this.mapEventCategoryRow(c));
          this.save('eventCategories', this.eventCategories);
        }
        if (!countsRes.error && Array.isArray(countsRes.data)) {
          const nextCounts: Record<string, { totalParticipants: number; approvedParticipants: number }> = {};
          for (const row of countsRes.data as Record<string, unknown>[]) {
            nextCounts[String(row.event_id)] = {
              totalParticipants: Number(row.total_participants || 0),
              approvedParticipants: Number(row.approved_participants || 0),
            };
          }
          this.publicEventCounts = nextCounts;
        }
      } catch {
        // ignore if event views not yet provisioned
      }

      this.notify();
    } catch {
      // keep local cache if network unavailable
    }
  }

  public async syncSupabaseProfile(userId: string, email: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'ডাটাবেজ সংযুক্ত নয়।' };

    const queryRes = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    let profile = queryRes.data;
    let lastError = queryRes.error;

    if (!profile) {
      const rpcRes = await supabase.rpc('sync_or_bootstrap_profile');
      if (!rpcRes.error && rpcRes.data) {
        const candidate = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data;
        if (candidate && candidate.id) {
          profile = candidate;
          lastError = null;
        }
      } else if (rpcRes.error) {
        lastError = rpcRes.error;
      }
    }

    if (!profile) {
      const errCode = lastError?.code ? `কোড: ${lastError.code}` : 'NO_PROFILE';
      return {
        success: false,
        error: `আপনার অ্যাডমিন প্রোফাইল ডাটাবেজে পাওয়া যায়নি (${errCode})। দয়া করে সুপার অ্যাডমিন বা ডাটাবেজ অ্যাডমিনের সাথে যোগাযোগ করুন।`,
      };
    }

    if (profile.status !== 'active') {
      await supabase.auth.signOut();
      this.clearAuthSessionState();
      return {
        success: false,
        error: 'আপনার অ্যাকাউন্টটি এখনো সুপার অ্যাডমিনের অনুমোদনের অপেক্ষায় রয়েছে (Pending Approval)।',
      };
    }

    this.isAuthenticated = true;
    this.authenticatedRole = profile.role as Role;
    this.authenticatedEmail = profile.email || email;
    this.currentRole = profile.role as Role;
    this.currentUser = {
      id: profile.id,
      name: profile.full_name,
      email: profile.email || email,
      role: profile.role as Role,
    };

    await this.hydrateAdminDataFromSupabase();
    this.notify();
    return { success: true };
  }

  private async hydrateAdminDataFromSupabase() {
    if (!supabase || !this.isAuthenticated) return;
    try {
      const [fundsRes, accRes, txnRes, corrRes, memRes, aidRes, myPermRes, fullCommRes, fullPosRes] = await Promise.all([
        supabase.from('funds').select('*'),
        supabase.from('accounts').select('*'),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('financial_corrections').select('*').order('created_at', { ascending: false }),
        supabase.from('members').select('*').order('created_at', { ascending: false }),
        supabase.from('aid_applications').select('*').order('created_at', { ascending: false }),
        supabase.from('admin_permissions').select('*').eq('user_id', this.currentUser.id).maybeSingle(),
        supabase.from('committees').select('*').order('start_year', { ascending: false }),
        supabase.from('committee_positions').select('*').order('priority', { ascending: true }),
      ]);

      const extractPerms = (p: Record<string, unknown>): AdminPermissions => ({
        can_view_finance: Boolean(p.can_view_finance),
        can_entry_finance: Boolean(p.can_entry_finance),
        can_approve_finance: Boolean(p.can_approve_finance),
        can_view_reports: Boolean(p.can_view_reports),
        can_export_reports: Boolean(p.can_export_reports),
        can_correct_finance: Boolean(p.can_correct_finance),
        can_view_correction_history: Boolean(p.can_view_correction_history),
        can_manage_funds: Boolean(p.can_manage_funds),
        can_manage_accounts: Boolean(p.can_manage_accounts),
        can_manage_members: Boolean(p.can_manage_members),
        can_manage_student_wing: Boolean(p.can_manage_student_wing),
        can_manage_committees: Boolean(p.can_manage_committees),
        can_manage_notices: Boolean(p.can_manage_notices),
        can_manage_settings: Boolean(p.can_manage_settings),
        can_export_backup: Boolean(p.can_export_backup),
        can_event_view_module: Boolean(p.can_event_view_module),
        can_event_create: Boolean(p.can_event_create),
        can_event_edit: Boolean(p.can_event_edit),
        can_event_manage_categories: Boolean(p.can_event_manage_categories),
        can_event_view_applications: Boolean(p.can_event_view_applications),
        can_event_approve_application: Boolean(p.can_event_approve_application),
        can_event_verify_payment: Boolean(p.can_event_verify_payment),
        can_event_manage_refund: Boolean(p.can_event_manage_refund),
        can_event_manage_ledger: Boolean(p.can_event_manage_ledger),
        can_event_delete_test_data: Boolean(p.can_event_delete_test_data),
        can_event_view_finance_summary: Boolean(p.can_event_view_finance_summary),
        can_event_export_reports: Boolean(p.can_event_export_reports),
        can_event_manage_settings: Boolean(p.can_event_manage_settings),
        can_event_view_logs: Boolean(p.can_event_view_logs),
      });

      const profileNameMap = new Map<string, string>();
      const profileRoleMap = new Map<string, Role>();
      profileNameMap.set(this.currentUser.id, this.currentUser.name);
      profileRoleMap.set(this.currentUser.id, this.authenticatedRole);

      if (!myPermRes.error && myPermRes.data && this.authenticatedRole !== 'super_admin') {
        const extracted = extractPerms(myPermRes.data as Record<string, unknown>);
        this.userPermissions = {
          ...this.userPermissions,
          [this.currentUser.id]: extracted,
        };
        this.save('userPermissions', this.userPermissions);

        // Fetch non-sensitive officer display names so reviewedBy/createdBy show names instead of raw UUIDs
        try {
          const dirRes = await supabase.rpc('get_officer_directory_names');
          if (!dirRes.error && Array.isArray(dirRes.data)) {
            for (const row of dirRes.data as { id: string; full_name: string; role: Role }[]) {
              profileNameMap.set(String(row.id), row.full_name || String(row.id));
              profileRoleMap.set(String(row.id), row.role);
            }
          }
        } catch {
          // safe fallback if RPC not deployed yet
        }
      } else if (this.authenticatedRole === 'super_admin') {
        const [allProfilesRes, allPermsRes, auditRes] = await Promise.all([
          supabase.from('profiles').select('id, email, full_name, phone, role, status, created_at'),
          supabase.from('admin_permissions').select('*'),
          supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(200),
        ]);
        if (!allProfilesRes.error && allProfilesRes.data) {
          for (const prof of allProfilesRes.data as {
            id: string;
            email?: string;
            full_name: string;
            phone?: string;
            role: Role;
            status?: string;
            created_at?: string;
          }[]) {
            profileNameMap.set(prof.id, prof.full_name || prof.id);
            profileRoleMap.set(prof.id, prof.role);
          }
          // Keep in-memory adminAccounts aligned with Supabase profiles for audit/permission lookups
          this.adminAccounts = allProfilesRes.data.map((prof: {
            id: string;
            email?: string;
            full_name: string;
            phone?: string;
            role: Role;
            status?: string;
            created_at?: string;
          }) => ({
            id: String(prof.id),
            email: String(prof.email || ''),
            fullName: String(prof.full_name || ''),
            phone: prof.phone ? String(prof.phone) : undefined,
            role: prof.role as Role,
            status: (prof.status as AdminUserAccount['status']) || 'active',
            createdAt: String(prof.created_at || '').replace('T', ' ').substring(0, 19),
          }));
        }
        if (!allProfilesRes.error && !allPermsRes.error && allProfilesRes.data && allPermsRes.data) {
          const permByUser = new Map<string, Record<string, unknown>>();
          for (const row of allPermsRes.data as Record<string, unknown>[]) {
            permByUser.set(String(row.user_id), row);
          }
          const updatedUserPerms = { ...this.userPermissions };
          for (const prof of allProfilesRes.data as { id: string; role: Role; status?: string }[]) {
            if (prof.role !== 'super_admin') {
              const p = permByUser.get(prof.id);
              if (p) {
                const extracted = extractPerms(p);
                const hasAnyTrue = Object.values(extracted).some(Boolean);
                if (prof.status === 'active' || hasAnyTrue) {
                  updatedUserPerms[prof.id] = extracted;
                }
              }
            }
          }
          this.userPermissions = updatedUserPerms;
          this.save('userPermissions', this.userPermissions);
        }
        if (!auditRes.error && auditRes.data && auditRes.data.length > 0) {
          this.auditLogs = auditRes.data
            .slice()
            .reverse()
            .map((a: Record<string, unknown>) => ({
              id: String(a.id),
              timestamp: String(a.timestamp || '').replace('T', ' ').substring(0, 19),
              actorRole: (a.actor_role as Role) || 'super_admin',
              actorName: String(a.actor_name || ''),
              action: String(a.action || ''),
              entityType: String(a.entity_type || ''),
              entityId: String(a.entity_id || ''),
              description: String(a.description || ''),
              metadata: (a.metadata as Record<string, unknown>) || undefined,
              previousHash: a.previous_hash ? String(a.previous_hash) : undefined,
              currentHash: String(a.current_hash || ''),
            }));
          this.save('auditLogs', this.auditLogs);
        }
      }

      if (!fullCommRes.error && fullCommRes.data && !fullPosRes.error && fullPosRes.data) {
        const allPos = fullPosRes.data as Record<string, unknown>[];
        this.committees = fullCommRes.data.map((c: Record<string, unknown>) => ({
          id: String(c.id),
          title: String(c.title),
          wing: (c.wing as CommitteeTerm['wing']) || 'central',
          startYear: Number(c.start_year),
          endYear: Number(c.end_year),
          isCurrent: Boolean(c.is_current),
          positions: allPos
            .filter((p) => String(p.committee_id) === String(c.id))
            .map((p) => ({
              id: String(p.id),
              title: String(p.title),
              memberNameBn: String(p.member_name_bn),
              memberNameEn: p.member_name_en ? String(p.member_name_en) : undefined,
              phone: p.phone ? String(p.phone) : undefined,
              photoUrl: p.photo_url ? String(p.photo_url) : undefined,
              priority: Number(p.priority),
              isPublished: Boolean(p.is_published),
            })),
        }));
        this.save('committees', this.committees);
      }

      if (!fundsRes.error && fundsRes.data && fundsRes.data.length > 0) {
        this.funds = fundsRes.data.map((f: Record<string, unknown>) => ({
          id: String(f.id),
          name: String(f.name),
          code: String(f.code),
          description: String(f.description || ''),
          currentBalance: roundBDT(Number(f.current_balance || 0)),
          isActive: Boolean(f.is_active),
          isDefault: Boolean(f.is_default),
        }));
        this.save('funds', this.funds);
      }

      if (!accRes.error && accRes.data && accRes.data.length > 0) {
        this.accounts = accRes.data.map((a: Record<string, unknown>) => ({
          id: String(a.id),
          name: String(a.name),
          type: (a.type as FinancialAccount['type']) || 'bank',
          accountNumber: a.account_number ? String(a.account_number) : undefined,
          currentBalance: roundBDT(Number(a.current_balance || 0)),
          isActive: Boolean(a.is_active),
        }));
        this.save('accounts', this.accounts);
      }

      if (!txnRes.error && txnRes.data) {
        this.transactions = txnRes.data.map((t: Record<string, unknown>) => ({
          id: String(t.id),
          transactionCode: String(t.transaction_code),
          voucherNo: String(t.voucher_no),
          type: t.type as TransactionType,
          fundId: String(t.fund_id),
          toFundId: t.to_fund_id ? String(t.to_fund_id) : undefined,
          accountId: String(t.account_id),
          toAccountId: t.to_account_id ? String(t.to_account_id) : undefined,
          amount: roundBDT(Number(t.amount)),
          category: String(t.category),
          donorOrPayee: String(t.donor_or_payee),
          description: String(t.description),
          receiptUrl: t.receipt_url ? String(t.receipt_url) : undefined,
          status: t.status as FinancialTransaction['status'],
          createdByRole:
            (t.created_by_role as Role) ||
            (t.created_by ? profileRoleMap.get(String(t.created_by)) : undefined) ||
            'finance_secretary',
          createdByName: t.created_by ? profileNameMap.get(String(t.created_by)) || 'কর্মকর্তা' : 'কর্মকর্তা',
          createdAt: String(t.created_at || '').replace('T', ' ').substring(0, 19),
          approvedBy: t.approved_by ? profileNameMap.get(String(t.approved_by)) || 'অনুমোদিত কর্মকর্তা' : undefined,
          approvedAt: t.approved_at ? String(t.approved_at).replace('T', ' ').substring(0, 19) : undefined,
          rejectionReason: t.rejection_reason ? String(t.rejection_reason) : undefined,
        }));
        this.save('transactions', this.transactions);
      }

      if (!corrRes.error && corrRes.data) {
        this.corrections = corrRes.data.map((c: Record<string, unknown>) => ({
          id: String(c.id),
          correctionCode: String(c.correction_code),
          originalTransactionId: String(c.original_transaction_id),
          previousAmount: roundBDT(Number(c.previous_amount)),
          correctedAmount: roundBDT(Number(c.corrected_amount)),
          previousCategory: String(c.previous_category),
          correctedCategory: String(c.corrected_category),
          previousFundId: String(c.previous_fund_id),
          correctedFundId: String(c.corrected_fund_id),
          previousAccountId: String(c.previous_account_id),
          correctedAccountId: String(c.corrected_account_id),
          originalSnapshot: (c.original_snapshot as Partial<FinancialTransaction>) || {},
          correctedSnapshot: (c.corrected_snapshot as Partial<FinancialTransaction>) || {},
          correctionReason: String(c.correction_reason),
          correctedById: c.corrected_by ? String(c.corrected_by) : undefined,
          correctedByRole:
            (c.corrected_by_role as Role) ||
            (c.corrected_by ? profileRoleMap.get(String(c.corrected_by)) : undefined) ||
            'finance_secretary',
          correctedByName: c.corrected_by ? profileNameMap.get(String(c.corrected_by)) || 'কর্মকর্তা' : 'কর্মকর্তা',
          createdAt: String(c.created_at || '').replace('T', ' ').substring(0, 19),
          requiresDualApproval: Boolean(c.requires_dual_approval),
          approvalStatus: c.approval_status as FinancialCorrection['approvalStatus'],
          approvedBy: c.approved_by ? profileNameMap.get(String(c.approved_by)) || 'অনুমোদিত কর্মকর্তা' : undefined,
          approvedAt: c.approved_at ? String(c.approved_at).replace('T', ' ').substring(0, 19) : undefined,
          approvalNote: c.approval_note ? String(c.approval_note) : undefined,
        }));
        this.save('corrections', this.corrections);
      }

      if (!memRes.error && memRes.data) {
        this.members = memRes.data.map((m: Record<string, unknown>) => ({
          id: String(m.id),
          membershipId: String(m.membership_id),
          type: (m.type as Member['type']) || 'general',
          fullNameBn: String(m.full_name_bn),
          fullNameEn: String(m.full_name_en),
          phone: String(m.phone),
          email: String(m.email || ''),
          bloodGroup: String(m.blood_group || ''),
          patgramAddress: {
            village: String(m.patgram_village || ''),
            union: String(m.patgram_union || ''),
            ward: m.patgram_ward ? String(m.patgram_ward) : undefined,
          },
          rangpurAddress: {
            area: String(m.rangpur_area || ''),
            thana: String(m.rangpur_thana || ''),
          },
          professionOrDesignation: m.profession ? String(m.profession) : undefined,
          institution: m.institution ? String(m.institution) : undefined,
          department: m.department ? String(m.department) : undefined,
          academicYear: m.academic_year ? String(m.academic_year) : undefined,
          photoUrl: m.photo_url ? String(m.photo_url) : undefined,
          status: m.status as MemberStatus,
          joinedDate: String(m.joined_date || ''),
          notes: m.notes ? String(m.notes) : undefined,
        }));
        this.save('members', this.members);
      }

      if (!aidRes.error && aidRes.data) {
        this.aidApplications = aidRes.data.map((a: Record<string, unknown>) => ({
          id: String(a.id),
          applicantName: String(a.applicant_name),
          phone: String(a.phone),
          email: a.email ? String(a.email) : undefined,
          type: a.type as AidApplication['type'],
          patgramAddress: String(a.patgram_address),
          currentAddress: String(a.current_address),
          requestedAmount: roundBDT(Number(a.requested_amount)),
          reason: String(a.reason),
          status: a.status as AidApplication['status'],
          submittedAt: String(a.created_at || '').replace('T', ' ').substring(0, 19),
          reviewedBy: a.reviewed_by ? profileNameMap.get(String(a.reviewed_by)) || String(a.reviewed_by) : undefined,
          allocatedFundId: a.allocated_fund_id ? String(a.allocated_fund_id) : undefined,
        }));
        this.save('aidApplications', this.aidApplications);
      }

      // Admin Event Module Hydration (non-blocking on pre-migration databases)
      try {
        const [evRes, catRes, appRes, ledRes, logRes] = await Promise.all([
          supabase.from('events').select('*').order('event_date', { ascending: false }),
          supabase.from('event_fee_categories').select('*').order('priority', { ascending: true }),
          supabase.from('event_applications').select('*').order('created_at', { ascending: false }),
          supabase.from('event_ledger_entries').select('*').order('entry_date', { ascending: false }),
          supabase.from('event_application_logs').select('*').order('created_at', { ascending: false }).limit(250),
        ]);
        if (!evRes.error && evRes.data) {
          this.events = evRes.data.map((e: Record<string, unknown>) => this.mapEventRow(e));
          this.save('events', this.events);
        }
        if (!catRes.error && catRes.data) {
          this.eventCategories = catRes.data.map((c: Record<string, unknown>) => this.mapEventCategoryRow(c));
          this.save('eventCategories', this.eventCategories);
        }
        if (!appRes.error && appRes.data) {
          this.eventApplications = appRes.data.map((a: Record<string, unknown>) => this.mapEventAppRow(a));
          this.save('eventApplications', this.eventApplications);
        }
        if (!ledRes.error && ledRes.data) {
          this.eventLedgerEntries = ledRes.data.map((l: Record<string, unknown>) => this.mapEventLedgerRow(l));
          this.save('eventLedgerEntries', this.eventLedgerEntries);
        }
        if (!logRes.error && logRes.data) {
          this.eventLogs = logRes.data.map((lg: Record<string, unknown>) => ({
            id: String(lg.id),
            eventId: String(lg.event_id || ''),
            applicationId: lg.application_id ? String(lg.application_id) : undefined,
            action: String(lg.action || ''),
            actorRole: (lg.actor_role as Role) || 'event_admin',
            actorName: String(lg.actor_name || ''),
            description: String(lg.description || ''),
            metadata: (lg.metadata as Record<string, unknown>) || undefined,
            createdAt: String(lg.created_at || '').replace('T', ' ').substring(0, 19),
          }));
          this.save('eventLogs', this.eventLogs);
        }
      } catch {
        // ignore if event tables not yet created
      }
    } catch {
      // safe fallback
    }
  }

  public hasAnySuperAdminLocal(): boolean {
    return this.adminAccounts.some((a) => a.role === 'super_admin' && a.status === 'active');
  }

  public async registerAdminLocal(params: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    requestedRole?: Role;
  }): Promise<{ success: boolean; error?: string; isFirstSuperAdmin?: boolean; pendingApproval?: boolean }> {
    const normalizedEmail = params.email.trim().toLowerCase();
    if (!normalizedEmail || !params.fullName.trim() || params.password.length < 6) {
      return { success: false, error: 'নাম, বৈধ ইমেইল/ইউজার আইডি এবং কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।' };
    }

    if (this.adminAccounts.some((a) => a.email.toLowerCase() === normalizedEmail)) {
      return { success: false, error: 'এই ইমেইল / ইউজার আইডি দিয়ে ইতোমধ্যেই একটি অ্যাকাউন্ট নিবন্ধিত রয়েছে।' };
    }

    const isFirst = !this.hasAnySuperAdminLocal();
    const salt = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const passwordHash = await hashPassword(params.password, salt);

    const assignedRole: Role = isFirst
      ? 'super_admin'
      : params.requestedRole && params.requestedRole !== 'super_admin'
        ? params.requestedRole
        : 'general_admin';
    const assignedStatus: AdminUserAccount['status'] = isFirst ? 'active' : 'pending_approval';

    const newAccount: AdminUserAccount = {
      id: `admin-${Date.now()}`,
      email: normalizedEmail,
      fullName: params.fullName.trim(),
      phone: params.phone?.trim(),
      role: assignedRole,
      status: assignedStatus,
      passwordHash,
      salt,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    this.adminAccounts = [...this.adminAccounts, newAccount];
    this.save('adminAccounts', this.adminAccounts);

    if (isFirst) {
      this.isAuthenticated = true;
      this.authenticatedRole = 'super_admin';
      this.authenticatedEmail = newAccount.email;
      this.currentRole = 'super_admin';
      this.currentUser = {
        id: newAccount.id,
        name: newAccount.fullName,
        email: newAccount.email,
        role: 'super_admin',
      };
      this.save('authSession', {
        id: newAccount.id,
        email: newAccount.email,
        name: newAccount.fullName,
        role: 'super_admin',
      });
      this.logAudit(
        'REGISTER_SUPER_ADMIN',
        'user',
        newAccount.id,
        `প্রথম সুপার অ্যাডমিন অ্যাকাউন্ট "${newAccount.fullName}" (${newAccount.email}) নিবন্ধিত ও সক্রিয় হয়েছে।`
      );
      this.notify();
      return { success: true, isFirstSuperAdmin: true };
    } else {
      this.logAudit(
        'REGISTER_OFFICER_PENDING',
        'user',
        newAccount.id,
        `নতুন কর্মকর্তা "${newAccount.fullName}" (${newAccount.email}) নিবন্ধন করেছেন (সুপার অ্যাডমিনের অনুমোদনের অপেক্ষায়)।`
      );
      this.notify();
      return { success: true, pendingApproval: true };
    }
  }

  public async loginAdminLocal(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const account = this.adminAccounts.find((a) => a.email.toLowerCase() === normalizedEmail);
    if (!account) {
      return { success: false, error: 'এই ইমেইল / ইউজার আইডি দিয়ে কোনো নিবন্ধিত অ্যাডমিন অ্যাকাউন্ট পাওয়া যায়নি।' };
    }

    if (account.status === 'pending_approval') {
      return { success: false, error: 'আপনার অ্যাকাউন্টটি এখনো সুপার অ্যাডমিনের অনুমোদনের অপেক্ষায় রয়েছে।' };
    }
    if (account.status === 'suspended') {
      return { success: false, error: 'আপনার অ্যাকাউন্টটি স্থগিত করা হয়েছে। সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।' };
    }

    const computedHash = await hashPassword(password, account.salt || '');
    if (computedHash !== account.passwordHash) {
      return { success: false, error: 'পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।' };
    }

    this.isAuthenticated = true;
    this.authenticatedRole = account.role;
    this.authenticatedEmail = account.email;
    this.currentRole = account.role;
    this.currentUser = {
      id: account.id,
      name: account.fullName,
      email: account.email,
      role: account.role,
    };
    this.save('authSession', {
      id: account.id,
      email: account.email,
      name: account.fullName,
      role: account.role,
    });
    this.logAudit('ADMIN_LOGIN', 'user', account.id, `${account.fullName} (${account.role}) সফলভাবে লগইন করেছেন।`);
    this.notify();
    return { success: true };
  }

  public async createOfficerBySuperAdmin(params: {
    fullName: string;
    email: string;
    phone?: string;
    role: Role;
    password: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন নতুন কর্মকর্তা অ্যাকাউন্ট তৈরি করতে পারেন।' };
    }
    const normalizedEmail = params.email.trim().toLowerCase();
    if (!normalizedEmail || !params.fullName.trim() || params.password.length < 6) {
      return { success: false, error: 'সব তথ্য ও কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।' };
    }
    if (this.adminAccounts.some((a) => a.email.toLowerCase() === normalizedEmail)) {
      return { success: false, error: 'এই ইমেইল ইতোমধ্যে ব্যবহৃত হয়েছে।' };
    }

    const salt = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const passwordHash = await hashPassword(params.password, salt);

    const newAccount: AdminUserAccount = {
      id: `admin-${Date.now()}`,
      email: normalizedEmail,
      fullName: params.fullName.trim(),
      phone: params.phone?.trim(),
      role: params.role,
      status: 'active',
      passwordHash,
      salt,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    this.adminAccounts = [...this.adminAccounts, newAccount];
    this.save('adminAccounts', this.adminAccounts);
    this.logAudit(
      'CREATE_OFFICER_ACCOUNT',
      'user',
      newAccount.id,
      `সুপার অ্যাডমিন "${newAccount.fullName}"-কে "${newAccount.role}" ভূমিকায় সক্রিয় অ্যাকাউন্ট তৈরি করে দিয়েছেন।`
    );
    this.notify();
    return { success: true };
  }

  public updateAdminAccount(
    accountId: string,
    updates: { role?: Role; status?: AdminUserAccount['status'] }
  ): { success: boolean; error?: string } {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন অ্যাকাউন্ট পরিবর্তন করতে পারেন।' };
    }
    this.adminAccounts = this.adminAccounts.map((acc) =>
      acc.id === accountId ? { ...acc, ...updates } : acc
    );
    this.save('adminAccounts', this.adminAccounts);
    this.logAudit(
      'UPDATE_ADMIN_ACCOUNT',
      'user',
      accountId,
      `কর্মকর্তা অ্যাকাউন্ট আপডেট করা হয়েছে: ${JSON.stringify(updates)}`
    );
    this.notify();
    return { success: true };
  }

  public deleteAdminAccount(accountId: string): { success: boolean; error?: string } {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন কর্মকর্তা অ্যাকাউন্ট মুছে ফেলতে পারেন।' };
    }
    const target = this.adminAccounts.find((a) => a.id === accountId);
    if (!target) {
      return { success: false, error: 'কর্মকর্তার অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।' };
    }
    if (
      target.role === 'super_admin' ||
      target.email.toLowerCase() === this.authenticatedEmail.toLowerCase()
    ) {
      return { success: false, error: 'সুপার অ্যাডমিন বা নিজস্ব সক্রিয় অ্যাকাউন্ট মুছে ফেলা যাবে না।' };
    }

    this.adminAccounts = this.adminAccounts.filter((a) => a.id !== accountId);
    this.save('adminAccounts', this.adminAccounts);

    if (this.userPermissions[accountId]) {
      const nextUserPerms = { ...this.userPermissions };
      delete nextUserPerms[accountId];
      this.userPermissions = nextUserPerms;
      this.save('userPermissions', this.userPermissions);
    }

    this.logAudit(
      'DELETE_TEST_OFFICER',
      'user',
      accountId,
      `নন-সুপার-অ্যাডমিন কর্মকর্তা অ্যাকাউন্ট "${target.fullName}" (${target.email}) মুছে ফেলা হয়েছে।`
    );
    this.notify();
    return { success: true };
  }

  public async deleteSupabaseOfficer(accountId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন কর্মকর্তা অ্যাকাউন্ট মুছে ফেলতে পারেন।' };
    }
    if (!supabase) {
      return { success: false, error: 'ডাটাবেজ সংযুক্ত নয়।' };
    }
    if (accountId === this.currentUser.id) {
      return { success: false, error: 'নিজস্ব সক্রিয় সুপার অ্যাডমিন অ্যাকাউন্ট মুছে ফেলা যাবে না।' };
    }

    const { error } = await supabase.rpc('delete_test_officer_profile', { p_user_id: accountId });
    if (error) {
      return { success: false, error: error.message || 'কর্মকর্তা অ্যাকাউন্ট মুছে ফেলা যায়নি।' };
    }

    if (this.userPermissions[accountId]) {
      const nextUserPerms = { ...this.userPermissions };
      delete nextUserPerms[accountId];
      this.userPermissions = nextUserPerms;
      this.save('userPermissions', this.userPermissions);
    }

    this.logAudit(
      'DELETE_TEST_OFFICER',
      'user',
      accountId,
      `টেস্ট / অ-সুপার-অ্যাডমিন কর্মকর্তা অ্যাকাউন্ট (${accountId}) ডাটাবেজ থেকে নিরাপদভাবে মুছে ফেলা হয়েছে।`
    );
    this.notify();
    return { success: true };
  }

  public async createOfficerViaEdgeFunction(params: {
    fullName: string;
    email: string;
    phone?: string;
    role: Role;
    password: string;
  }): Promise<{ success: boolean; user?: AdminUserAccount; error?: string; edgeNotDeployed?: boolean }> {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সক্রিয় সুপার অ্যাডমিন কর্মকর্তা তৈরি করতে পারেন।' };
    }
    if (!isSupabaseConfigured || !supabase) {
      const localRes = await this.createOfficerBySuperAdmin(params);
      return { success: localRes.success, error: localRes.error };
    }
    const cleanEmail = params.email.trim().toLowerCase();
    if (!params.fullName.trim() || !cleanEmail || params.password.length < 6) {
      return { success: false, error: 'সব তথ্য ও কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।' };
    }
    const rolePreset = {
      ...INITIAL_ROLE_PERMISSIONS[params.role],
      ...(this.rolePermissions[params.role] || {}),
    };
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      let accessToken = sessionRes.session?.access_token;
      if (!accessToken) {
        const refreshed = await supabase.auth.refreshSession();
        accessToken = refreshed.data.session?.access_token;
      }

      const { data, error } = await supabase.functions.invoke('create-officer', {
        body: {
          fullName: params.fullName.trim(),
          email: cleanEmail,
          phone: params.phone?.trim() || '',
          role: params.role,
          password: params.password,
          permissions: rolePreset,
        },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (error) {
        let detailedMsg = String(error.message || '');
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.clone === 'function') {
          try {
            const parsed = await ctx.clone().json().catch(() => null);
            if (parsed && typeof parsed === 'object') {
              const errStr = (parsed as Record<string, unknown>).error || (parsed as Record<string, unknown>).message;
              if (errStr) detailedMsg = String(errStr);
            }
          } catch {
            // fallback to original error.message
          }
        }
        const statusCode = ctx && typeof ctx.status === 'number' ? ctx.status : undefined;
        const lower = detailedMsg.toLowerCase();
        const notDeployed =
          statusCode === 404 ||
          lower.includes('not found') ||
          lower.includes('failed to send a request');
        const jwtGatewayFail =
          lower.includes('invalid jwt') ||
          lower.includes('non-2xx status code');

        return {
          success: false,
          edgeNotDeployed: notDeployed,
          error: notDeployed
            ? 'Supabase Edge Function (create-officer) এখনো ডিপ্লয় করা হয়নি। তবে চিন্তা নেই—সক্রিয় "কর্মকর্তা নিবন্ধন + অনুমোদন" পদ্ধতি ব্যবহার করতে পারেন অথবা CLI দিয়ে ফাংশনটি ডিপ্লয় করুন।'
            : jwtGatewayFail
              ? `Edge Function ডিপ্লয়/টোকেন ত্রুটি (${detailedMsg}): টার্মিনাল থেকে নতুন "supabase functions deploy create-officer --no-verify-jwt" চালিয়ে আপডেট করুন অথবা "কর্মকর্তা নিবন্ধন" পদ্ধতি ব্যবহার করুন।`
              : `Edge Function ত্রুটি: ${detailedMsg}`,
        };
      }
      if (data?.error) {
        return { success: false, error: String(data.error) };
      }
      this.logAudit(
        'EDGE_CREATE_OFFICER',
        'user',
        String(data?.user?.id || cleanEmail),
        `সুপার অ্যাডমিন Edge Function দিয়ে "${params.fullName}" (${cleanEmail}) কর্মকর্তাকে "${params.role}" ভূমিকায় তৈরি করেছেন।`
      );
      this.notify();
      return {
        success: true,
        user: data?.user
          ? {
              id: String(data.user.id),
              email: String(data.user.email),
              fullName: String(data.user.fullName),
              phone: data.user.phone ? String(data.user.phone) : undefined,
              role: data.user.role as Role,
              status: 'active',
              createdAt: String(data.user.createdAt || new Date().toISOString()),
            }
          : undefined,
      };
    } catch (e: unknown) {
      return {
        success: false,
        edgeNotDeployed: true,
        error: e instanceof Error ? e.message : 'Edge Function সংযোগ ত্রুটি',
      };
    }
  }

  public async logout() {
    if (this.isAuthenticated) {
      this.logAudit('ADMIN_LOGOUT', 'user', this.currentUser.id, `${this.currentUser.name} লগআউট করেছেন।`);
    }
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    this.clearAuthSessionState();
  }

  private clearAuthSessionState() {
    this.isAuthenticated = false;
    this.authenticatedRole = 'general_admin';
    this.authenticatedEmail = '';
    this.currentRole = 'general_admin';
    this.currentUser = {
      id: 'guest',
      name: 'অতিথি ব্যবহারকারী',
      email: '',
      role: 'general_admin',
    };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_PREFIX + 'authSession');
      }
    } catch {
      // ignore
    }
    this.notify();
  }

  private load<T>(key: string, defaultValue: T): T {
    try {
      if (typeof localStorage === 'undefined') return defaultValue;
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private save<T>(key: string, value: T) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error(`Failed to persist ${key}:`, e);
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private persistSupabase(context: string, op: PromiseLike<{ error: unknown }>) {
    if (!this.canPersistToSupabase()) return;
    void Promise.resolve(op).then(
      ({ error }) => {
        if (error) {
          this.reportSyncError(context, error);
        }
      },
      (err) => {
        this.reportSyncError(context, err);
      }
    );
  }

  private persistBalancesToSupabase() {
    if (!this.canPersistToSupabase() || !supabase) return;
    const sb = supabase;
    for (const f of this.funds) {
      this.persistSupabase(
        `তহবিল ব্যালেন্স সিঙ্ক (${f.name})`,
        sb.from('funds').update({ current_balance: f.currentBalance }).eq('id', f.id)
      );
    }
    for (const a of this.accounts) {
      this.persistSupabase(
        `অ্যাকাউন্ট ব্যালেন্স সিঙ্ক (${a.name})`,
        sb.from('accounts').update({ current_balance: a.currentBalance }).eq('id', a.id)
      );
    }
  }

  private persistSettingsToSupabase() {
    if (!this.canPersistToSupabase() || !supabase) return;
    this.persistSupabase(
      'সিস্টেম সেটিংস ও প্রবন্ধ সংরক্ষণ',
      supabase.from('system_settings').upsert(
        {
          id: 'default',
          config: this.settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
    );
  }

  // --- Audit Logger ---
  public logAudit(
    action: string,
    entityType: string,
    entityId: string,
    description: string,
    metadata?: Record<string, unknown>
  ) {
    const lastLog = this.auditLogs[this.auditLogs.length - 1];
    const prevHash = lastLog ? lastLog.currentHash : 'GENESIS_2000';
    const payload = `${prevHash}|${action}|${entityType}|${entityId}|${Date.now()}`;
    const newHash = generateHash(payload);

    const resolvedActorRole = this.isAuthenticated ? this.authenticatedRole : this.currentUser.role;
    const enrichedMetadata =
      this.isAuthenticated && this.authenticatedRole !== this.currentRole
        ? { ...(metadata || {}), previewRole: this.currentRole }
        : metadata;

    const newLog: AuditLog = {
      id: generateUUID(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actorRole: resolvedActorRole,
      actorName: this.currentUser.name,
      action,
      entityType,
      entityId,
      description,
      metadata: enrichedMetadata,
      previousHash: prevHash,
      currentHash: newHash,
    };

    this.auditLogs = [...this.auditLogs, newLog];
    this.save('auditLogs', this.auditLogs);

    if (this.canPersistToSupabase() && supabase && this.isAuthenticated) {
      void Promise.resolve(
        supabase.from('audit_logs').insert({
          id: newLog.id,
          actor_id: isValidUUID(this.currentUser.id) ? this.currentUser.id : null,
          actor_role: newLog.actorRole,
          actor_name: newLog.actorName,
          action: newLog.action,
          entity_type: newLog.entityType,
          entity_id: newLog.entityId,
          description: newLog.description,
          metadata: newLog.metadata || null,
          previous_hash: newLog.previousHash || null,
          current_hash: newLog.currentHash,
        })
      ).catch(() => {
        // non-blocking for offline or restricted roles
      });
    }

    this.notify();
  }

  // --- Switch Active Role Preview (Only allowed for verified Super Admin) ---
  public switchRole(role: Role) {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin') return;
    this.currentRole = role;
    const names: Record<Role, string> = {
      super_admin: this.currentUser.email ? `${this.currentUser.name}` : 'সুপার অ্যাডমিন (মাস্টার কন্ট্রোল)',
      finance_secretary: 'অর্থ সম্পাদক (প্রিভিউ মোড)',
      president: 'সভাপতি (প্রিভিউ মোড)',
      general_secretary: 'সাধারণ সম্পাদক (প্রিভিউ মোড)',
      general_admin: 'সাধারণ সদস্য অ্যাডমিন (প্রিভিউ মোড)',
      student_admin: 'ছাত্র সংগঠন অ্যাডমিন (প্রিভিউ মোড)',
      event_admin: 'অনুষ্ঠান ও আয়োজন অ্যাডমিন (প্রিভিউ মোড)',
    };
    this.currentUser = {
      ...this.currentUser,
      role,
      name:
        role === 'super_admin'
          ? this.adminAccounts.find((a) => a.email === this.authenticatedEmail)?.fullName || 'সুপার অ্যাডমিন'
          : names[role],
    };
    this.logAudit('SWITCH_ROLE_PREVIEW', 'user', role, `সুপার অ্যাডমিন "${role}" রোল প্রিভিউ মোডে প্রবেশ করেছেন।`);
    this.notify();
  }

  // --- FINANCIAL ENGINE & DUAL-BALANCE CONTROL ---

  public isVoucherDuplicate(voucherNo: string, excludeId?: string): boolean {
    return this.transactions.some(
      (t) => t.voucherNo.trim().toLowerCase() === voucherNo.trim().toLowerCase() && t.id !== excludeId
    );
  }

  public addTransaction(params: {
    voucherNo: string;
    type: TransactionType;
    fundId: string;
    toFundId?: string;
    accountId: string;
    toAccountId?: string;
    amount: number;
    category: string;
    donorOrPayee: string;
    description: string;
    receiptUrl?: string;
    autoApprove?: boolean;
  }): { success: boolean; error?: string; transaction?: FinancialTransaction } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_entry_finance) {
      return { success: false, error: 'আপনার আর্থিক লেনদেন এন্ট্রি করার অনুমতি নেই।' };
    }
    if (this.isLocked) {
      return { success: false, error: 'অন্য একটি লেনদেন প্রক্রিয়াকরণ হচ্ছে, অনুগ্রহ করে পুনরায় চেষ্টা করুন।' };
    }
    this.isLocked = true;

    try {
      const {
        voucherNo,
        type,
        fundId,
        toFundId,
        accountId,
        toAccountId,
        amount,
        category,
        donorOrPayee,
        description,
        receiptUrl,
        autoApprove = false,
      } = params;

      if (!voucherNo || !voucherNo.trim()) {
        return { success: false, error: 'ভাউচার নম্বর দেওয়া বাধ্যতামূলক।' };
      }
      if (this.isVoucherDuplicate(voucherNo)) {
        return { success: false, error: `ভাউচার নম্বর "${voucherNo}" ইতোমধ্যে বিদ্যমান। নতুন ভাউচার নম্বর দিন।` };
      }
      if (!Number.isFinite(amount)) {
        return { success: false, error: 'অবৈধ সংখ্যা দেওয়া হয়েছে।' };
      }
      const cleanAmount = roundBDT(amount);
      if (cleanAmount <= 0) {
        return { success: false, error: 'লেনদেনের পরিমাণ অবশ্যই শূন্যের চেয়ে বেশি হতে হবে।' };
      }
      if (!category || !category.trim()) {
        return { success: false, error: 'লেনদেনের খাত/ক্যাটাগরি দেওয়া বাধ্যতামূলক।' };
      }

      const sourceFund = this.funds.find((f) => f.id === fundId && f.isActive);
      const sourceAccount = this.accounts.find((a) => a.id === accountId && a.isActive);

      if (!sourceFund) return { success: false, error: 'নির্বাচিত সক্রিয় তহবিল খুঁজে পাওয়া যায়নি।' };
      if (!sourceAccount) return { success: false, error: 'নির্বাচিত সক্রিয় পেমেন্ট অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।' };

      if (type === 'expense' || type === 'fund_transfer') {
        if (sourceFund.currentBalance < cleanAmount) {
          return {
            success: false,
            error: `তহবিলে অপর্যাপ্ত ব্যালেন্স: "${sourceFund.name}" তহবিলে বর্তমান ব্যালেন্স ৳${sourceFund.currentBalance.toLocaleString()} কিন্তু আপনি ৳${cleanAmount.toLocaleString()} খরচ/স্থানান্তর করতে চাচ্ছেন।`,
          };
        }
        if (sourceAccount.currentBalance < cleanAmount) {
          return {
            success: false,
            error: `অ্যাকাউন্টে অপর্যাপ্ত ব্যালেন্স: "${sourceAccount.name}" অ্যাকাউন্টে বর্তমান ব্যালেন্স ৳${sourceAccount.currentBalance.toLocaleString()} কিন্তু আপনি ৳${cleanAmount.toLocaleString()} দাবি করছেন।`,
          };
        }
      }

      if (type === 'fund_transfer') {
        if (!toFundId || !toAccountId) {
          return { success: false, error: 'ফান্ড স্থানান্তরের জন্য গন্তব্য তহবিল ও গন্তব্য অ্যাকাউন্ট উভয়ই নির্বাচন করুন।' };
        }
        const destFund = this.funds.find((f) => f.id === toFundId && f.isActive);
        const destAccount = this.accounts.find((a) => a.id === toAccountId && a.isActive);
        if (!destFund) return { success: false, error: 'নির্বাচিত গন্তব্য তহবিল খুঁজে পাওয়া যায়নি।' };
        if (!destAccount) return { success: false, error: 'নির্বাচিত গন্তব্য পেমেন্ট অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।' };
        if (fundId === toFundId && accountId === toAccountId) {
          return { success: false, error: 'উৎস ও গন্তব্য একই হতে পারে না।' };
        }
      }

      const txnCode = nextSequentialCode(
        'TXN',
        new Date().getFullYear(),
        this.transactions.map((t) => t.transactionCode),
        4
      );
      const nowISO = new Date().toISOString();
      const nowStr = nowISO.replace('T', ' ').substring(0, 19);

      const canApprove = Boolean(autoApprove && perms.can_approve_finance);

      const newTxn: FinancialTransaction = {
        id: generateUUID(),
        transactionCode: txnCode,
        voucherNo: voucherNo.trim(),
        type,
        fundId,
        toFundId: type === 'fund_transfer' ? toFundId : undefined,
        accountId,
        toAccountId: type === 'fund_transfer' ? toAccountId : undefined,
        amount: cleanAmount,
        category: category.trim(),
        donorOrPayee: donorOrPayee.trim() || 'পাটগ্রাম কল্যাণ সমিতি',
        description: description.trim(),
        receiptUrl,
        status: canApprove ? 'approved' : 'pending_approval',
        createdByRole: this.currentUser.role,
        createdByName: this.currentUser.name,
        createdAt: nowStr,
        approvedBy: canApprove ? this.currentUser.name : undefined,
        approvedAt: canApprove ? nowStr : undefined,
      };

      this.transactions = [newTxn, ...this.transactions];
      this.save('transactions', this.transactions);

      if (canApprove) {
        this.applyBalanceChange(newTxn);
      }

      if (this.canPersistToSupabase() && supabase) {
        const sb = supabase;
        const actorId = isValidUUID(this.currentUser.id) ? this.currentUser.id : null;
        void Promise.resolve(
          sb.from('transactions').insert({
            id: newTxn.id,
            transaction_code: newTxn.transactionCode,
            voucher_no: newTxn.voucherNo,
            type: newTxn.type,
            fund_id: newTxn.fundId,
            to_fund_id: newTxn.toFundId || null,
            account_id: newTxn.accountId,
            to_account_id: newTxn.toAccountId || null,
            amount: newTxn.amount,
            category: newTxn.category,
            donor_or_payee: newTxn.donorOrPayee,
            description: newTxn.description,
            receipt_url: newTxn.receiptUrl || null,
            status: newTxn.status,
            balance_applied: false,
            created_by: actorId,
            created_by_role: newTxn.createdByRole,
            created_at: nowISO,
            approved_by: canApprove ? actorId : null,
            approved_at: canApprove ? nowISO : null,
          })
        ).then(
          async ({ error: insErr }) => {
            if (insErr) {
              this.reportSyncError(`লেনদেন সংরক্ষণ (${newTxn.transactionCode})`, insErr);
              return;
            }
            if (canApprove) {
              const rpcRes = await sb.rpc('fn_process_approved_transaction', { p_txn_id: newTxn.id });
              if (rpcRes.error) {
                const msg = (rpcRes.error.message || '').toLowerCase();
                if (
                  rpcRes.error.code === '42883' ||
                  rpcRes.error.code === 'PGRST202' ||
                  msg.includes('could not find the function')
                ) {
                  this.persistBalancesToSupabase();
                } else {
                  this.reportSyncError(`ব্যালেন্স হালনাগাদ (${newTxn.transactionCode})`, rpcRes.error);
                }
              }
            }
          },
          (err) => {
            this.reportSyncError(`লেনদেন সংরক্ষণ (${newTxn.transactionCode})`, err);
          }
        );
      }

      this.logAudit(
        'CREATE_TRANSACTION',
        'transaction',
        newTxn.id,
        `নতুন আর্থিক এন্ট্রি ${newTxn.transactionCode} (${newTxn.voucherNo}): ৳${cleanAmount.toLocaleString()} [${type === 'income' ? 'আয়' : type === 'expense' ? 'ব্যয়' : 'স্থানান্তর'}] তৈরি হয়েছে (${newTxn.status})।`
      );

      this.notify();
      return { success: true, transaction: newTxn };
    } finally {
      this.isLocked = false;
    }
  }

  public approveTransaction(txnId: string): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_approve_finance) {
      return { success: false, error: 'আপনার আর্থিক লেনদেন চূড়ান্ত অনুমোদন করার অনুমতি নেই।' };
    }
    if (this.isLocked) {
      return { success: false, error: 'অন্য একটি লেনদেন প্রক্রিয়াকরণ হচ্ছে, অনুগ্রহ করে পুনরায় চেষ্টা করুন।' };
    }
    this.isLocked = true;

    try {
      const txn = this.transactions.find((t) => t.id === txnId);
      if (!txn) return { success: false, error: 'লেনদেন খুঁজে পাওয়া যায়নি।' };
      if (txn.status !== 'pending_approval') {
        return { success: false, error: 'লেনদেনটি অনুমোদনের অপেক্ষায় নেই।' };
      }

      if (txn.type === 'expense' || txn.type === 'fund_transfer') {
        const fund = this.funds.find((f) => f.id === txn.fundId && f.isActive);
        const acc = this.accounts.find((a) => a.id === txn.accountId && a.isActive);
        if (!fund || fund.currentBalance < txn.amount) {
          return { success: false, error: 'অনুমোদনের মুহূর্তে তহবিলে পর্যাপ্ত ব্যালেন্স পাওয়া যায়নি।' };
        }
        if (!acc || acc.currentBalance < txn.amount) {
          return { success: false, error: 'অনুমোদনের মুহূর্তে অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স পাওয়া যায়নি।' };
        }
      }

      if (txn.type === 'fund_transfer') {
        const destFund = this.funds.find((f) => f.id === txn.toFundId && f.isActive);
        const destAcc = this.accounts.find((a) => a.id === txn.toAccountId && a.isActive);
        if (!destFund || !destAcc) {
          return { success: false, error: 'গন্তব্য তহবিল বা অ্যাকাউন্ট সক্রিয় পাওয়া যায়নি।' };
        }
      }

      const nowISO = new Date().toISOString();
      const approvedAt = nowISO.replace('T', ' ').substring(0, 19);
      const updatedTxn: FinancialTransaction = {
        ...txn,
        status: 'approved',
        approvedBy: this.currentUser.name,
        approvedAt,
      };

      this.transactions = this.transactions.map((t) => (t.id === txnId ? updatedTxn : t));
      this.applyBalanceChange(updatedTxn);
      this.save('transactions', this.transactions);

      if (this.canPersistToSupabase() && supabase) {
        const sb = supabase;
        const actorId = isValidUUID(this.currentUser.id) ? this.currentUser.id : null;
        void Promise.resolve(sb.rpc('approve_transaction_atomic', { p_txn_id: txn.id })).then(
          async ({ error: rpcErr }) => {
            if (!rpcErr) return;
            const msg = (rpcErr.message || '').toLowerCase();
            if (
              rpcErr.code === '42883' ||
              rpcErr.code === 'PGRST202' ||
              msg.includes('could not find the function')
            ) {
              const updRes = await sb
                .from('transactions')
                .update({
                  status: 'approved',
                  approved_by: actorId,
                  approved_at: nowISO,
                })
                .eq('id', txn.id);
              if (updRes.error) {
                this.reportSyncError(`লেনদেন অনুমোদন (${txn.transactionCode})`, updRes.error);
              } else {
                this.persistBalancesToSupabase();
              }
            } else {
              this.reportSyncError(`লেনদেন অনুমোদন (${txn.transactionCode})`, rpcErr);
            }
          },
          (err) => {
            this.reportSyncError(`লেনদেন অনুমোদন (${txn.transactionCode})`, err);
          }
        );
      }

      this.logAudit(
        'APPROVE_TRANSACTION',
        'transaction',
        txn.id,
        `আর্থিক এন্ট্রি ${txn.transactionCode} ৳${txn.amount.toLocaleString()} চূড়ান্ত অনুমোদিত হয়েছে।`
      );

      this.notify();
      return { success: true };
    } finally {
      this.isLocked = false;
    }
  }

  public rejectTransaction(txnId: string, reason: string): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_approve_finance) {
      return { success: false, error: 'আপনার এই লেনদেন বাতিল করার অনুমতি নেই।' };
    }
    if (!reason || reason.trim().length < 3) {
      return { success: false, error: 'লেনদেন বাতিলের কারণ কমপক্ষে ৩ অক্ষরে উল্লেখ করুন।' };
    }
    if (this.isLocked) {
      return { success: false, error: 'অন্য একটি লেনদেন প্রক্রিয়াকরণ হচ্ছে।' };
    }
    this.isLocked = true;

    try {
      const txn = this.transactions.find((t) => t.id === txnId);
      if (!txn) return { success: false, error: 'লেনদেন খুঁজে পাওয়া যায়নি।' };
      if (txn.status !== 'pending_approval') {
        return { success: false, error: 'শুধুমাত্র অপেক্ষমাণ লেনদেন বাতিল করা যায়।' };
      }

      const cleanReason = reason.trim();
      const rejectedTxn: FinancialTransaction = {
        ...txn,
        status: 'rejected',
        rejectionReason: cleanReason,
      };
      this.transactions = this.transactions.map((t) => (t.id === txnId ? rejectedTxn : t));
      this.save('transactions', this.transactions);

      if (this.canPersistToSupabase() && supabase) {
        this.persistSupabase(
          `লেনদেন প্রত্যাখ্যান (${txn.transactionCode})`,
          supabase
            .from('transactions')
            .update({
              status: 'rejected',
              rejection_reason: cleanReason,
            })
            .eq('id', txn.id)
        );
      }

      this.logAudit('REJECT_TRANSACTION', 'transaction', txn.id, `আর্থিক এন্ট্রি ${txn.transactionCode} বাতিল করা হয়েছে। কারণ: ${cleanReason}`);
      this.notify();
      return { success: true };
    } finally {
      this.isLocked = false;
    }
  }

  public deleteTransaction(txnId: string): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    const canDelete =
      this.currentUser.role === 'super_admin' || perms.can_approve_finance || perms.can_correct_finance;
    if (!this.isAuthenticated || !canDelete) {
      return { success: false, error: 'অপেক্ষমাণ বা বাতিলকৃত লেনদেন মুছে ফেলার অনুমতি আপনার নেই।' };
    }
    if (this.isLocked) {
      return { success: false, error: 'অন্য একটি প্রক্রিয়া চলছে, অনুগ্রহ করে একটু পর চেষ্টা করুন।' };
    }
    this.isLocked = true;

    try {
      const txn = this.transactions.find((t) => t.id === txnId);
      if (!txn) return { success: false, error: 'লেনদেন খুঁজে পাওয়া যায়নি।' };
      if (txn.status !== 'pending_approval' && txn.status !== 'rejected') {
        return {
          success: false,
          error: 'অনুমোদিত লেনদেন সরাসরি মুছে ফেলা যায় না। অডিট নিরাপত্তা রক্ষায় অনুগ্রহ করে ৳০ (রিভার্স/বাতিল) সংশোধন ব্যবহার করুন।',
        };
      }
      if (this.corrections.some((c) => c.originalTransactionId === txnId)) {
        return { success: false, error: 'সংশোধন ইতিহাসের সাথে যুক্ত লেনদেন মুছে ফেলা যাবে না।' };
      }

      this.transactions = this.transactions.filter((t) => t.id !== txnId);
      this.save('transactions', this.transactions);

      if (this.canPersistToSupabase() && supabase) {
        this.persistSupabase(
          `অপেক্ষমাণ লেনদেন মোছা (${txn.transactionCode})`,
          supabase.from('transactions').delete().eq('id', txnId)
        );
      }

      this.logAudit(
        'DELETE_PENDING_TRANSACTION',
        'transaction',
        txnId,
        `অপেক্ষমাণ/বাতিলকৃত লেনদেন ${txn.transactionCode} (ভাউচার: ${txn.voucherNo}, ৳${txn.amount.toLocaleString()}) স্থায়ীভাবে মুছে ফেলা হয়েছে।`
      );
      this.notify();
      return { success: true };
    } finally {
      this.isLocked = false;
    }
  }

  // Compute simulated balance deltas on funds & accounts without mutating state
  private computeBalanceDelta(
    txn: FinancialTransaction,
    isReversal: boolean,
    fundBalances: Map<string, number>,
    accountBalances: Map<string, number>
  ) {
    const factor = isReversal ? -1 : 1;
    const delta = roundBDT(txn.amount * factor);

    if (txn.type === 'income') {
      fundBalances.set(txn.fundId, roundBDT((fundBalances.get(txn.fundId) || 0) + delta));
      accountBalances.set(txn.accountId, roundBDT((accountBalances.get(txn.accountId) || 0) + delta));
    } else if (txn.type === 'expense') {
      fundBalances.set(txn.fundId, roundBDT((fundBalances.get(txn.fundId) || 0) - delta));
      accountBalances.set(txn.accountId, roundBDT((accountBalances.get(txn.accountId) || 0) - delta));
    } else if (txn.type === 'fund_transfer' && txn.toFundId && txn.toAccountId) {
      fundBalances.set(txn.fundId, roundBDT((fundBalances.get(txn.fundId) || 0) - delta));
      fundBalances.set(txn.toFundId, roundBDT((fundBalances.get(txn.toFundId) || 0) + delta));
      accountBalances.set(txn.accountId, roundBDT((accountBalances.get(txn.accountId) || 0) - delta));
      accountBalances.set(txn.toAccountId, roundBDT((accountBalances.get(txn.toAccountId) || 0) + delta));
    }
  }

  // Prevent overdraft or negative fund/account balances caused by reversing/correcting a transaction
  private wouldCorrectionCauseNegativeBalance(
    originalTxn: FinancialTransaction,
    updatedTxn: FinancialTransaction
  ): { ok: boolean; error?: string } {
    const fundBalances = new Map(this.funds.map((f) => [f.id, f.currentBalance]));
    const accountBalances = new Map(this.accounts.map((a) => [a.id, a.currentBalance]));

    this.computeBalanceDelta(originalTxn, true, fundBalances, accountBalances);
    this.computeBalanceDelta(updatedTxn, false, fundBalances, accountBalances);

    for (const [fId, bal] of fundBalances.entries()) {
      if (bal < 0) {
        const fundName = this.funds.find((f) => f.id === fId)?.name || fId;
        return {
          ok: false,
          error: `সংশোধন প্রত্যাখ্যান: এটি কার্যকর করলে "${fundName}" তহবিলের ব্যালেন্স ঋণাত্মক (৳${bal.toLocaleString()}) হয়ে যাবে। আগে সমন্বয় লেনদেন সম্পন্ন করুন।`,
        };
      }
    }

    for (const [aId, bal] of accountBalances.entries()) {
      if (bal < 0) {
        const accName = this.accounts.find((a) => a.id === aId)?.name || aId;
        return {
          ok: false,
          error: `সংশোধন প্রত্যাখ্যান: এটি কার্যকর করলে "${accName}" অ্যাকাউন্টের ব্যালেন্স ঋণাত্মক (৳${bal.toLocaleString()}) হয়ে যাবে।`,
        };
      }
    }

    return { ok: true };
  }

  private applyBalanceChange(txn: FinancialTransaction, isReversal = false) {
    const fundBalances = new Map(this.funds.map((f) => [f.id, f.currentBalance]));
    const accountBalances = new Map(this.accounts.map((a) => [a.id, a.currentBalance]));

    this.computeBalanceDelta(txn, isReversal, fundBalances, accountBalances);

    this.funds = this.funds.map((f) => ({
      ...f,
      currentBalance: fundBalances.get(f.id) ?? f.currentBalance,
    }));
    this.accounts = this.accounts.map((a) => ({
      ...a,
      currentBalance: accountBalances.get(a.id) ?? a.currentBalance,
    }));

    this.save('funds', this.funds);
    this.save('accounts', this.accounts);
  }

  // --- FINANCIAL CORRECTION WORKFLOW ---
  // Decision 1.খ: Delta = ABS(correctedAmount - previousAmount) > 30,000 BDT triggers dual-approval
  // Decision 2.ক: Super Admin can directly execute corrections with mandatory reason
  public requestCorrection(params: {
    originalTransactionId: string;
    correctedAmount: number;
    correctedCategory: string;
    correctedFundId: string;
    correctedAccountId: string;
    correctedToFundId?: string;
    correctedToAccountId?: string;
    correctedDonorOrPayee: string;
    correctedDescription: string;
    correctionReason: string;
  }): { success: boolean; error?: string; correction?: FinancialCorrection } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_correct_finance) {
      return { success: false, error: 'আপনার আর্থিক সংশোধন প্রস্তাব করার অনুমতি নেই।' };
    }
    if (this.isLocked) {
      return { success: false, error: 'অন্য একটি প্রক্রিয়া চলছে, অনুগ্রহ করে একটু পর চেষ্টা করুন।' };
    }
    this.isLocked = true;

    try {
      const {
        originalTransactionId,
        correctedAmount,
        correctedCategory,
        correctedFundId,
        correctedAccountId,
        correctedToFundId,
        correctedToAccountId,
        correctedDonorOrPayee,
        correctedDescription,
        correctionReason,
      } = params;

      if (!correctionReason || correctionReason.trim().length < 5) {
        return { success: false, error: 'আর্থিক সংশোধনের বিস্তারিত ও সুনির্দিষ্ট কারণ লেখা বাধ্যতামূলক (কমপক্ষে ৫ অক্ষর)।' };
      }
      if (!Number.isFinite(correctedAmount)) {
        return { success: false, error: 'সংশোধিত পরিমাণ বৈধ সংখ্যা হতে হবে।' };
      }
      const cleanCorrectedAmount = roundBDT(correctedAmount);
      if (cleanCorrectedAmount < 0) {
        return { success: false, error: 'সংশোধিত পরিমাণ ঋণাত্মক হতে পারবে না (পূর্ণ বাতিলের জন্য ০ দিন)।' };
      }

      const originalTxn = this.transactions.find((t) => t.id === originalTransactionId);
      if (!originalTxn) return { success: false, error: 'মূল লেনদেন খুঁজে পাওয়া যায়নি।' };
      if (originalTxn.status !== 'approved' && originalTxn.status !== 'corrected') {
        return { success: false, error: 'শুধুমাত্র অনুমোদিত লেনদেনের সংশোধন প্রস্তাব করা যায়।' };
      }

      const alreadyPending = this.corrections.some(
        (c) => c.originalTransactionId === originalTransactionId && c.approvalStatus === 'pending_approval'
      );
      if (alreadyPending) {
        return {
          success: false,
          error: 'এই লেনদেনের বিপরীতে ইতোমধ্যে একটি সংশোধনী অনুমোদনের অপেক্ষায় রয়েছে। সেটি নিষ্পত্তি না হওয়া পর্যন্ত নতুন প্রস্তাব করা যাবে না।',
        };
      }

      if (!this.funds.some((f) => f.id === correctedFundId)) {
        return { success: false, error: 'সংশোধিত তহবিল খুঁজে পাওয়া যায়নি।' };
      }
      if (!this.accounts.some((a) => a.id === correctedAccountId)) {
        return { success: false, error: 'সংশোধিত পেমেন্ট অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।' };
      }

      const resolvedToFundId = originalTxn.type === 'fund_transfer' ? (correctedToFundId || originalTxn.toFundId) : undefined;
      const resolvedToAccountId = originalTxn.type === 'fund_transfer' ? (correctedToAccountId || originalTxn.toAccountId) : undefined;

      const updatedTxnCandidate: FinancialTransaction = {
        ...originalTxn,
        amount: cleanCorrectedAmount,
        category: correctedCategory.trim() || originalTxn.category,
        fundId: correctedFundId,
        accountId: correctedAccountId,
        toFundId: resolvedToFundId,
        toAccountId: resolvedToAccountId,
        donorOrPayee: correctedDonorOrPayee.trim() || originalTxn.donorOrPayee,
        description: correctedDescription.trim(),
        status: 'corrected',
      };

      const simCheck = this.wouldCorrectionCauseNegativeBalance(originalTxn, updatedTxnCandidate);
      if (!simCheck.ok) {
        return { success: false, error: simCheck.error };
      }

      const threshold = this.settings.correctionThresholdAmount || 30000;
      const delta = roundBDT(Math.abs(cleanCorrectedAmount - originalTxn.amount));
      const isSuperAdmin = this.currentUser.role === 'super_admin' && this.authenticatedRole === 'super_admin';
      const requiresDualApproval = !isSuperAdmin && delta > threshold;

      const corrCode = nextSequentialCode(
        'CORR',
        new Date().getFullYear(),
        this.corrections.map((c) => c.correctionCode),
        4
      );
      const nowISO = new Date().toISOString();
      const nowStr = nowISO.replace('T', ' ').substring(0, 19);

      const originalSnapshot: Partial<FinancialTransaction> = { ...originalTxn };
      const correctedSnapshot: Partial<FinancialTransaction> = { ...updatedTxnCandidate };

      const isDirectlyApproved = isSuperAdmin || !requiresDualApproval;

      const newCorrection: FinancialCorrection = {
        id: generateUUID(),
        correctionCode: corrCode,
        originalTransactionId,
        previousAmount: originalTxn.amount,
        correctedAmount: cleanCorrectedAmount,
        previousCategory: originalTxn.category,
        correctedCategory: updatedTxnCandidate.category,
        previousFundId: originalTxn.fundId,
        correctedFundId,
        previousAccountId: originalTxn.accountId,
        correctedAccountId,
        originalSnapshot,
        correctedSnapshot,
        correctionReason: correctionReason.trim(),
        correctedById: this.currentUser.id,
        correctedByRole: this.currentUser.role,
        correctedByName: this.currentUser.name,
        createdAt: nowStr,
        requiresDualApproval,
        approvalStatus: isDirectlyApproved ? 'approved' : 'pending_approval',
        approvedBy: isDirectlyApproved ? this.currentUser.name : undefined,
        approvedAt: isDirectlyApproved ? nowStr : undefined,
      };

      this.corrections = [newCorrection, ...this.corrections];
      this.save('corrections', this.corrections);

      if (isDirectlyApproved) {
        this.applyBalanceChange(originalTxn, true);
        this.applyBalanceChange(updatedTxnCandidate, false);
        this.transactions = this.transactions.map((t) => (t.id === originalTxn.id ? updatedTxnCandidate : t));
        this.save('transactions', this.transactions);
      }

      if (this.canPersistToSupabase() && supabase) {
        const sb = supabase;
        const actorId = isValidUUID(this.currentUser.id) ? this.currentUser.id : null;
        if (!actorId) {
          this.reportSyncError(
            `সংশোধনী সংরক্ষণ (${newCorrection.correctionCode})`,
            'ব্যবহারকারীর UUID পাওয়া যায়নি; পুনরায় লগইন করুন।'
          );
        } else {
          void Promise.resolve(
            sb.rpc('propose_or_apply_correction_atomic', {
              p_corr_id: newCorrection.id,
              p_corr_code: newCorrection.correctionCode,
              p_original_txn_id: newCorrection.originalTransactionId,
              p_corrected_amount: newCorrection.correctedAmount,
              p_corrected_category: newCorrection.correctedCategory,
              p_corrected_fund_id: newCorrection.correctedFundId,
              p_corrected_account_id: newCorrection.correctedAccountId,
              p_corrected_to_fund_id: updatedTxnCandidate.toFundId || null,
              p_corrected_to_account_id: updatedTxnCandidate.toAccountId || null,
              p_corrected_donor_or_payee: updatedTxnCandidate.donorOrPayee,
              p_corrected_description: updatedTxnCandidate.description,
              p_correction_reason: newCorrection.correctionReason,
              p_original_snapshot: newCorrection.originalSnapshot,
              p_corrected_snapshot: newCorrection.correctedSnapshot,
            })
          ).then(
            async ({ error: rpcErr }) => {
              if (!rpcErr) return;
              const msg = (rpcErr.message || '').toLowerCase();
              if (
                rpcErr.code === '42883' ||
                rpcErr.code === 'PGRST202' ||
                msg.includes('could not find the function')
              ) {
                // Backward-compatible fallback for pre-upgrade DBs
                const insRes = await sb.from('financial_corrections').insert({
                  id: newCorrection.id,
                  correction_code: newCorrection.correctionCode,
                  original_transaction_id: newCorrection.originalTransactionId,
                  previous_amount: newCorrection.previousAmount,
                  corrected_amount: newCorrection.correctedAmount,
                  previous_category: newCorrection.previousCategory,
                  corrected_category: newCorrection.correctedCategory,
                  previous_fund_id: newCorrection.previousFundId,
                  corrected_fund_id: newCorrection.correctedFundId,
                  previous_account_id: newCorrection.previousAccountId,
                  corrected_account_id: newCorrection.correctedAccountId,
                  original_snapshot: newCorrection.originalSnapshot,
                  corrected_snapshot: newCorrection.correctedSnapshot,
                  correction_reason: newCorrection.correctionReason,
                  corrected_by: actorId,
                  corrected_by_role: newCorrection.correctedByRole,
                  created_at: nowISO,
                  requires_dual_approval: newCorrection.requiresDualApproval,
                  approval_status: newCorrection.approvalStatus,
                  approved_by: isDirectlyApproved ? actorId : null,
                  approved_at: isDirectlyApproved ? nowISO : null,
                });
                if (insRes.error) {
                  this.reportSyncError(`সংশোধনী সংরক্ষণ (${newCorrection.correctionCode})`, insRes.error);
                } else if (isDirectlyApproved) {
                  this.persistSupabase(
                    `সংশোধিত লেনদেন আপডেট (${originalTxn.transactionCode})`,
                    sb
                      .from('transactions')
                      .update({
                        amount: updatedTxnCandidate.amount,
                        category: updatedTxnCandidate.category,
                        fund_id: updatedTxnCandidate.fundId,
                        account_id: updatedTxnCandidate.accountId,
                        to_fund_id: updatedTxnCandidate.toFundId || null,
                        to_account_id: updatedTxnCandidate.toAccountId || null,
                        donor_or_payee: updatedTxnCandidate.donorOrPayee,
                        description: updatedTxnCandidate.description,
                        status: 'corrected',
                      })
                      .eq('id', originalTxn.id)
                  );
                  this.persistBalancesToSupabase();
                }
              } else {
                this.reportSyncError(`সংশোধনী সংরক্ষণ (${newCorrection.correctionCode})`, rpcErr);
              }
            },
            (err) => {
              this.reportSyncError(`সংশোধনী সংরক্ষণ (${newCorrection.correctionCode})`, err);
            }
          );
        }
      }

      this.logAudit(
        'REQUEST_CORRECTION',
        'correction',
        newCorrection.id,
        `আর্থিক সংশোধন ${newCorrection.correctionCode} মূল লেনদেন ${originalTxn.transactionCode}-এর বিপরীতে তৈরি হয়েছে (${cleanCorrectedAmount === 0 ? 'পূর্ণ বাতিল/রিভার্স ৳০' : `৳${cleanCorrectedAmount.toLocaleString()}`})। কারণ: "${correctionReason.trim()}" (অবস্থা: ${newCorrection.approvalStatus}, পার্থক্য: ৳${delta.toLocaleString()})।`
      );

      this.notify();
      return { success: true, correction: newCorrection };
    } finally {
      this.isLocked = false;
    }
  }

  public approveCorrection(corrId: string, note?: string): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (
      !this.isAuthenticated ||
      (!perms.can_approve_finance &&
        !(this.currentUser.role === 'super_admin' && this.authenticatedRole === 'super_admin'))
    ) {
      return { success: false, error: 'আপনার আর্থিক সংশোধন অনুমোদনের অনুমতি নেই।' };
    }
    if (this.isLocked) {
      return { success: false, error: 'অন্য একটি প্রক্রিয়া চলছে, অনুগ্রহ করে একটু পর চেষ্টা করুন।' };
    }
    this.isLocked = true;

    try {
      const corr = this.corrections.find((c) => c.id === corrId);
      if (!corr) return { success: false, error: 'সংশোধনী রেকর্ড খুঁজে পাওয়া যায়নি।' };
      if (corr.approvalStatus !== 'pending_approval') {
        return { success: false, error: 'সংশোধনীটি অনুমোদনের অপেক্ষায় নেই।' };
      }

      const isMasterSuperAdmin = this.currentUser.role === 'super_admin' && this.authenticatedRole === 'super_admin';
      const isSameProposer =
        (corr.correctedById && corr.correctedById === this.currentUser.id) ||
        corr.correctedByName === this.currentUser.name;

      if (isSameProposer && !isMasterSuperAdmin) {
        return {
          success: false,
          error: 'যিনি সংশোধন প্রস্তাব করেছেন তিনি নিজে এটি অনুমোদন করতে পারবেন না; অন্য একজন দায়িত্বপ্রাপ্তের অনুমোদন প্রয়োজন।',
        };
      }

      const originalTxn = this.transactions.find((t) => t.id === corr.originalTransactionId);
      if (!originalTxn) return { success: false, error: 'মূল লেনদেন খুঁজে পাওয়া যায়নি।' };

      const updatedTxn: FinancialTransaction = {
        ...originalTxn,
        ...(corr.correctedSnapshot as FinancialTransaction),
        status: 'corrected',
      };

      const simCheck = this.wouldCorrectionCauseNegativeBalance(originalTxn, updatedTxn);
      if (!simCheck.ok) {
        return { success: false, error: simCheck.error };
      }

      const nowISO = new Date().toISOString();
      const nowStr = nowISO.replace('T', ' ').substring(0, 19);

      this.applyBalanceChange(originalTxn, true);
      this.applyBalanceChange(updatedTxn, false);

      const approvedCorr: FinancialCorrection = {
        ...corr,
        approvalStatus: 'approved',
        approvedBy: this.currentUser.name,
        approvedAt: nowStr,
        approvalNote: note,
      };

      this.corrections = this.corrections.map((c) => (c.id === corrId ? approvedCorr : c));
      this.transactions = this.transactions.map((t) => (t.id === originalTxn.id ? updatedTxn : t));
      this.save('transactions', this.transactions);
      this.save('corrections', this.corrections);

      if (this.canPersistToSupabase() && supabase) {
        const sb = supabase;
        const actorId = isValidUUID(this.currentUser.id) ? this.currentUser.id : null;
        void Promise.resolve(
          sb.rpc('approve_correction_atomic', {
            p_corr_id: corr.id,
            p_note: note || null,
          })
        ).then(
          async ({ error: rpcErr }) => {
            if (!rpcErr) return;
            const msg = (rpcErr.message || '').toLowerCase();
            if (
              rpcErr.code === '42883' ||
              rpcErr.code === 'PGRST202' ||
              msg.includes('could not find the function')
            ) {
              const updCorr = await sb
                .from('financial_corrections')
                .update({
                  approval_status: 'approved',
                  approved_by: actorId,
                  approved_at: nowISO,
                  approval_note: note || null,
                })
                .eq('id', corr.id);
              if (updCorr.error) {
                this.reportSyncError(`সংশোধনী অনুমোদন (${corr.correctionCode})`, updCorr.error);
              } else {
                this.persistSupabase(
                  `সংশোধিত লেনদেন কার্যকর (${originalTxn.transactionCode})`,
                  sb
                    .from('transactions')
                    .update({
                      amount: updatedTxn.amount,
                      category: updatedTxn.category,
                      fund_id: updatedTxn.fundId,
                      account_id: updatedTxn.accountId,
                      to_fund_id: updatedTxn.toFundId || null,
                      to_account_id: updatedTxn.toAccountId || null,
                      donor_or_payee: updatedTxn.donorOrPayee,
                      description: updatedTxn.description,
                      status: 'corrected',
                    })
                    .eq('id', originalTxn.id)
                );
                this.persistBalancesToSupabase();
              }
            } else {
              this.reportSyncError(`সংশোধনী অনুমোদন (${corr.correctionCode})`, rpcErr);
            }
          },
          (err) => {
            this.reportSyncError(`সংশোধনী অনুমোদন (${corr.correctionCode})`, err);
          }
        );
      }

      this.logAudit(
        'APPROVE_CORRECTION',
        'correction',
        corr.id,
        `আর্থিক সংশোধন ${corr.correctionCode} (মূল ${originalTxn.transactionCode}) ৳${corr.previousAmount.toLocaleString()} -> ৳${corr.correctedAmount.toLocaleString()} অনুমোদিত হয়েছে। অনুমোদনকারী: ${this.currentUser.name}।`
      );

      this.notify();
      return { success: true };
    } finally {
      this.isLocked = false;
    }
  }

  // --- MEMBERSHIP MANAGEMENT ---
  public canManageMemberType(memberType: MemberType): boolean {
    if (!this.isAuthenticated) return false;
    if (this.currentUser.role === 'super_admin') return true;
    const perms = this.getEffectivePermissions();
    return memberType === 'student' ? Boolean(perms.can_manage_student_wing) : Boolean(perms.can_manage_members);
  }

  private generateNextMembershipId(memberType: MemberType): string {
    const prefix =
      memberType === 'student'
        ? ORGANIZATION_CONFIG.memberIdPrefixStudent
        : ORGANIZATION_CONFIG.memberIdPrefixGeneral;
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const year = new Date().getFullYear();
    const pattern = new RegExp(`^${escapedPrefix}-${year}-(\\d+)$`);
    let maxNum = 0;
    for (const m of this.members) {
      if (m.type === memberType) {
        const match = m.membershipId.match(pattern);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > maxNum) maxNum = n;
        }
      }
    }
    const nextNum = maxNum + 1;
    return `${prefix}-${year}-${nextNum.toString().padStart(3, '0')}`;
  }

  private generateTempTrackingId(): string {
    const year = new Date().getFullYear();
    let candidate = `APP-${year}-${Math.floor(100000 + Math.random() * 899999)}`;
    while (this.members.some((m) => m.membershipId.toUpperCase() === candidate)) {
      candidate = `APP-${year}-${Math.floor(100000 + Math.random() * 899999)}`;
    }
    return candidate;
  }

  public async addMemberApplication(
    params: Omit<Member, 'id' | 'membershipId' | 'status' | 'joinedDate'>
  ): Promise<{
    success: boolean;
    membershipId: string;
    error?: string;
  }> {
    if (isSupabaseConfigured && supabase) {
      try {
        const rpcRes = await supabase.rpc('submit_public_member_application', {
          p_type: params.type,
          p_full_name_bn: params.fullNameBn,
          p_full_name_en: params.fullNameEn || '',
          p_phone: params.phone,
          p_email: params.email || null,
          p_blood_group: params.bloodGroup,
          p_patgram_village: params.patgramAddress.village,
          p_patgram_union: params.patgramAddress.union,
          p_patgram_ward: params.patgramAddress.ward || null,
          p_rangpur_area: params.rangpurAddress.area,
          p_rangpur_thana: params.rangpurAddress.thana,
          p_profession: params.professionOrDesignation || null,
          p_institution: params.institution || null,
          p_department: params.department || null,
          p_academic_year: params.academicYear || null,
        });

        if (!rpcRes.error && rpcRes.data) {
          const row = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data;
          const returnedId = String(row.id || generateUUID());
          const returnedSerial = String(row.membership_id || '');
          const returnedDate = String(row.joined_date || new Date().toISOString().substring(0, 10)).substring(0, 10);

          const newMember: Member = {
            ...params,
            id: returnedId,
            membershipId: returnedSerial,
            status: 'pending',
            joinedDate: returnedDate,
          };
          this.members = [newMember, ...this.members];
          this.save('members', this.members);
          this.notify();
          return { success: true, membershipId: returnedSerial };
        }

        const errCode = rpcRes.error?.code || '';
        const errMsg = rpcRes.error?.message || '';
        const isMissingRpc =
          errCode === '42883' ||
          errCode === 'PGRST202' ||
          errMsg.toLowerCase().includes('could not find the function');

        if (!isMissingRpc) {
          return {
            success: false,
            membershipId: '',
            error: `আবেদন জমা দেওয়া যায়নি: ${errMsg || 'ডাটাবেজ ত্রুটি'}`,
          };
        }

        // Fallback direct insert with temporary APP-YYYY-XXXXXX tracking reference
        let lastInsertError = '';
        for (let attempt = 0; attempt < 6; attempt++) {
          const newId = generateUUID();
          const candidateSerial = this.generateTempTrackingId();

          const { error: insErr } = await supabase.from('members').insert({
            id: newId,
            membership_id: candidateSerial,
            type: params.type,
            full_name_bn: params.fullNameBn,
            full_name_en: params.fullNameEn || '',
            phone: params.phone,
            email: params.email || null,
            blood_group: params.bloodGroup,
            patgram_village: params.patgramAddress.village,
            patgram_union: params.patgramAddress.union,
            patgram_ward: params.patgramAddress.ward || null,
            rangpur_area: params.rangpurAddress.area,
            rangpur_thana: params.rangpurAddress.thana,
            profession: params.professionOrDesignation || null,
            institution: params.institution || null,
            department: params.department || null,
            academic_year: params.academicYear || null,
            status: 'pending',
          });

          if (!insErr) {
            const newMember: Member = {
              ...params,
              id: newId,
              membershipId: candidateSerial,
              status: 'pending',
              joinedDate: new Date().toISOString().substring(0, 10),
            };
            this.members = [newMember, ...this.members];
            this.save('members', this.members);
            this.notify();
            return { success: true, membershipId: candidateSerial };
          }

          lastInsertError = insErr.message || 'ডাটাবেজ ত্রুটি';
          if (insErr.code !== '23505') {
            return {
              success: false,
              membershipId: '',
              error: `আবেদন জমা দেওয়া যায়নি: ${lastInsertError}`,
            };
          }
        }

        return {
          success: false,
          membershipId: '',
          error: `আবেদন রেফারেন্স বরাদ্দে সমস্যা হয়েছে (${lastInsertError})। অনুগ্রহ করে পুনরায় চেষ্টা করুন।`,
        };
      } catch (e: unknown) {
        return {
          success: false,
          membershipId: '',
          error: e instanceof Error ? e.message : 'সার্ভার সংযোগ ত্রুটি',
        };
      }
    }

    const trackingId = this.generateTempTrackingId();
    const newMember: Member = {
      ...params,
      id: generateUUID(),
      membershipId: trackingId,
      status: 'pending',
      joinedDate: new Date().toISOString().substring(0, 10),
    };

    this.members = [newMember, ...this.members];
    this.save('members', this.members);
    this.logAudit(
      'APPLY_MEMBERSHIP',
      'member',
      newMember.id,
      `${newMember.fullNameBn} (${newMember.membershipId}) নতুন সদস্যপদের আবেদন জমা দিয়েছেন।`
    );
    this.notify();
    return { success: true, membershipId: trackingId };
  }

  public addMemberByAdmin(
    params: Omit<Member, 'id' | 'joinedDate' | 'membershipId' | 'status'> & {
      membershipId?: string;
      status?: MemberStatus;
    }
  ): { success: boolean; membershipId?: string; error?: string } {
    if (!this.canManageMemberType(params.type)) {
      return {
        success: false,
        error:
          params.type === 'general'
            ? 'আপনার সাধারণ সদস্য যুক্ত করার অনুমতি নেই।'
            : 'আপনার ছাত্র সদস্য যুক্ত করার অনুমতি নেই।',
      };
    }

    if (!params.fullNameBn?.trim() || !params.phone?.trim()) {
      return { success: false, error: 'সদস্যের বাংলা নাম এবং মোবাইল নম্বর দেওয়া বাধ্যতামূলক।' };
    }

    const membershipId = (params.membershipId || '').trim() || this.generateNextMembershipId(params.type);
    if (this.members.some((m) => m.membershipId.trim().toLowerCase() === membershipId.toLowerCase())) {
      return { success: false, error: `সিরিয়াল নম্বর "${membershipId}" ইতোমধ্যে অন্য একজন সদস্যের জন্য ব্যবহৃত হয়েছে।` };
    }

    const initialStatus: MemberStatus = params.status || 'active';
    const joinedDate = new Date().toISOString().substring(0, 10);

    const newMember: Member = {
      type: params.type,
      fullNameBn: params.fullNameBn.trim(),
      fullNameEn: (params.fullNameEn || '').trim(),
      phone: params.phone.trim(),
      email: params.email?.trim() || '',
      bloodGroup: params.bloodGroup,
      patgramAddress: {
        village: params.patgramAddress.village.trim() || 'পাটগ্রাম',
        union: params.patgramAddress.union.trim() || 'পাটগ্রাম',
        ward: params.patgramAddress.ward?.trim() || undefined,
      },
      rangpurAddress: {
        area: params.rangpurAddress.area.trim() || 'রংপুর',
        thana: params.rangpurAddress.thana.trim() || 'কোতোয়ালী',
      },
      professionOrDesignation: params.professionOrDesignation?.trim() || undefined,
      institution: params.institution?.trim() || undefined,
      department: params.department?.trim() || undefined,
      academicYear: params.academicYear?.trim() || undefined,
      notes: params.notes?.trim() || undefined,
      id: generateUUID(),
      membershipId,
      status: initialStatus,
      joinedDate,
    };

    this.members = [newMember, ...this.members];
    this.save('members', this.members);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `নতুন সদস্য যুক্ত (${newMember.membershipId})`,
        supabase.from('members').insert({
          id: newMember.id,
          membership_id: newMember.membershipId,
          type: newMember.type,
          full_name_bn: newMember.fullNameBn,
          full_name_en: newMember.fullNameEn,
          phone: newMember.phone,
          email: newMember.email || null,
          blood_group: newMember.bloodGroup,
          patgram_village: newMember.patgramAddress.village,
          patgram_union: newMember.patgramAddress.union,
          patgram_ward: newMember.patgramAddress.ward || null,
          rangpur_area: newMember.rangpurAddress.area,
          rangpur_thana: newMember.rangpurAddress.thana,
          profession: newMember.professionOrDesignation || null,
          institution: newMember.institution || null,
          department: newMember.department || null,
          academic_year: newMember.academicYear || null,
          status: newMember.status,
          joined_date: newMember.joinedDate,
          notes: newMember.notes || null,
        })
      );
    }

    this.logAudit(
      'ADMIN_ADD_MEMBER',
      'member',
      newMember.id,
      `অ্যাডমিন সরাসরি নতুন ${newMember.type === 'student' ? 'ছাত্র' : 'সাধারণ'} সদস্য "${newMember.fullNameBn}" (${newMember.membershipId}) যুক্ত করেছেন।`
    );
    this.notify();
    return { success: true, membershipId: newMember.membershipId };
  }

  public updateMemberSerial(memberId: string, newSerial: string): { success: boolean; error?: string } {
    const member = this.members.find((m) => m.id === memberId);
    if (!member) return { success: false, error: 'সদস্য খুঁজে পাওয়া যায়নি।' };
    if (!this.canManageMemberType(member.type)) {
      return { success: false, error: 'এই উইংয়ের সদস্যের সিরিয়াল নম্বর পরিবর্তনের অনুমতি আপনার নেই।' };
    }
    const cleanSerial = newSerial.trim();
    if (!cleanSerial || cleanSerial.length < 3) {
      return { success: false, error: 'সঠিক সিরিয়াল নম্বর লিখুন (কমপক্ষে ৩ অক্ষর)।' };
    }
    if (this.members.some((m) => m.id !== memberId && m.membershipId.trim().toLowerCase() === cleanSerial.toLowerCase())) {
      return { success: false, error: `সিরিয়াল নম্বর "${cleanSerial}" ইতোমধ্যে অন্য সদস্যের রয়েছে।` };
    }

    const oldSerial = member.membershipId;
    this.members = this.members.map((m) => (m.id === memberId ? { ...m, membershipId: cleanSerial } : m));
    this.save('members', this.members);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `সদস্য সিরিয়াল আপডেট (${cleanSerial})`,
        supabase.from('members').update({ membership_id: cleanSerial }).eq('id', memberId)
      );
    }

    this.logAudit(
      'UPDATE_MEMBER_SERIAL',
      'member',
      memberId,
      `সদস্য ${member.fullNameBn}-এর সিরিয়াল নম্বর "${oldSerial}" থেকে "${cleanSerial}"-এ পরিবর্তন করা হয়েছে।`
    );
    this.notify();
    return { success: true };
  }

  public deleteMember(memberId: string): { success: boolean; error?: string } {
    const member = this.members.find((m) => m.id === memberId);
    if (!member) return { success: false, error: 'সদস্য খুঁজে পাওয়া যায়নি।' };
    if (!this.canManageMemberType(member.type)) {
      return { success: false, error: 'এই উইংয়ের সদস্য মুছে ফেলার অনুমতি আপনার নেই।' };
    }

    this.members = this.members.filter((m) => m.id !== memberId);
    this.save('members', this.members);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `সদস্য মুছে ফেলা (${member.membershipId})`,
        supabase.from('members').delete().eq('id', memberId)
      );
    }

    this.logAudit(
      'DELETE_MEMBER',
      'member',
      memberId,
      `সদস্য ${member.fullNameBn} (${member.membershipId})-এর তথ্য ডাটাবেজ থেকে মুছে ফেলা হয়েছে।`
    );
    this.notify();
    return { success: true };
  }

  public updateMemberStatus(
    memberId: string,
    status: MemberStatus,
    notes?: string
  ): { success: boolean; membershipId?: string; error?: string } {
    const member = this.members.find((m) => m.id === memberId);
    if (!member) {
      return { success: false, error: 'সদস্য খুঁজে পাওয়া যায়নি।' };
    }
    if (!this.canManageMemberType(member.type)) {
      return { success: false, error: 'এই উইংয়ের সদস্যের অবস্থান পরিবর্তনের অনুমতি নেই।' };
    }

    const updatedNotes = notes !== undefined ? notes : member.notes;
    const isApprovingPending = member.status === 'pending' && status === 'active';
    const expectedPrefix =
      member.type === 'student'
        ? ORGANIZATION_CONFIG.memberIdPrefixStudent
        : ORGANIZATION_CONFIG.memberIdPrefixGeneral;
    const needsOfficialSerial =
      isApprovingPending &&
      (member.membershipId.startsWith('APP-') || !member.membershipId.startsWith(expectedPrefix));

    const assignedMembershipId = needsOfficialSerial
      ? this.generateNextMembershipId(member.type)
      : member.membershipId;

    this.members = this.members.map((m) =>
      m.id === memberId
        ? { ...m, status, membershipId: assignedMembershipId, notes: updatedNotes }
        : m
    );
    this.save('members', this.members);

    if (this.canPersistToSupabase() && supabase) {
      const sb = supabase;
      if (isApprovingPending) {
        void Promise.resolve(sb.rpc('approve_member_application', { p_member_id: memberId })).then(
          async ({ data, error }) => {
            if (!error && data) {
              const row = (Array.isArray(data) ? data[0] : data) as { membership_id?: string } | undefined;
              const serverSerial = row?.membership_id ? String(row.membership_id) : assignedMembershipId;
              if (serverSerial && serverSerial !== assignedMembershipId) {
                this.members = this.members.map((m) =>
                  m.id === memberId ? { ...m, membershipId: serverSerial } : m
                );
                this.save('members', this.members);
                this.notify();
              }
              if (notes !== undefined) {
                await sb.from('members').update({ notes: updatedNotes || null }).eq('id', memberId);
              }
              return;
            }
            const errMsg = (error?.message || '').toLowerCase();
            if (
              error?.code === '42883' ||
              error?.code === 'PGRST202' ||
              errMsg.includes('could not find the function')
            ) {
              this.persistSupabase(
                `সদস্য অনুমোদন ও সিরিয়াল আপডেট (${assignedMembershipId})`,
                sb
                  .from('members')
                  .update({
                    status: 'active',
                    membership_id: assignedMembershipId,
                    notes: updatedNotes || null,
                  })
                  .eq('id', memberId)
              );
            } else if (error) {
              this.reportSyncError(`সদস্য অনুমোদন (${member.membershipId})`, error);
            }
          },
          (err) => {
            this.reportSyncError(`সদস্য অনুমোদন (${member.membershipId})`, err);
          }
        );
      } else {
        this.persistSupabase(
          `সদস্য স্ট্যাটাস আপডেট (${assignedMembershipId})`,
          sb
            .from('members')
            .update({
              status,
              notes: updatedNotes || null,
            })
            .eq('id', memberId)
        );
      }
    }

    this.logAudit(
      'UPDATE_MEMBER_STATUS',
      'member',
      memberId,
      `সদস্য ${member.fullNameBn} (${assignedMembershipId})-এর স্ট্যাটাস "${status}" করা হয়েছে।`
    );

    this.notify();
    return { success: true, membershipId: assignedMembershipId };
  }

  // --- COMMITTEES & POSITION TOGGLES ---
  public togglePositionVisibility(termId: string, positionId: string): boolean {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_manage_committees) {
      return false;
    }
    let updatedVal = false;
    this.committees = this.committees.map((term) => {
      if (term.id === termId) {
        return {
          ...term,
          positions: term.positions.map((pos) => {
            if (pos.id === positionId) {
              updatedVal = !pos.isPublished;
              return { ...pos, isPublished: updatedVal };
            }
            return pos;
          }),
        };
      }
      return term;
    });

    this.save('committees', this.committees);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        'পদবির প্রদর্শন স্ট্যাটাস আপডেট',
        supabase.from('committee_positions').update({ is_published: updatedVal }).eq('id', positionId)
      );
    }

    this.logAudit(
      'TOGGLE_COMMITTEE_VISIBILITY',
      'committee',
      positionId,
      `কমিটির পদবির পাবলিক প্রদর্শন স্ট্যাটাস "${updatedVal ? 'প্রকাশিত' : 'অপ্রকাশিত'}" করা হয়েছে।`
    );
    this.notify();
    return updatedVal;
  }

  public addCommitteePosition(termId: string, positionData: Omit<CommitteePosition, 'id'>): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_manage_committees) {
      return { success: false, error: 'কমিটিতে পদবি যুক্ত করার অনুমতি নেই।' };
    }
    const cleanPhotoUrl = positionData.photoUrl?.trim() || undefined;
    const newPos: CommitteePosition = {
      ...positionData,
      photoUrl: cleanPhotoUrl,
      id: generateUUID(),
    };

    this.committees = this.committees.map((term) => {
      if (term.id === termId) {
        return {
          ...term,
          positions: [...term.positions, newPos].sort((a, b) => a.priority - b.priority),
        };
      }
      return term;
    });

    this.save('committees', this.committees);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `কমিটির পদবি যুক্ত (${newPos.title})`,
        supabase.from('committee_positions').insert({
          id: newPos.id,
          committee_id: termId,
          title: newPos.title,
          member_name_bn: newPos.memberNameBn,
          member_name_en: newPos.memberNameEn || null,
          phone: newPos.phone || null,
          photo_url: cleanPhotoUrl || null,
          priority: newPos.priority,
          is_published: newPos.isPublished,
        })
      );
    }

    this.logAudit('ADD_POSITION', 'committee', newPos.id, `কমিটিতে নতুন পদ "${newPos.title}" যুক্ত হয়েছে।`);
    this.notify();
    return { success: true };
  }

  public updateCommitteePosition(
    termId: string,
    positionId: string,
    updates: Partial<Omit<CommitteePosition, 'id'>>
  ): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_manage_committees) {
      return { success: false, error: 'কমিটির পদবি সংশোধনের অনুমতি নেই।' };
    }

    const term = this.committees.find((t) => t.id === termId);
    const existing = term?.positions.find((p) => p.id === positionId);
    if (!existing) {
      return { success: false, error: 'সংশোধনের জন্য পদবি খুঁজে পাওয়া যায়নি।' };
    }

    const cleanPhotoUrl =
      updates.photoUrl !== undefined ? updates.photoUrl.trim() || undefined : existing.photoUrl;

    const updatedPos: CommitteePosition = {
      ...existing,
      ...updates,
      photoUrl: cleanPhotoUrl,
    };

    this.committees = this.committees.map((t) => {
      if (t.id === termId) {
        return {
          ...t,
          positions: t.positions
            .map((p) => (p.id === positionId ? updatedPos : p))
            .sort((a, b) => a.priority - b.priority),
        };
      }
      return t;
    });

    this.save('committees', this.committees);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `কমিটির পদবি সংশোধন (${updatedPos.title})`,
        supabase
          .from('committee_positions')
          .update({
            title: updatedPos.title,
            member_name_bn: updatedPos.memberNameBn,
            member_name_en: updatedPos.memberNameEn || null,
            phone: updatedPos.phone || null,
            photo_url: cleanPhotoUrl || null,
            priority: updatedPos.priority,
            is_published: updatedPos.isPublished,
          })
          .eq('id', positionId)
      );
    }

    this.logAudit(
      'UPDATE_POSITION',
      'committee',
      positionId,
      `কমিটির পদ "${updatedPos.title}" (${updatedPos.memberNameBn})-এর তথ্য ও ছবি হালনাগাদ করা হয়েছে।`
    );
    this.notify();
    return { success: true };
  }

  public deleteCommitteePosition(termId: string, positionId: string): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_manage_committees) {
      return { success: false, error: 'কমিটির পদবি মুছে ফেলার অনুমতি নেই।' };
    }
    const term = this.committees.find((t) => t.id === termId);
    const pos = term?.positions.find((p) => p.id === positionId);
    if (!pos) return { success: false, error: 'পদবি খুঁজে পাওয়া যায়নি।' };

    this.committees = this.committees.map((t) =>
      t.id === termId ? { ...t, positions: t.positions.filter((p) => p.id !== positionId) } : t
    );
    this.save('committees', this.committees);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `কমিটির পদবি মোছা (${pos.title})`,
        supabase.from('committee_positions').delete().eq('id', positionId)
      );
    }

    this.logAudit('DELETE_POSITION', 'committee', positionId, `কমিটি থেকে পদ "${pos.title}" (${pos.memberNameBn}) মুছে ফেলা হয়েছে।`);
    this.notify();
    return { success: true };
  }

  public addCommitteeTerm(termData: Omit<CommitteeTerm, 'id'>): { success: boolean; term?: CommitteeTerm; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_manage_committees) {
      return { success: false, error: 'নতুন কমিটি তৈরি করার অনুমতি নেই।' };
    }
    const newTerm: CommitteeTerm = {
      ...termData,
      id: generateUUID(),
    };

    if (newTerm.isCurrent) {
      this.committees = this.committees.map((t) => (t.wing === newTerm.wing ? { ...t, isCurrent: false } : t));
    }

    this.committees = [newTerm, ...this.committees];
    this.save('committees', this.committees);

    if (this.canPersistToSupabase() && supabase) {
      const sb = supabase;
      if (newTerm.isCurrent) {
        this.persistSupabase(
          'পূর্ববর্তী কমিটি আর্কাইভ',
          sb.from('committees').update({ is_current: false }).eq('wing', newTerm.wing)
        );
      }
      this.persistSupabase(
        `নতুন কমিটি তৈরি (${newTerm.title})`,
        sb.from('committees').insert({
          id: newTerm.id,
          title: newTerm.title,
          wing: newTerm.wing,
          start_year: newTerm.startYear,
          end_year: newTerm.endYear,
          is_current: newTerm.isCurrent,
        })
      );
    }

    this.logAudit('CREATE_COMMITTEE', 'committee', newTerm.id, `নতুন কমিটি "${newTerm.title}" তৈরি হয়েছে (আগের কমিটি সংরক্ষিত)।`);
    this.notify();
    return { success: true, term: newTerm };
  }

  public deleteCommitteeTerm(termId: string): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_manage_committees) {
      return { success: false, error: 'কমিটি মেয়াদ মুছে ফেলার অনুমতি নেই।' };
    }
    const term = this.committees.find((t) => t.id === termId);
    if (!term) return { success: false, error: 'কমিটি খুঁজে পাওয়া যায়নি।' };

    this.committees = this.committees.filter((t) => t.id !== termId);
    this.save('committees', this.committees);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `কমিটি মেয়াদ মোছা (${term.title})`,
        supabase.from('committees').delete().eq('id', termId)
      );
    }

    this.logAudit('DELETE_COMMITTEE', 'committee', termId, `কমিটি মেয়াদ "${term.title}" মুছে ফেলা হয়েছে।`);
    this.notify();
    return { success: true };
  }

  // --- FOUNDERS & FOUNDING MEMBERS MANAGEMENT ---
  private canEditFounders(): boolean {
    if (!this.isAuthenticated) return false;
    if (this.currentUser.role === 'super_admin') return true;
    const perms = this.getEffectivePermissions();
    return Boolean(perms.can_manage_committees || perms.can_manage_settings);
  }

  public addFounder(
    founderData: Omit<FounderEntry, 'id'>
  ): { success: boolean; founder?: FounderEntry; error?: string } {
    if (!this.canEditFounders()) {
      return { success: false, error: 'প্রতিষ্ঠাতা বা প্রতিষ্ঠাতা সদস্য যুক্ত করার অনুমতি আপনার নেই।' };
    }
    if (!founderData.nameBn.trim()) {
      return { success: false, error: 'নাম (বাংলা) দেওয়া বাধ্যতামূলক।' };
    }
    const newFounder: FounderEntry = {
      ...founderData,
      id: generateUUID(),
      nameBn: founderData.nameBn.trim(),
      nameEn: founderData.nameEn?.trim() || undefined,
      designationBn: founderData.designationBn.trim() || 'প্রতিষ্ঠাতা সদস্য',
      photoUrl: founderData.photoUrl?.trim() || undefined,
      bioBn: founderData.bioBn?.trim() || undefined,
    };

    const updatedFounders = [...(this.settings.founders || []), newFounder].sort(
      (a, b) => a.priority - b.priority
    );
    this.settings = { ...this.settings, founders: updatedFounders };
    this.save('settings', this.settings);
    this.persistSettingsToSupabase();

    this.logAudit(
      'ADD_FOUNDER',
      'founder',
      newFounder.id,
      `${newFounder.category === 'founder' ? 'প্রতিষ্ঠাতা' : 'প্রতিষ্ঠাতা সদস্য'} "${newFounder.nameBn}" (${newFounder.designationBn}) যুক্ত হয়েছেন।`
    );
    this.notify();
    return { success: true, founder: newFounder };
  }

  public updateFounder(
    founderId: string,
    updates: Partial<Omit<FounderEntry, 'id'>>
  ): { success: boolean; error?: string } {
    if (!this.canEditFounders()) {
      return { success: false, error: 'প্রতিষ্ঠাতা বা প্রতিষ্ঠাতা সদস্যের তথ্য সংশোধনের অনুমতি নেই।' };
    }
    const existing = (this.settings.founders || []).find((f) => f.id === founderId);
    if (!existing) return { success: false, error: 'তালিকায় সংশ্লিষ্ট নাম খুঁজে পাওয়া যায়নি।' };

    const updatedFounders = (this.settings.founders || [])
      .map((f) => (f.id === founderId ? { ...f, ...updates } : f))
      .sort((a, b) => a.priority - b.priority);

    this.settings = { ...this.settings, founders: updatedFounders };
    this.save('settings', this.settings);
    this.persistSettingsToSupabase();

    this.logAudit(
      'UPDATE_FOUNDER',
      'founder',
      founderId,
      `প্রতিষ্ঠাতা/সদস্য "${updates.nameBn || existing.nameBn}"-এর তথ্য সংশোধন করা হয়েছে।`
    );
    this.notify();
    return { success: true };
  }

  public deleteFounder(founderId: string): { success: boolean; error?: string } {
    if (!this.canEditFounders()) {
      return { success: false, error: 'প্রতিষ্ঠাতা বা প্রতিষ্ঠাতা সদস্য মুছে ফেলার অনুমতি নেই।' };
    }
    const existing = (this.settings.founders || []).find((f) => f.id === founderId);
    if (!existing) return { success: false, error: 'তালিকায় সংশ্লিষ্ট নাম খুঁজে পাওয়া যায়নি।' };

    const updatedFounders = (this.settings.founders || []).filter((f) => f.id !== founderId);
    this.settings = { ...this.settings, founders: updatedFounders };
    this.save('settings', this.settings);
    this.persistSettingsToSupabase();

    this.logAudit(
      'DELETE_FOUNDER',
      'founder',
      founderId,
      `${existing.category === 'founder' ? 'প্রতিষ্ঠাতা' : 'প্রতিষ্ঠাতা সদস্য'} "${existing.nameBn}" তালিকা থেকে মুছে ফেলা হয়েছে।`
    );
    this.notify();
    return { success: true };
  }

  public toggleFounderVisibility(founderId: string): boolean {
    if (!this.canEditFounders()) return false;
    let nextPublished = false;
    const updatedFounders = (this.settings.founders || []).map((f) => {
      if (f.id === founderId) {
        nextPublished = !f.isPublished;
        return { ...f, isPublished: nextPublished };
      }
      return f;
    });
    this.settings = { ...this.settings, founders: updatedFounders };
    this.save('settings', this.settings);
    this.persistSettingsToSupabase();
    this.logAudit(
      'TOGGLE_FOUNDER_VISIBILITY',
      'founder',
      founderId,
      `প্রতিষ্ঠাতা/সদস্যের পাবলিক প্রদর্শন স্ট্যাটাস "${nextPublished ? 'প্রকাশিত' : 'অপ্রকাশিত'}" করা হয়েছে।`
    );
    this.notify();
    return nextPublished;
  }

  // --- AID APPLICATIONS ---
  public async submitAidApplication(
    data: Omit<AidApplication, 'id' | 'status' | 'submittedAt'>
  ): Promise<{ success: boolean; error?: string }> {
    if (!Number.isFinite(data.requestedAmount) || data.requestedAmount <= 0) {
      return { success: false, error: 'সাহায্যের সঠিক পরিমাণ উল্লেখ করুন।' };
    }
    const newId = generateUUID();
    const newAid: AidApplication = {
      ...data,
      requestedAmount: roundBDT(data.requestedAmount),
      id: newId,
      status: 'submitted',
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error: insertErr } = await supabase.from('aid_applications').insert({
          id: newAid.id,
          applicant_name: newAid.applicantName,
          phone: newAid.phone,
          email: newAid.email || null,
          type: newAid.type,
          patgram_address: newAid.patgramAddress,
          current_address: newAid.currentAddress,
          requested_amount: newAid.requestedAmount,
          reason: newAid.reason,
          status: 'submitted',
        });
        if (insertErr) {
          return {
            success: false,
            error: `সহায়তার আবেদন জমা দেওয়া যায়নি: ${insertErr.message}`,
          };
        }
      } catch (e: unknown) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'সার্ভার সংযোগ ত্রুটি',
        };
      }
    }

    this.aidApplications = [newAid, ...this.aidApplications];
    this.save('aidApplications', this.aidApplications);
    this.logAudit('SUBMIT_AID', 'aid', newAid.id, `${newAid.applicantName} ৳${newAid.requestedAmount} সহায়তার আবেদন করেছেন।`);
    this.notify();
    return { success: true };
  }

  public updateAidStatus(aidId: string, status: AidApplication['status'], fundId?: string): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (
      !this.isAuthenticated ||
      (!perms.can_manage_funds && !perms.can_manage_student_wing && this.currentUser.role !== 'super_admin')
    ) {
      return { success: false, error: 'সহায়তা আবেদন অনুমোদনের অনুমতি নেই।' };
    }
    const existing = this.aidApplications.find((a) => a.id === aidId);
    const resolvedFundId = fundId || existing?.allocatedFundId;
    this.aidApplications = this.aidApplications.map((a) =>
      a.id === aidId ? { ...a, status, reviewedBy: this.currentUser.name, allocatedFundId: resolvedFundId } : a
    );
    this.save('aidApplications', this.aidApplications);

    if (this.canPersistToSupabase() && supabase) {
      const actorId = isValidUUID(this.currentUser.id) ? this.currentUser.id : null;
      this.persistSupabase(
        'সহায়তা আবেদনের অবস্থা আপডেট',
        supabase
          .from('aid_applications')
          .update({
            status,
            allocated_fund_id: resolvedFundId || null,
            reviewed_by: actorId,
          })
          .eq('id', aidId)
      );
    }

    this.logAudit('UPDATE_AID_STATUS', 'aid', aidId, `সহায়তা আবেদনের অবস্থা "${status}" করা হয়েছে।`);
    this.notify();
    return { success: true };
  }

  // --- NOTICES MANAGEMENT ---
  public addNotice(notice: Omit<Notice, 'id' | 'publishDate'>): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_manage_notices) {
      return { success: false, error: 'নোটিশ প্রকাশের অনুমতি নেই।' };
    }
    const newNotice: Notice = {
      ...notice,
      id: generateUUID(),
      publishDate: new Date().toISOString().substring(0, 10),
    };
    this.notices = [newNotice, ...this.notices];
    this.save('notices', this.notices);

    if (this.canPersistToSupabase() && supabase) {
      const actorId = isValidUUID(this.currentUser.id) ? this.currentUser.id : null;
      this.persistSupabase(
        `নোটিশ প্রকাশ (${newNotice.title})`,
        supabase.from('notices').insert({
          id: newNotice.id,
          title: newNotice.title,
          category: newNotice.category,
          content: newNotice.content,
          publish_date: newNotice.publishDate,
          is_pinned: newNotice.isPinned,
          author: newNotice.author,
          attachment_url: newNotice.attachmentUrl || null,
          created_by: actorId,
        })
      );
    }

    this.logAudit('ADD_NOTICE', 'notice', newNotice.id, `নতুন নোটিশ "${newNotice.title}" প্রকাশিত হয়েছে।`);
    this.notify();
    return { success: true };
  }

  public deleteNotice(noticeId: string): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_manage_notices) {
      return { success: false, error: 'নোটিশ মোছার অনুমতি নেই।' };
    }
    this.notices = this.notices.filter((n) => n.id !== noticeId);
    this.save('notices', this.notices);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        'নোটিশ মোছা',
        supabase.from('notices').delete().eq('id', noticeId)
      );
    }

    this.logAudit('DELETE_NOTICE', 'notice', noticeId, `নোটিশ মোছা হয়েছে।`);
    this.notify();
    return { success: true };
  }

  // --- FUNDS & ACCOUNTS MANAGEMENT ---
  public addFund(fund: Omit<FinancialFund, 'id' | 'currentBalance'>): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_manage_funds) {
      return { success: false, error: 'নতুন তহবিল তৈরি করার অনুমতি নেই।' };
    }
    const codeUpper = fund.code.trim().toUpperCase();
    if (this.funds.some((f) => f.code.toUpperCase() === codeUpper || f.name.trim() === fund.name.trim())) {
      return { success: false, error: 'একই নাম বা কোডের তহবিল ইতোমধ্যে বিদ্যমান।' };
    }
    const newFund: FinancialFund = {
      ...fund,
      code: codeUpper,
      name: fund.name.trim(),
      id: generateUUID(),
      currentBalance: 0,
    };
    this.funds = [...this.funds, newFund];
    this.save('funds', this.funds);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `নতুন তহবিল তৈরি (${newFund.name})`,
        supabase.from('funds').insert({
          id: newFund.id,
          name: newFund.name,
          code: newFund.code,
          description: newFund.description,
          current_balance: 0,
          is_active: newFund.isActive,
          is_default: newFund.isDefault,
        })
      );
    }

    this.logAudit('ADD_FUND', 'fund', newFund.id, `নতুন তহবিল "${newFund.name}" তৈরি হয়েছে।`);
    this.notify();
    return { success: true };
  }

  public deleteFund(fundId: string): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_manage_funds) {
      return { success: false, error: 'তহবিল মুছে ফেলার অনুমতি আপনার নেই।' };
    }
    const fund = this.funds.find((f) => f.id === fundId);
    if (!fund) return { success: false, error: 'তহবিল খুঁজে পাওয়া যায়নি।' };
    if (fund.isDefault) {
      return { success: false, error: 'সংগঠনের মূল/ডিফল্ট তহবিল মুছে ফেলা যাবে না।' };
    }
    if (fund.currentBalance > 0) {
      return {
        success: false,
        error: `"${fund.name}" তহবিলে বর্তমানে ৳${fund.currentBalance.toLocaleString()} ব্যালেন্স রয়েছে। ব্যালেন্স শূন্য না করে তহবিল ডিলিট করা যাবে না।`,
      };
    }
    const hasTxnRef = this.transactions.some((t) => t.fundId === fundId || t.toFundId === fundId);
    const hasCorrRef = this.corrections.some((c) => c.previousFundId === fundId || c.correctedFundId === fundId);
    const hasAidRef = this.aidApplications.some((a) => a.allocatedFundId === fundId);

    if (hasTxnRef || hasCorrRef || hasAidRef) {
      return {
        success: false,
        error: `"${fund.name}" তহবিলে পূর্বের লেনদেন বা সহায়তার রেকর্ড যুক্ত রয়েছে। অডিট নিরাপত্তা রক্ষায় এটি ডিলিট না করে "নিষ্ক্রিয় (Archive)" করে রাখুন।`,
      };
    }

    this.funds = this.funds.filter((f) => f.id !== fundId);
    this.save('funds', this.funds);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `তহবিল মোছা (${fund.name})`,
        supabase.from('funds').delete().eq('id', fundId)
      );
    }

    this.logAudit('DELETE_FUND', 'fund', fundId, `অব্যবহৃত তহবিল "${fund.name}" (${fund.code}) মুছে ফেলা হয়েছে।`);
    this.notify();
    return { success: true };
  }

  public toggleFundActive(fundId: string): { success: boolean; isActive?: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_manage_funds) {
      return { success: false, error: 'তহবিলের অবস্থা পরিবর্তনের অনুমতি নেই।' };
    }
    const fund = this.funds.find((f) => f.id === fundId);
    if (!fund) return { success: false, error: 'তহবিল খুঁজে পাওয়া যায়নি।' };
    if (fund.isDefault && fund.isActive) {
      return { success: false, error: 'ডিফল্ট তহবিল নিষ্ক্রিয় করা যাবে না।' };
    }

    const nextActive = !fund.isActive;
    this.funds = this.funds.map((f) => (f.id === fundId ? { ...f, isActive: nextActive } : f));
    this.save('funds', this.funds);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `তহবিল সক্রিয়/নিষ্ক্রিয় (${fund.name})`,
        supabase.from('funds').update({ is_active: nextActive }).eq('id', fundId)
      );
    }

    this.logAudit(
      'TOGGLE_FUND_ACTIVE',
      'fund',
      fundId,
      `তহবিল "${fund.name}"-কে "${nextActive ? 'সক্রিয়' : 'নিষ্ক্রিয় (আর্কাইভ)'}" করা হয়েছে।`
    );
    this.notify();
    return { success: true, isActive: nextActive };
  }

  public addAccount(account: Omit<FinancialAccount, 'id' | 'currentBalance'>): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || !perms.can_manage_accounts) {
      return { success: false, error: 'নতুন অ্যাকাউন্ট তৈরি করার অনুমতি নেই।' };
    }
    if (this.accounts.some((a) => a.name.trim() === account.name.trim())) {
      return { success: false, error: 'একই নামের অ্যাকাউন্ট ইতোমধ্যে বিদ্যমান।' };
    }
    const newAccount: FinancialAccount = {
      ...account,
      name: account.name.trim(),
      id: generateUUID(),
      currentBalance: 0,
    };
    this.accounts = [...this.accounts, newAccount];
    this.save('accounts', this.accounts);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `নতুন পেমেন্ট অ্যাকাউন্ট তৈরি (${newAccount.name})`,
        supabase.from('accounts').insert({
          id: newAccount.id,
          name: newAccount.name,
          type: newAccount.type,
          account_number: newAccount.accountNumber || null,
          current_balance: 0,
          is_active: newAccount.isActive,
        })
      );
    }

    this.logAudit('ADD_ACCOUNT', 'account', newAccount.id, `নতুন অ্যাকাউন্ট "${newAccount.name}" তৈরি হয়েছে।`);
    this.notify();
    return { success: true };
  }

  // --- SYSTEM SETTINGS & PERMISSIONS ---
  public applyThemeToDocument(preset: ThemePreset = this.settings.themePreset || 'emerald_gold') {
    if (typeof document === 'undefined') return;
    const resolvedPreset: ThemePreset = THEME_PRESET_MAP[preset] ? preset : 'emerald_gold';
    document.documentElement.setAttribute('data-theme', resolvedPreset);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', THEME_PRESET_MAP[resolvedPreset].themeColorMeta);
    }
  }

  public updateSettings(newSettings: Partial<SystemSettings>): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (
      !this.isAuthenticated ||
      (!perms.can_manage_settings && this.currentUser.role !== 'super_admin')
    ) {
      return { success: false, error: 'সিস্টেম সেটিংস পরিবর্তনের অনুমতি নেই।' };
    }
    this.settings = {
      ...this.settings,
      ...newSettings,
      enableStudentWing: newSettings.enableStudentWing ?? this.settings.enableStudentWing ?? INITIAL_SETTINGS.enableStudentWing,
      studentWingNameBn: newSettings.studentWingNameBn ?? this.settings.studentWingNameBn ?? INITIAL_SETTINGS.studentWingNameBn,
      enableEventsModule: newSettings.enableEventsModule ?? this.settings.enableEventsModule ?? INITIAL_SETTINGS.enableEventsModule,
      themePreset: newSettings.themePreset ?? this.settings.themePreset ?? INITIAL_SETTINGS.themePreset,
      heroImageUrl: newSettings.heroImageUrl !== undefined ? newSettings.heroImageUrl : (this.settings.heroImageUrl ?? ''),
      articles: {
        ...this.settings.articles,
        ...(newSettings.articles || {}),
      },
      founders: Array.isArray(newSettings.founders) ? newSettings.founders : this.settings.founders,
    };
    this.save('settings', this.settings);
    this.applyThemeToDocument(this.settings.themePreset);
    this.persistSettingsToSupabase();
    this.logAudit('UPDATE_SETTINGS', 'settings', 'sys-config', 'সিস্টেম সেটিংস, থিম, প্রবন্ধ ও যোগাযোগের তথ্য আপডেট করা হয়েছে।');
    this.notify();
    return { success: true };
  }

  public updateRolePermission(role: Role, permissionKey: keyof AdminPermissions, value: boolean): { success: boolean; error?: string } {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin' || this.currentUser.role !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন রোল পারমিশন পরিবর্তন করতে পারেন।' };
    }
    if (role === 'super_admin') {
      return { success: false, error: 'সুপার অ্যাডমিনের ক্ষমতা অপরিবর্তনযোগ্য।' };
    }
    const oldValue = this.rolePermissions[role]?.[permissionKey] ?? false;
    this.rolePermissions = {
      ...this.rolePermissions,
      [role]: {
        ...this.rolePermissions[role],
        [permissionKey]: value,
      },
    };
    this.save('rolePermissions', this.rolePermissions);

    const updatedUserPerms = { ...this.userPermissions };
    for (const acc of this.adminAccounts) {
      if (acc.role === role) {
        updatedUserPerms[acc.id] = {
          ...(updatedUserPerms[acc.id] || this.rolePermissions[role]),
          [permissionKey]: value,
        };
      }
    }
    this.userPermissions = updatedUserPerms;
    this.save('userPermissions', this.userPermissions);

    const logEntry: PermissionChangeLog = {
      id: generateUUID(),
      targetUserId: `role-${role}`,
      targetRole: role,
      changedByRole: this.currentUser.role,
      changedByName: this.currentUser.name,
      permissionKey,
      oldValue,
      newValue: value,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      reason: 'সুপার অ্যাডমিন ড্যাশবোর্ড থেকে পারমিশন পরিবর্তন করা হয়েছে।',
    };
    this.permissionChangeLogs = [logEntry, ...this.permissionChangeLogs];
    this.save('permissionChangeLogs', this.permissionChangeLogs);

    this.logAudit(
      'UPDATE_PERMISSION',
      'role',
      role,
      `রোল "${role}"-এর পারমিশন "${permissionKey}" -> ${value ? 'চালু' : 'বন্ধ'} করা হয়েছে। (পরিবর্তনকারী: ${this.currentUser.name})`
    );

    if (isSupabaseConfigured && supabase) {
      void this.syncRolePermissionToSupabase(role, permissionKey, oldValue, value);
    }

    this.notify();
    return { success: true };
  }

  public updateUserPermission(
    userId: string,
    role: Role,
    permissionKey: keyof AdminPermissions,
    value: boolean
  ): { success: boolean; error?: string } {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin' || this.currentUser.role !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন ব্যক্তিগত কর্মকর্তা পারমিশন পরিবর্তন করতে পারেন।' };
    }
    if (role === 'super_admin') {
      return { success: false, error: 'সুপার অ্যাডমিনের ক্ষমতা অপরিবর্তনযোগ্য।' };
    }

    const base = this.userPermissions[userId] || this.rolePermissions[role] || INITIAL_ROLE_PERMISSIONS[role];
    const oldValue = base[permissionKey] ?? false;
    const nextPerms: AdminPermissions = {
      ...base,
      [permissionKey]: value,
    };

    this.userPermissions = {
      ...this.userPermissions,
      [userId]: nextPerms,
    };
    this.save('userPermissions', this.userPermissions);

    const targetAccount = this.adminAccounts.find((a) => a.id === userId);
    const logEntry: PermissionChangeLog = {
      id: generateUUID(),
      targetUserId: userId,
      targetRole: role,
      changedByRole: this.currentUser.role,
      changedByName: this.currentUser.name,
      permissionKey,
      oldValue,
      newValue: value,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      reason: `${targetAccount?.fullName || userId}-এর ব্যক্তিগত পারমিশন পরিবর্তন করা হয়েছে।`,
    };
    this.permissionChangeLogs = [logEntry, ...this.permissionChangeLogs];
    this.save('permissionChangeLogs', this.permissionChangeLogs);

    if (isSupabaseConfigured && supabase && isValidUUID(userId)) {
      const sb = supabase;
      this.persistSupabase(
        `ব্যক্তিগত পারমিশন সংরক্ষণ (${targetAccount?.fullName || userId})`,
        sb.from('admin_permissions').upsert(
          {
            user_id: userId,
            ...nextPerms,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
      );
      if (isValidUUID(this.currentUser.id)) {
        void Promise.resolve(
          sb.from('permission_change_logs').insert({
            target_user_id: userId,
            target_role: role,
            changed_by: this.currentUser.id,
            permission_key: permissionKey,
            old_value: oldValue,
            new_value: value,
            reason: logEntry.reason,
          })
        ).catch(() => {
          // non-blocking
        });
      }
    }

    this.logAudit(
      'UPDATE_USER_PERMISSION',
      'user',
      userId,
      `কর্মকর্তা "${targetAccount?.fullName || userId}"-এর ব্যক্তিগত অনুমতি "${permissionKey}" -> ${value ? 'চালু' : 'বন্ধ'} করা হয়েছে।`
    );
    this.notify();
    return { success: true };
  }

  public resetUserPermissionsToRole(userId: string, role: Role): { success: boolean; error?: string } {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin' || this.currentUser.role !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন রোল প্রিসেট রিসেট করতে পারেন।' };
    }
    if (role === 'super_admin') {
      return { success: false, error: 'সুপার অ্যাডমিনের ক্ষমতা অপরিবর্তনযোগ্য।' };
    }
    const preset = { ...(this.rolePermissions[role] || INITIAL_ROLE_PERMISSIONS[role]) };
    this.userPermissions = {
      ...this.userPermissions,
      [userId]: preset,
    };
    this.save('userPermissions', this.userPermissions);

    if (isSupabaseConfigured && supabase && isValidUUID(userId)) {
      this.persistSupabase(
        'রোল অনুযায়ী পারমিশন রিসেট',
        supabase.from('admin_permissions').upsert(
          {
            user_id: userId,
            ...preset,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
      );
    }

    this.logAudit('RESET_USER_PERMISSION', 'user', userId, `কর্মকর্তার পারমিশন "${role}" রোলের মূল প্রিসেটে রিসেট করা হয়েছে।`);
    this.notify();
    return { success: true };
  }

  public async syncRolePermissionsBatchToSupabase(role: Role): Promise<{ success: boolean; count: number; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: true, count: 0 };
    }
    try {
      const { data: users, error: usersErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', role);

      if (usersErr) {
        return { success: false, count: 0, error: usersErr.message };
      }

      const perms = this.rolePermissions[role];
      if (!users || users.length === 0 || !perms) {
        return { success: true, count: 0 };
      }

      const rows = users.map((u: { id: string }) => ({
        user_id: u.id,
        ...perms,
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertErr } = await supabase
        .from('admin_permissions')
        .upsert(rows, { onConflict: 'user_id' });

      if (upsertErr) {
        return { success: false, count: 0, error: upsertErr.message };
      }

      const updatedUserPerms = { ...this.userPermissions };
      for (const u of users as { id: string }[]) {
        updatedUserPerms[u.id] = { ...perms };
      }
      this.userPermissions = updatedUserPerms;
      this.save('userPermissions', this.userPermissions);
      this.notify();

      return { success: true, count: rows.length };
    } catch (e: unknown) {
      return { success: false, count: 0, error: e instanceof Error ? e.message : 'Sync failed' };
    }
  }

  public async syncSingleUserPermissionsToSupabase(
    userId: string,
    role: Role,
    options?: { useRolePreset?: boolean }
  ): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const rolePreset = this.rolePermissions[role] || INITIAL_ROLE_PERMISSIONS[role];
    const perms = options?.useRolePreset
      ? { ...rolePreset }
      : this.userPermissions[userId] || rolePreset;
    if (!perms) return;
    if (options?.useRolePreset) {
      this.userPermissions = {
        ...this.userPermissions,
        [userId]: perms,
      };
      this.save('userPermissions', this.userPermissions);
      this.notify();
    }
    try {
      const { error } = await supabase
        .from('admin_permissions')
        .upsert(
          {
            user_id: userId,
            ...perms,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      if (error) {
        this.reportSyncError('ব্যক্তিগত পারমিশন সিঙ্ক', error);
      }
    } catch (err) {
      this.reportSyncError('ব্যক্তিগত পারমিশন সিঙ্ক', err);
    }
  }

  private async syncRolePermissionToSupabase(
    role: Role,
    permissionKey: keyof AdminPermissions,
    oldValue: boolean,
    newValue: boolean
  ) {
    if (!supabase) return;
    try {
      const { data: users } = await supabase.from('profiles').select('id').eq('role', role);
      if (!users || users.length === 0) return;

      const perms = this.rolePermissions[role];
      const rows = users.map((u: { id: string }) => ({
        user_id: u.id,
        ...perms,
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertErr } = await supabase.from('admin_permissions').upsert(rows, { onConflict: 'user_id' });
      if (upsertErr) {
        this.reportSyncError('পারমিশন সিঙ্ক', upsertErr);
      }

      const updatedUserPerms = { ...this.userPermissions };
      for (const u of users as { id: string }[]) {
        updatedUserPerms[u.id] = { ...perms };
      }
      this.userPermissions = updatedUserPerms;
      this.save('userPermissions', this.userPermissions);

      if (isValidUUID(this.currentUser.id)) {
        const logRows = users.map((u: { id: string }) => ({
          target_user_id: u.id,
          target_role: role,
          changed_by: this.currentUser.id,
          permission_key: permissionKey,
          old_value: oldValue,
          new_value: newValue,
          reason: 'সুপার অ্যাডমিন ড্যাশবোর্ড থেকে পারমিশন পরিবর্তন করা হয়েছে।',
        }));

        await supabase.from('permission_change_logs').insert(logRows);
      }
    } catch (err) {
      this.reportSyncError('পারমিশন সিঙ্ক', err);
    }
  }

  // --- ISOLATED DEMO SANDBOX & CLEAN PRODUCTION RESET ---
  public loadDemoSandboxData(): { success: boolean; error?: string } {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন ডেমো স্যান্ডবক্স মোড চালু করতে পারেন।' };
    }
    if (this.isSandboxDemoActive) {
      return { success: false, error: 'স্যান্ডবক্স ডেমো মোড ইতোমধ্যেই চালু রয়েছে।' };
    }

    // Snapshot current real data before entering sandbox
    this.save('realSnapshotBeforeDemo', {
      funds: this.funds,
      accounts: this.accounts,
      transactions: this.transactions,
      corrections: this.corrections,
      members: this.members,
      committees: this.committees,
      notices: this.notices,
      aidApplications: this.aidApplications,
      events: this.events,
      eventCategories: this.eventCategories,
      eventApplications: this.eventApplications,
      eventLedgerEntries: this.eventLedgerEntries,
      eventLogs: this.eventLogs,
    });

    this.funds = DEMO_SANDBOX_FUNDS.map((f) => ({ ...f }));
    this.accounts = DEMO_SANDBOX_ACCOUNTS.map((a) => ({ ...a }));
    this.transactions = DEMO_SANDBOX_TRANSACTIONS.map((t) => ({ ...t }));
    this.corrections = [];
    this.members = DEMO_SANDBOX_MEMBERS.map((m) => ({ ...m }));
    this.committees = DEMO_SANDBOX_COMMITTEES.map((c) => ({ ...c, positions: c.positions.map((p) => ({ ...p })) }));
    this.notices = DEMO_SANDBOX_NOTICES.map((n) => ({ ...n }));
    this.aidApplications = DEMO_SANDBOX_AID_APPLICATIONS.map((a) => ({ ...a }));
    this.isSandboxDemoActive = true;

    this.persistAllOperationalState();
    this.logAudit('ENABLE_DEMO_SANDBOX', 'system', 'sandbox', 'সুপার অ্যাডমিন টেস্ট স্যান্ডবক্স (ডেমো ডেটা) চালু করেছেন।');
    this.notify();
    return { success: true };
  }

  public exitDemoSandboxData(): { success: boolean; error?: string } {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন স্যান্ডবক্স বন্ধ করতে পারেন।' };
    }
    if (!this.isSandboxDemoActive) {
      return { success: false, error: 'বর্তমানে কোনো ডেমো স্যান্ডবক্স চালু নেই।' };
    }

    const snapshot = this.load<{
      funds?: FinancialFund[];
      accounts?: FinancialAccount[];
      transactions?: FinancialTransaction[];
      corrections?: FinancialCorrection[];
      members?: Member[];
      committees?: CommitteeTerm[];
      notices?: Notice[];
      aidApplications?: AidApplication[];
      events?: EventItem[];
      eventCategories?: EventFeeCategory[];
      eventApplications?: EventApplication[];
      eventLedgerEntries?: EventLedgerEntry[];
      eventLogs?: EventApplicationLog[];
    } | null>('realSnapshotBeforeDemo', null);

    this.funds = snapshot?.funds || INITIAL_FUNDS.map((f) => ({ ...f }));
    this.accounts = snapshot?.accounts || INITIAL_ACCOUNTS.map((a) => ({ ...a }));
    this.transactions = snapshot?.transactions || [];
    this.corrections = snapshot?.corrections || [];
    this.members = snapshot?.members || [];
    this.committees = snapshot?.committees || [];
    this.notices = snapshot?.notices || [];
    this.aidApplications = snapshot?.aidApplications || [];
    this.events = snapshot?.events || [];
    this.eventCategories = snapshot?.eventCategories || [];
    this.eventApplications = snapshot?.eventApplications || [];
    this.eventLedgerEntries = snapshot?.eventLedgerEntries || [];
    this.eventLogs = snapshot?.eventLogs || [];
    this.isSandboxDemoActive = false;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_PREFIX + 'realSnapshotBeforeDemo');
      }
    } catch {
      // ignore
    }

    this.persistAllOperationalState();
    this.logAudit('EXIT_DEMO_SANDBOX', 'system', 'sandbox', 'ডেমো স্যান্ডবক্স বন্ধ করে আসল প্রোডাকশন ডেটাবেজ পুনরুদ্ধার করা হয়েছে।');
    this.notify();
    return { success: true };
  }

  public resetToCleanProduction(): { success: boolean; error?: string } {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন ক্লিন রিসেট করতে পারেন।' };
    }

    const hasUuidFunds = isSupabaseConfigured && this.funds.some((f) => isValidUUID(f.id));
    const hasUuidAccounts = isSupabaseConfigured && this.accounts.some((a) => isValidUUID(a.id));

    this.funds = hasUuidFunds
      ? this.funds.map((f) => ({ ...f, currentBalance: 0 }))
      : INITIAL_FUNDS.map((f) => ({ ...f }));
    this.accounts = hasUuidAccounts
      ? this.accounts.map((a) => ({ ...a, currentBalance: 0 }))
      : INITIAL_ACCOUNTS.map((a) => ({ ...a }));
    this.transactions = [];
    this.corrections = [];
    this.members = [];
    this.committees = [];
    this.notices = [];
    this.aidApplications = [];
    this.events = [];
    this.eventCategories = [];
    this.eventApplications = [];
    this.eventLedgerEntries = [];
    this.eventLogs = [];
    this.isSandboxDemoActive = false;

    this.persistAllOperationalState();

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        'ক্লিন প্রোডাকশন ডাটাবেজ রিসেট',
        supabase.rpc('reset_clean_production_atomic')
      );
    }

    this.logAudit('RESET_CLEAN_PRODUCTION', 'system', 'core', 'সব ডেমো/পরীক্ষামূলক তথ্য মুছে ক্লিন প্রোডাকশন অবস্থা (৳০) পুনঃস্থাপন করা হয়েছে।');
    this.notify();
    return { success: true };
  }

  private persistAllOperationalState() {
    this.save('isSandboxDemoActive', this.isSandboxDemoActive);
    this.save('funds', this.funds);
    this.save('accounts', this.accounts);
    this.save('transactions', this.transactions);
    this.save('corrections', this.corrections);
    this.save('members', this.members);
    this.save('committees', this.committees);
    this.save('notices', this.notices);
    this.save('aidApplications', this.aidApplications);
    this.save('events', this.events);
    this.save('eventCategories', this.eventCategories);
    this.save('eventApplications', this.eventApplications);
    this.save('eventLedgerEntries', this.eventLedgerEntries);
    this.save('eventLogs', this.eventLogs);
  }

  // ====================================================================
  // EVENT & PARTICIPATION MANAGEMENT MODULE ("অনুষ্ঠান ও আয়োজন")
  // Dedicated Event Fund Ledger: Completely isolated from main association accounts!
  // ====================================================================

  private mapEventRow(e: Record<string, unknown>): EventItem {
    return {
      id: String(e.id),
      code: String(e.code || ''),
      title: String(e.title || ''),
      eventType: (e.event_type as EventItem['eventType']) || 'general',
      summary: String(e.summary || ''),
      description: String(e.description || ''),
      venue: String(e.venue || ''),
      eventDate: String(e.event_date || ''),
      registrationDeadline: e.registration_deadline ? String(e.registration_deadline) : undefined,
      status: (e.status as EventItem['status']) || 'upcoming',
      isPublished: Boolean(e.is_published),
      registrationOpen: Boolean(e.registration_open),
      allowPayLater: e.allow_pay_later !== undefined ? Boolean(e.allow_pay_later) : true,
      showParticipantCount: e.show_participant_count !== undefined ? Boolean(e.show_participant_count) : true,
      maxCapacity: e.max_capacity !== null && e.max_capacity !== undefined ? Number(e.max_capacity) : undefined,
      paymentInstructions: String(e.payment_instructions || ''),
      coverImageUrl: e.cover_image_url ? String(e.cover_image_url) : undefined,
      createdBy: e.created_by ? String(e.created_by) : undefined,
      createdAt: String(e.created_at || '').replace('T', ' ').substring(0, 19),
      updatedAt: e.updated_at ? String(e.updated_at).replace('T', ' ').substring(0, 19) : undefined,
    };
  }

  private mapEventCategoryRow(c: Record<string, unknown>): EventFeeCategory {
    return {
      id: String(c.id),
      eventId: String(c.event_id),
      titleBn: String(c.title_bn || ''),
      descriptionBn: String(c.description_bn || ''),
      feeAmount: roundBDT(Number(c.fee_amount || 0)),
      maxQtyPerApplication: Number(c.max_qty_per_application || 20),
      priority: Number(c.priority || 1),
      isActive: c.is_active !== undefined ? Boolean(c.is_active) : true,
    };
  }

  private mapEventAppRow(a: Record<string, unknown>): EventApplication {
    return {
      id: String(a.id),
      eventId: String(a.event_id),
      registrationCode: String(a.registration_code || ''),
      applicantNameBn: String(a.applicant_name_bn || ''),
      applicantNameEn: a.applicant_name_en ? String(a.applicant_name_en) : undefined,
      phone: String(a.phone || ''),
      email: a.email ? String(a.email) : undefined,
      organizationOrAddress: String(a.organization_or_address || ''),
      membershipIdRef: a.membership_id_ref ? String(a.membership_id_ref) : undefined,
      categoryBreakdown: Array.isArray(a.category_breakdown)
        ? (a.category_breakdown as EventCategoryBreakdownItem[])
        : [],
      totalParticipants: Number(a.total_participants || 1),
      totalFee: roundBDT(Number(a.total_fee || 0)),
      applicationStatus: (a.application_status as EventApplicationStatus) || 'pending',
      paymentStatus: (a.payment_status as EventApplication['paymentStatus']) || 'unpaid',
      paymentMethod: a.payment_method ? (String(a.payment_method) as EventPaymentMethod) : undefined,
      transactionId: a.transaction_id ? String(a.transaction_id) : undefined,
      paidAmount: roundBDT(Number(a.paid_amount || 0)),
      refundAmount: roundBDT(Number(a.refund_amount || 0)),
      paymentNote: a.payment_note ? String(a.payment_note) : undefined,
      refundReason: a.refund_reason ? String(a.refund_reason) : undefined,
      notes: a.notes ? String(a.notes) : undefined,
      isSpotEntry: Boolean(a.is_spot_entry),
      reviewedByName: a.reviewed_by_name ? String(a.reviewed_by_name) : undefined,
      reviewedAt: a.reviewed_at ? String(a.reviewed_at).replace('T', ' ').substring(0, 19) : undefined,
      verifiedByName: a.verified_by_name ? String(a.verified_by_name) : undefined,
      verifiedAt: a.verified_at ? String(a.verified_at).replace('T', ' ').substring(0, 19) : undefined,
      refundedByName: a.refunded_by_name ? String(a.refunded_by_name) : undefined,
      refundedAt: a.refunded_at ? String(a.refunded_at).replace('T', ' ').substring(0, 19) : undefined,
      createdAt: String(a.created_at || '').replace('T', ' ').substring(0, 19),
      updatedAt: a.updated_at ? String(a.updated_at).replace('T', ' ').substring(0, 19) : undefined,
    };
  }

  private mapEventLedgerRow(l: Record<string, unknown>): EventLedgerEntry {
    return {
      id: String(l.id),
      eventId: String(l.event_id),
      entryCode: String(l.entry_code || ''),
      entryType: (l.entry_type as EventLedgerEntryType) || 'donation',
      title: String(l.title || ''),
      category: String(l.category || ''),
      partyName: String(l.party_name || ''),
      paymentMethod: (l.payment_method as EventPaymentMethod) || 'cash',
      referenceNo: l.reference_no ? String(l.reference_no) : undefined,
      amount: roundBDT(Number(l.amount || 0)),
      notes: l.notes ? String(l.notes) : undefined,
      entryDate: String(l.entry_date || '').substring(0, 10),
      createdByName: String(l.created_by_name || ''),
      createdAt: String(l.created_at || '').replace('T', ' ').substring(0, 19),
    };
  }

  private appendEventLog(
    eventId: string,
    action: string,
    description: string,
    applicationId?: string,
    metadata?: Record<string, unknown>
  ) {
    const nowISO = new Date().toISOString();
    const logItem: EventApplicationLog = {
      id: generateUUID(),
      eventId,
      applicationId,
      action,
      actorRole: this.isAuthenticated ? this.authenticatedRole : this.currentUser.role,
      actorName: this.currentUser.name,
      description,
      metadata,
      createdAt: nowISO.replace('T', ' ').substring(0, 19),
    };
    this.eventLogs = [logItem, ...this.eventLogs];
    this.save('eventLogs', this.eventLogs);

    if (this.canPersistToSupabase() && supabase && this.isAuthenticated) {
      void Promise.resolve(
        supabase.from('event_application_logs').insert({
          id: logItem.id,
          event_id: eventId,
          application_id: applicationId || null,
          action,
          actor_id: isValidUUID(this.currentUser.id) ? this.currentUser.id : null,
          actor_role: logItem.actorRole,
          actor_name: logItem.actorName,
          description,
          metadata: metadata || null,
        })
      ).catch(() => {
        // non-blocking
      });
    }
  }

  public addEvent(
    params: Omit<EventItem, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'createdBy'> & { code?: string }
  ): { success: boolean; event?: EventItem; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || (!perms.can_event_create && this.currentUser.role !== 'super_admin')) {
      return { success: false, error: 'নতুন অনুষ্ঠান তৈরি করার অনুমতি আপনার নেই।' };
    }
    if (!params.title.trim()) {
      return { success: false, error: 'অনুষ্ঠানের শিরোনাম দেওয়া বাধ্যতামূলক।' };
    }
    const year = new Date().getFullYear();
    const cleanCode =
      params.code?.trim() ||
      nextSequentialCode(
        'EVT',
        year,
        this.events.map((e) => e.code),
        3
      );
    const nowISO = new Date().toISOString();
    const newEvent: EventItem = {
      ...params,
      id: generateUUID(),
      code: cleanCode,
      title: params.title.trim(),
      summary: params.summary.trim(),
      description: params.description.trim(),
      venue: params.venue.trim(),
      paymentInstructions: params.paymentInstructions.trim(),
      createdBy: this.currentUser.name,
      createdAt: nowISO.replace('T', ' ').substring(0, 19),
    };
    this.events = [newEvent, ...this.events];
    this.save('events', this.events);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `অনুষ্ঠান তৈরি (${newEvent.code})`,
        supabase.from('events').insert({
          id: newEvent.id,
          code: newEvent.code,
          title: newEvent.title,
          event_type: newEvent.eventType,
          summary: newEvent.summary,
          description: newEvent.description,
          venue: newEvent.venue,
          event_date: toIsoTimestamp(newEvent.eventDate),
          registration_deadline: newEvent.registrationDeadline ? toIsoTimestamp(newEvent.registrationDeadline) : null,
          status: newEvent.status,
          is_published: newEvent.isPublished,
          registration_open: newEvent.registrationOpen,
          allow_pay_later: newEvent.allowPayLater,
          show_participant_count: newEvent.showParticipantCount,
          max_capacity: newEvent.maxCapacity || null,
          payment_instructions: newEvent.paymentInstructions,
          cover_image_url: newEvent.coverImageUrl || null,
          created_by: isValidUUID(this.currentUser.id) ? this.currentUser.id : null,
        })
      );
    }

    this.appendEventLog(newEvent.id, 'CREATE_EVENT', `নতুন অনুষ্ঠান "${newEvent.title}" (${newEvent.code}) তৈরি হয়েছে।`);
    this.logAudit('CREATE_EVENT', 'event', newEvent.id, `নতুন অনুষ্ঠান "${newEvent.title}" (${newEvent.code}) তৈরি হয়েছে।`);
    this.notify();
    return { success: true, event: newEvent };
  }

  public updateEvent(
    eventId: string,
    updates: Partial<Omit<EventItem, 'id' | 'code' | 'createdAt'>>
  ): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (
      !this.isAuthenticated ||
      (!perms.can_event_edit && !perms.can_event_manage_settings && this.currentUser.role !== 'super_admin')
    ) {
      return { success: false, error: 'অনুষ্ঠানের তথ্য সম্পাদনার অনুমতি আপনার নেই।' };
    }
    const existing = this.events.find((e) => e.id === eventId);
    if (!existing) return { success: false, error: 'অনুষ্ঠান খুঁজে পাওয়া যায়নি।' };

    const nowISO = new Date().toISOString();
    const updated: EventItem = {
      ...existing,
      ...updates,
      updatedAt: nowISO.replace('T', ' ').substring(0, 19),
    };
    this.events = this.events.map((e) => (e.id === eventId ? updated : e));
    this.save('events', this.events);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `অনুষ্ঠান হালনাগাদ (${existing.code})`,
        supabase
          .from('events')
          .update({
            title: updated.title,
            event_type: updated.eventType,
            summary: updated.summary,
            description: updated.description,
            venue: updated.venue,
            event_date: toIsoTimestamp(updated.eventDate),
            registration_deadline: updated.registrationDeadline ? toIsoTimestamp(updated.registrationDeadline) : null,
            status: updated.status,
            is_published: updated.isPublished,
            registration_open: updated.registrationOpen,
            allow_pay_later: updated.allowPayLater,
            show_participant_count: updated.showParticipantCount,
            max_capacity: updated.maxCapacity || null,
            payment_instructions: updated.paymentInstructions,
            cover_image_url: updated.coverImageUrl || null,
            updated_at: nowISO,
          })
          .eq('id', eventId)
      );
    }

    this.appendEventLog(eventId, 'UPDATE_EVENT', `অনুষ্ঠান "${updated.title}"-এর তথ্য হালনাগাদ করা হয়েছে।`);
    this.logAudit('UPDATE_EVENT', 'event', eventId, `অনুষ্ঠান "${updated.title}" আপডেট হয়েছে।`);
    this.notify();
    return { success: true };
  }

  public deleteEvent(eventId: string): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || (!perms.can_event_delete_test_data && this.currentUser.role !== 'super_admin')) {
      return { success: false, error: 'অনুষ্ঠান মুছে ফেলার অনুমতি আপনার নেই।' };
    }
    const existing = this.events.find((e) => e.id === eventId);
    if (!existing) return { success: false, error: 'অনুষ্ঠান খুঁজে পাওয়া যায়নি।' };

    const hasApps = this.eventApplications.some(
      (a) => a.eventId === eventId && a.paymentStatus === 'verified'
    );
    if (hasApps && existing.status !== 'draft') {
      return {
        success: false,
        error: 'যাচাইকৃত পেমেন্টযুক্ত সক্রিয় অনুষ্ঠান সরাসরি মুছে ফেলা যাবে না; অনুগ্রহ করে আর্কাইভ বা বাতিল করুন।',
      };
    }

    this.events = this.events.filter((e) => e.id !== eventId);
    this.eventCategories = this.eventCategories.filter((c) => c.eventId !== eventId);
    this.eventApplications = this.eventApplications.filter((a) => a.eventId !== eventId);
    this.eventLedgerEntries = this.eventLedgerEntries.filter((l) => l.eventId !== eventId);
    this.save('events', this.events);
    this.save('eventCategories', this.eventCategories);
    this.save('eventApplications', this.eventApplications);
    this.save('eventLedgerEntries', this.eventLedgerEntries);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(`অনুষ্ঠান মোছা (${existing.code})`, supabase.from('events').delete().eq('id', eventId));
    }

    this.logAudit('DELETE_EVENT', 'event', eventId, `অনুষ্ঠান "${existing.title}" (${existing.code}) মুছে ফেলা হয়েছে।`);
    this.notify();
    return { success: true };
  }

  public addEventCategory(
    params: Omit<EventFeeCategory, 'id'>
  ): { success: boolean; category?: EventFeeCategory; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || (!perms.can_event_manage_categories && this.currentUser.role !== 'super_admin')) {
      return { success: false, error: 'অংশগ্রহণের ধরন ও ফি নির্ধারণের অনুমতি নেই।' };
    }
    if (!params.titleBn.trim()) {
      return { success: false, error: 'ক্যাটাগরির নাম লিখুন।' };
    }
    if (!Number.isFinite(params.feeAmount) || params.feeAmount < 0) {
      return { success: false, error: 'ফি ০ বা তার বেশি হতে হবে (ফ্রি হলে ০ দিন)।' };
    }

    const newCat: EventFeeCategory = {
      ...params,
      id: generateUUID(),
      titleBn: params.titleBn.trim(),
      descriptionBn: params.descriptionBn.trim(),
      feeAmount: roundBDT(params.feeAmount),
      maxQtyPerApplication: Math.max(1, Math.floor(params.maxQtyPerApplication || 20)),
    };
    this.eventCategories = [...this.eventCategories, newCat].sort((a, b) => a.priority - b.priority);
    this.save('eventCategories', this.eventCategories);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `ইভেন্ট ক্যাটাগরি যুক্ত (${newCat.titleBn})`,
        supabase.from('event_fee_categories').insert({
          id: newCat.id,
          event_id: newCat.eventId,
          title_bn: newCat.titleBn,
          description_bn: newCat.descriptionBn,
          fee_amount: newCat.feeAmount,
          max_qty_per_application: newCat.maxQtyPerApplication,
          priority: newCat.priority,
          is_active: newCat.isActive,
        })
      );
    }

    this.appendEventLog(
      newCat.eventId,
      'ADD_EVENT_CATEGORY',
      `অংশগ্রহণের ধরন "${newCat.titleBn}" (ফি: ৳${newCat.feeAmount}) যুক্ত করা হয়েছে।`
    );
    this.notify();
    return { success: true, category: newCat };
  }

  public updateEventCategory(
    categoryId: string,
    updates: Partial<Omit<EventFeeCategory, 'id' | 'eventId'>>
  ): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || (!perms.can_event_manage_categories && this.currentUser.role !== 'super_admin')) {
      return { success: false, error: 'ক্যাটাগরি সম্পাদনার অনুমতি নেই।' };
    }
    const existing = this.eventCategories.find((c) => c.id === categoryId);
    if (!existing) return { success: false, error: 'ক্যাটাগরি খুঁজে পাওয়া যায়নি।' };
    if (updates.feeAmount !== undefined && (!Number.isFinite(updates.feeAmount) || updates.feeAmount < 0)) {
      return { success: false, error: 'ফি ০ বা তার বেশি হতে হবে।' };
    }

    const updated: EventFeeCategory = {
      ...existing,
      ...updates,
      feeAmount: updates.feeAmount !== undefined ? roundBDT(updates.feeAmount) : existing.feeAmount,
    };
    this.eventCategories = this.eventCategories
      .map((c) => (c.id === categoryId ? updated : c))
      .sort((a, b) => a.priority - b.priority);
    this.save('eventCategories', this.eventCategories);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `ইভেন্ট ক্যাটাগরি আপডেট (${updated.titleBn})`,
        supabase
          .from('event_fee_categories')
          .update({
            title_bn: updated.titleBn,
            description_bn: updated.descriptionBn,
            fee_amount: updated.feeAmount,
            max_qty_per_application: updated.maxQtyPerApplication,
            priority: updated.priority,
            is_active: updated.isActive,
          })
          .eq('id', categoryId)
      );
    }

    this.appendEventLog(
      existing.eventId,
      'UPDATE_EVENT_CATEGORY',
      `ক্যাটাগরি "${updated.titleBn}" হালনাগাদ হয়েছে (নতুন ফি: ৳${updated.feeAmount}; পূর্বের আবেদনের ফ্রোজেন ফি অপরিবর্তিত)।`
    );
    this.notify();
    return { success: true };
  }

  public deleteEventCategory(categoryId: string): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || (!perms.can_event_manage_categories && this.currentUser.role !== 'super_admin')) {
      return { success: false, error: 'ক্যাটাগরি মুছে ফেলার অনুমতি নেই।' };
    }
    const existing = this.eventCategories.find((c) => c.id === categoryId);
    if (!existing) return { success: false, error: 'ক্যাটাগরি পাওয়া যায়নি।' };

    this.eventCategories = this.eventCategories.filter((c) => c.id !== categoryId);
    this.save('eventCategories', this.eventCategories);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `ইভেন্ট ক্যাটাগরি মোছা (${existing.titleBn})`,
        supabase.from('event_fee_categories').delete().eq('id', categoryId)
      );
    }

    this.appendEventLog(existing.eventId, 'DELETE_EVENT_CATEGORY', `ক্যাটাগরি "${existing.titleBn}" মুছে ফেলা হয়েছে।`);
    this.notify();
    return { success: true };
  }

  public isEventTransactionIdDuplicate(eventId: string, transactionId: string, excludeAppId?: string): boolean {
    const clean = transactionId.trim().toLowerCase();
    if (!clean) return false;
    return this.eventApplications.some(
      (a) =>
        a.eventId === eventId &&
        a.id !== excludeAppId &&
        a.applicationStatus !== 'rejected' &&
        Boolean(a.transactionId) &&
        String(a.transactionId).trim().toLowerCase() === clean
    );
  }

  public async submitPublicEventApplication(params: {
    eventId: string;
    applicantNameBn: string;
    phone: string;
    email?: string;
    organizationOrAddress?: string;
    membershipIdRef?: string;
    quantities: { categoryId: string; quantity: number }[];
    paymentChoice?: 'pay_later' | 'pay_now';
    paymentMethod?: EventPaymentMethod;
    transactionId?: string;
    notes?: string;
  }): Promise<{
    success: boolean;
    registrationCode?: string;
    application?: EventApplication;
    error?: string;
  }> {
    const event = this.events.find((e) => e.id === params.eventId);
    if (!event) {
      return { success: false, error: 'অনুষ্ঠানটি খুঁজে পাওয়া যায়নি।' };
    }
    if (!event.isPublished || !event.registrationOpen || !['upcoming', 'ongoing'].includes(event.status)) {
      return { success: false, error: 'এই অনুষ্ঠানের নিবন্ধন বর্তমানে বন্ধ রয়েছে।' };
    }
    if (event.registrationDeadline && new Date(event.registrationDeadline).getTime() < Date.now()) {
      return { success: false, error: 'এই অনুষ্ঠানের নিবন্ধনের সময়সীমা শেষ হয়ে গেছে।' };
    }
    if (!params.applicantNameBn.trim() || !params.phone.trim()) {
      return { success: false, error: 'আবেদনকারীর নাম এবং মোবাইল নম্বর দেওয়া বাধ্যতামূলক।' };
    }

    // Build frozen category breakdown snapshot & calculate fees cleanly
    const breakdown: EventCategoryBreakdownItem[] = [];
    let totalParticipants = 0;
    let totalFee = 0;

    for (const qItem of params.quantities) {
      const qty = Math.floor(Number(qItem.quantity || 0));
      if (qty <= 0) continue;
      const cat = this.eventCategories.find(
        (c) => c.id === qItem.categoryId && c.eventId === params.eventId && c.isActive
      );
      if (!cat) {
        return { success: false, error: 'নির্বাচিত অংশগ্রহণের ক্যাটাগরি সক্রিয় নয়।' };
      }
      if (qty > cat.maxQtyPerApplication) {
        return {
          success: false,
          error: `একটি আবেদনে "${cat.titleBn}" ক্যাটাগরিতে সর্বোচ্চ ${cat.maxQtyPerApplication} জন নির্বাচন করা যাবে।`,
        };
      }
      const lineTotal = roundBDT(cat.feeAmount * qty);
      totalParticipants += qty;
      totalFee = roundBDT(totalFee + lineTotal);
      breakdown.push({
        categoryId: cat.id,
        titleBn: cat.titleBn,
        unitFee: cat.feeAmount,
        quantity: qty,
        lineTotal,
      });
    }

    if (totalParticipants < 1) {
      return { success: false, error: 'অন্তত ১ জন অংশগ্রহণকারীর সংখ্যা নির্বাচন করুন।' };
    }

    if (event.maxCapacity && event.maxCapacity > 0) {
      const currentHeadcount = this.publicEventCounts[params.eventId]?.totalParticipants ??
        this.eventApplications
          .filter((a) => a.eventId === params.eventId && (a.applicationStatus === 'pending' || a.applicationStatus === 'approved'))
          .reduce((s, a) => s + a.totalParticipants, 0);
      if (currentHeadcount + totalParticipants > event.maxCapacity) {
        const remaining = Math.max(0, event.maxCapacity - currentHeadcount);
        return {
          success: false,
          error: `দুঃখিত! এই অনুষ্ঠানের সর্বোচ্চ আসন সংখ্যা (${event.maxCapacity} জন) পূর্ণ হয়ে গেছে (বাকি আসন: ${remaining} জন)।`,
        };
      }
    }

    const cleanTxn = (params.transactionId || '').trim();
    const hasPaymentInfo = params.paymentChoice === 'pay_now' || Boolean(cleanTxn) || Boolean(params.paymentMethod);

    if (totalFee > 0 && !hasPaymentInfo && !event.allowPayLater) {
      return { success: false, error: 'এই অনুষ্ঠানে নিবন্ধনের সাথে পেমেন্ট তথ্য দেওয়া বাধ্যতামূলক।' };
    }

    if (totalFee > 0 && cleanTxn && this.isEventTransactionIdDuplicate(params.eventId, cleanTxn)) {
      return {
        success: false,
        error: `এই ট্রানজেকশন আইডি / রসিদ নম্বর (${cleanTxn}) ইতোমধ্যে এই অনুষ্ঠানে ব্যবহৃত হয়েছে।`,
      };
    }

    const paymentStatus: EventApplication['paymentStatus'] =
      totalFee === 0 ? 'exempt' : hasPaymentInfo ? 'submitted' : 'unpaid';

    if (isSupabaseConfigured && supabase) {
      try {
        const rpcRes = await supabase.rpc('submit_public_event_application', {
          p_event_id: params.eventId,
          p_applicant_name_bn: params.applicantNameBn.trim(),
          p_phone: params.phone.trim(),
          p_email: params.email?.trim() || null,
          p_organization_or_address: params.organizationOrAddress?.trim() || '',
          p_membership_id_ref: params.membershipIdRef?.trim() || null,
          p_quantities: params.quantities
            .filter((q) => q.quantity > 0)
            .map((q) => ({ category_id: q.categoryId, quantity: Math.floor(q.quantity) })),
          p_payment_method: totalFee > 0 && hasPaymentInfo ? params.paymentMethod || 'cash' : null,
          p_transaction_id: totalFee > 0 && hasPaymentInfo ? cleanTxn || null : null,
          p_notes: params.notes?.trim() || null,
        });

        if (rpcRes.error) {
          return { success: false, error: rpcRes.error.message || 'নিবন্ধন জমা দেওয়া যায়নি।' };
        }

        const row = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data;
        const regCode = String(row?.registration_code || '');
        const appObj: EventApplication = {
          id: String(row?.id || generateUUID()),
          eventId: params.eventId,
          registrationCode: regCode,
          applicantNameBn: params.applicantNameBn.trim(),
          phone: params.phone.trim(),
          email: params.email?.trim() || undefined,
          organizationOrAddress: params.organizationOrAddress?.trim() || '',
          membershipIdRef: params.membershipIdRef?.trim() || undefined,
          categoryBreakdown: breakdown,
          totalParticipants: Number(row?.total_participants || totalParticipants),
          totalFee: roundBDT(Number(row?.total_fee ?? totalFee)),
          applicationStatus: 'pending',
          paymentStatus: (row?.payment_status as EventApplication['paymentStatus']) || paymentStatus,
          paymentMethod: totalFee > 0 && hasPaymentInfo ? params.paymentMethod || 'cash' : undefined,
          transactionId: totalFee > 0 && hasPaymentInfo && cleanTxn ? cleanTxn : undefined,
          paidAmount: paymentStatus === 'submitted' ? roundBDT(Number(row?.total_fee ?? totalFee)) : 0,
          refundAmount: 0,
          notes: params.notes?.trim() || undefined,
          isSpotEntry: false,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        };
        if (this.isAuthenticated) {
          this.eventApplications = [appObj, ...this.eventApplications];
          this.save('eventApplications', this.eventApplications);
        }
        const curCount = this.publicEventCounts[params.eventId] || { totalParticipants: 0, approvedParticipants: 0 };
        this.publicEventCounts = {
          ...this.publicEventCounts,
          [params.eventId]: {
            ...curCount,
            totalParticipants: curCount.totalParticipants + appObj.totalParticipants,
          },
        };
        this.notify();
        return { success: true, registrationCode: regCode, application: appObj };
      } catch (e: unknown) {
        return { success: false, error: e instanceof Error ? e.message : 'সার্ভার সংযোগ ত্রুটি' };
      }
    }

    const year = new Date().getFullYear();
    let regCode = `EVT-${year}-${Math.floor(100000 + Math.random() * 899999)}`;
    while (this.eventApplications.some((a) => a.registrationCode === regCode)) {
      regCode = `EVT-${year}-${Math.floor(100000 + Math.random() * 899999)}`;
    }
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const newApp: EventApplication = {
      id: generateUUID(),
      eventId: params.eventId,
      registrationCode: regCode,
      applicantNameBn: params.applicantNameBn.trim(),
      phone: params.phone.trim(),
      email: params.email?.trim() || undefined,
      organizationOrAddress: params.organizationOrAddress?.trim() || '',
      membershipIdRef: params.membershipIdRef?.trim() || undefined,
      categoryBreakdown: breakdown,
      totalParticipants,
      totalFee,
      applicationStatus: 'pending',
      paymentStatus,
      paymentMethod: totalFee > 0 && hasPaymentInfo ? params.paymentMethod || 'cash' : undefined,
      transactionId: totalFee > 0 && hasPaymentInfo && cleanTxn ? cleanTxn : undefined,
      paidAmount: paymentStatus === 'submitted' ? totalFee : 0,
      refundAmount: 0,
      notes: params.notes?.trim() || undefined,
      isSpotEntry: false,
      createdAt: nowStr,
    };

    this.eventApplications = [newApp, ...this.eventApplications];
    this.save('eventApplications', this.eventApplications);
    this.appendEventLog(
      params.eventId,
      'PUBLIC_EVENT_REGISTER',
      `নতুন অংশগ্রহণ নিবন্ধন ${regCode}: ${newApp.applicantNameBn} (${totalParticipants} জন, প্রদেয় ৳${totalFee}, পেমেন্ট: ${paymentStatus})।`,
      newApp.id
    );
    this.notify();
    return { success: true, registrationCode: regCode, application: newApp };
  }

  public addSpotEventApplication(params: {
    eventId: string;
    applicantNameBn: string;
    phone: string;
    organizationOrAddress?: string;
    membershipIdRef?: string;
    quantities: { categoryId: string; quantity: number }[];
    paymentStatus: 'unpaid' | 'verified' | 'exempt';
    paymentMethod?: EventPaymentMethod;
    transactionId?: string;
    paidAmount?: number;
    autoApproveApplication?: boolean;
    notes?: string;
  }): { success: boolean; application?: EventApplication; error?: string } {
    const perms = this.getEffectivePermissions();
    if (
      !this.isAuthenticated ||
      (!perms.can_event_approve_application &&
        !perms.can_event_verify_payment &&
        this.currentUser.role !== 'super_admin')
    ) {
      return { success: false, error: 'স্পট / ওয়াক-ইন নিবন্ধন যুক্ত করার অনুমতি আপনার নেই।' };
    }
    const event = this.events.find((e) => e.id === params.eventId);
    if (!event) return { success: false, error: 'অনুষ্ঠান খুঁজে পাওয়া যায়নি।' };
    if (!params.applicantNameBn.trim() || !params.phone.trim()) {
      return { success: false, error: 'অংশগ্রহণকারীর নাম ও মোবাইল নম্বর দিন।' };
    }

    const breakdown: EventCategoryBreakdownItem[] = [];
    let totalParticipants = 0;
    let totalFee = 0;
    for (const qItem of params.quantities) {
      const qty = Math.floor(Number(qItem.quantity || 0));
      if (qty <= 0) continue;
      const cat = this.eventCategories.find((c) => c.id === qItem.categoryId && c.eventId === params.eventId);
      if (!cat) continue;
      const lineTotal = roundBDT(cat.feeAmount * qty);
      totalParticipants += qty;
      totalFee = roundBDT(totalFee + lineTotal);
      breakdown.push({
        categoryId: cat.id,
        titleBn: cat.titleBn,
        unitFee: cat.feeAmount,
        quantity: qty,
        lineTotal,
      });
    }
    if (totalParticipants < 1) {
      return { success: false, error: 'অন্তত ১ জন অংশগ্রহণকারীর সংখ্যা দিন।' };
    }

    if (event.maxCapacity && event.maxCapacity > 0) {
      const currentHeadcount = this.eventApplications
        .filter((a) => a.eventId === params.eventId && (a.applicationStatus === 'pending' || a.applicationStatus === 'approved'))
        .reduce((s, a) => s + a.totalParticipants, 0);
      if (currentHeadcount + totalParticipants > event.maxCapacity) {
        const remaining = Math.max(0, event.maxCapacity - currentHeadcount);
        return {
          success: false,
          error: `এই অনুষ্ঠানের সর্বোচ্চ ধারণক্ষমতা (${event.maxCapacity} জন) অতিক্রম করা যাবে না (বাকি আসন: ${remaining} জন)।`,
        };
      }
    }

    const cleanTxn = (params.transactionId || '').trim();
    if (cleanTxn && this.isEventTransactionIdDuplicate(params.eventId, cleanTxn)) {
      return { success: false, error: `ট্রানজেকশন/রসিদ নম্বর "${cleanTxn}" ইতোমধ্যে ব্যবহৃত হয়েছে।` };
    }

    const year = new Date().getFullYear();
    let regCode = `SPOT-${year}-${Math.floor(100000 + Math.random() * 899999)}`;
    while (this.eventApplications.some((a) => a.registrationCode === regCode)) {
      regCode = `SPOT-${year}-${Math.floor(100000 + Math.random() * 899999)}`;
    }
    const nowISO = new Date().toISOString();
    const nowStr = nowISO.replace('T', ' ').substring(0, 19);
    const resolvedPayStatus: EventApplication['paymentStatus'] =
      totalFee === 0 ? 'exempt' : params.paymentStatus === 'verified' ? 'verified' : 'unpaid';
    const resolvedPaid =
      resolvedPayStatus === 'verified' ? roundBDT(params.paidAmount ?? totalFee) : 0;
    const isApproved = Boolean(params.autoApproveApplication ?? true);

    const spotApp: EventApplication = {
      id: generateUUID(),
      eventId: params.eventId,
      registrationCode: regCode,
      applicantNameBn: params.applicantNameBn.trim(),
      phone: params.phone.trim(),
      organizationOrAddress: params.organizationOrAddress?.trim() || '',
      membershipIdRef: params.membershipIdRef?.trim() || undefined,
      categoryBreakdown: breakdown,
      totalParticipants,
      totalFee,
      applicationStatus: isApproved ? 'approved' : 'pending',
      paymentStatus: resolvedPayStatus,
      paymentMethod: resolvedPayStatus === 'verified' ? params.paymentMethod || 'cash' : undefined,
      transactionId: cleanTxn || undefined,
      paidAmount: resolvedPaid,
      refundAmount: 0,
      notes: params.notes?.trim() || undefined,
      isSpotEntry: true,
      reviewedByName: isApproved ? this.currentUser.name : undefined,
      reviewedAt: isApproved ? nowStr : undefined,
      verifiedByName: resolvedPayStatus === 'verified' ? this.currentUser.name : undefined,
      verifiedAt: resolvedPayStatus === 'verified' ? nowStr : undefined,
      createdAt: nowStr,
    };

    this.eventApplications = [spotApp, ...this.eventApplications];
    this.save('eventApplications', this.eventApplications);

    if (this.canPersistToSupabase() && supabase) {
      const actorId = isValidUUID(this.currentUser.id) ? this.currentUser.id : null;
      this.persistSupabase(
        `স্পট নিবন্ধন (${regCode})`,
        supabase.from('event_applications').insert({
          id: spotApp.id,
          event_id: spotApp.eventId,
          registration_code: spotApp.registrationCode,
          applicant_name_bn: spotApp.applicantNameBn,
          phone: spotApp.phone,
          organization_or_address: spotApp.organizationOrAddress,
          membership_id_ref: spotApp.membershipIdRef || null,
          category_breakdown: spotApp.categoryBreakdown,
          total_participants: spotApp.totalParticipants,
          total_fee: spotApp.totalFee,
          application_status: spotApp.applicationStatus,
          payment_status: spotApp.paymentStatus,
          payment_method: spotApp.paymentMethod || null,
          transaction_id: spotApp.transactionId || null,
          paid_amount: spotApp.paidAmount,
          refund_amount: 0,
          notes: spotApp.notes || null,
          is_spot_entry: true,
          reviewed_by: isApproved ? actorId : null,
          reviewed_by_name: spotApp.reviewedByName || null,
          reviewed_at: isApproved ? nowISO : null,
          verified_by: resolvedPayStatus === 'verified' ? actorId : null,
          verified_by_name: spotApp.verifiedByName || null,
          verified_at: resolvedPayStatus === 'verified' ? nowISO : null,
        })
      );
    }

    this.appendEventLog(
      params.eventId,
      'SPOT_REGISTRATION',
      `অ্যাডমিন স্পট নিবন্ধন ${regCode}: ${spotApp.applicantNameBn} (${totalParticipants} জন, পেমেন্ট: ${resolvedPayStatus}, আদায়: ৳${resolvedPaid})।`,
      spotApp.id
    );
    this.notify();
    return { success: true, application: spotApp };
  }

  public async lookupPublicEventRegistration(
    registrationCode: string,
    phone: string
  ): Promise<{
    found: boolean;
    result?: {
      registrationCode: string;
      eventTitle: string;
      applicantNameBn: string;
      totalParticipants: number;
      totalFee: number;
      applicationStatus: EventApplicationStatus;
      paymentStatus: EventApplication['paymentStatus'];
      createdAt: string;
    };
  }> {
    const cleanCode = registrationCode.trim().toLowerCase();
    const cleanDigits = phone.replace(/[^0-9]/g, '');
    if (!cleanCode || !cleanDigits) return { found: false };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('lookup_event_registration_status', {
          p_registration_code: registrationCode.trim(),
          p_phone: phone.trim(),
        });
        if (!error && Array.isArray(data) && data.length > 0) {
          const row = data[0] as Record<string, unknown>;
          return {
            found: true,
            result: {
              registrationCode: String(row.registration_code),
              eventTitle: String(row.event_title),
              applicantNameBn: String(row.applicant_name_bn),
              totalParticipants: Number(row.total_participants),
              totalFee: roundBDT(Number(row.total_fee)),
              applicationStatus: row.application_status as EventApplicationStatus,
              paymentStatus: row.payment_status as EventApplication['paymentStatus'],
              createdAt: String(row.created_at || '').replace('T', ' ').substring(0, 19),
            },
          };
        }
        return { found: false };
      } catch {
        // fallback to local cache if rpc unavailable
      }
    }

    const match = this.eventApplications.find(
      (a) =>
        a.registrationCode.trim().toLowerCase() === cleanCode &&
        a.phone.replace(/[^0-9]/g, '') === cleanDigits
    );
    if (!match) return { found: false };
    const ev = this.events.find((e) => e.id === match.eventId);
    return {
      found: true,
      result: {
        registrationCode: match.registrationCode,
        eventTitle: ev?.title || 'অনুষ্ঠান',
        applicantNameBn: match.applicantNameBn,
        totalParticipants: match.totalParticipants,
        totalFee: match.totalFee,
        applicationStatus: match.applicationStatus,
        paymentStatus: match.paymentStatus,
        createdAt: match.createdAt,
      },
    };
  }

  public updateEventApplicationStatus(
    appId: string,
    status: EventApplicationStatus,
    note?: string
  ): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (
      !this.isAuthenticated ||
      (!perms.can_event_approve_application && this.currentUser.role !== 'super_admin')
    ) {
      return { success: false, error: 'আবেদনের উপস্থিতি অনুমোদন বা বাতিল করার অনুমতি নেই।' };
    }
    const app = this.eventApplications.find((a) => a.id === appId);
    if (!app) return { success: false, error: 'নিবন্ধন খুঁজে পাওয়া যায়নি।' };

    const nowISO = new Date().toISOString();
    const nowStr = nowISO.replace('T', ' ').substring(0, 19);
    const updated: EventApplication = {
      ...app,
      applicationStatus: status,
      notes: note?.trim() ? note.trim() : app.notes,
      reviewedByName: this.currentUser.name,
      reviewedAt: nowStr,
      updatedAt: nowStr,
    };

    this.eventApplications = this.eventApplications.map((a) => (a.id === appId ? updated : a));
    this.save('eventApplications', this.eventApplications);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `আবেদনের অবস্থা আপডেট (${app.registrationCode})`,
        supabase
          .from('event_applications')
          .update({
            application_status: status,
            notes: updated.notes || null,
            reviewed_by: isValidUUID(this.currentUser.id) ? this.currentUser.id : null,
            reviewed_by_name: this.currentUser.name,
            reviewed_at: nowISO,
            updated_at: nowISO,
          })
          .eq('id', appId)
      );
    }

    this.appendEventLog(
      app.eventId,
      'UPDATE_EVENT_APPLICATION_STATUS',
      `আবেদন ${app.registrationCode} (${app.applicantNameBn})-এর উপস্থিতি অবস্থা "${status}" করা হয়েছে (পেমেন্ট অবস্থা অপরিবর্তিত: ${app.paymentStatus})।`,
      appId
    );
    this.notify();
    return { success: true };
  }

  public verifyOrRecordEventPayment(params: {
    appId: string;
    action: 'verify' | 'reject' | 'record_and_verify';
    paymentMethod?: EventPaymentMethod;
    transactionId?: string;
    paidAmount?: number;
    note?: string;
  }): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (
      !this.isAuthenticated ||
      (!perms.can_event_verify_payment && this.currentUser.role !== 'super_admin')
    ) {
      return { success: false, error: 'অনুষ্ঠানের পেমেন্ট যাচাই করার অনুমতি আপনার নেই।' };
    }
    const app = this.eventApplications.find((a) => a.id === params.appId);
    if (!app) return { success: false, error: 'নিবন্ধন খুঁজে পাওয়া যায়নি।' };
    if (app.paymentStatus === 'refunded') {
      return { success: false, error: 'ইতোমধ্যে রিফান্ড হওয়া পেমেন্ট পুনরায় ভেরিফাই করা যাবে না।' };
    }

    const cleanTxn = params.transactionId !== undefined ? params.transactionId.trim() : (app.transactionId || '');
    if (params.action !== 'reject' && cleanTxn && this.isEventTransactionIdDuplicate(app.eventId, cleanTxn, app.id)) {
      return { success: false, error: `এই ট্রানজেকশন / রসিদ নম্বর (${cleanTxn}) অন্য আবেদনে ব্যবহৃত হয়েছে।` };
    }

    const nowISO = new Date().toISOString();
    const nowStr = nowISO.replace('T', ' ').substring(0, 19);

    let nextPaymentStatus = app.paymentStatus;
    let nextPaidAmount = app.paidAmount;
    const nextMethod = params.paymentMethod || app.paymentMethod || 'cash';

    if (params.action === 'reject') {
      nextPaymentStatus = 'rejected';
      nextPaidAmount = 0;
    } else {
      const targetAmt =
        params.paidAmount !== undefined && Number.isFinite(params.paidAmount)
          ? roundBDT(params.paidAmount)
          : app.paidAmount > 0
            ? app.paidAmount
            : app.totalFee;
      if (targetAmt < 0) {
        return { success: false, error: 'পেমেন্টের পরিমাণ ঋণাত্মক হতে পারবে না।' };
      }
      nextPaymentStatus = targetAmt === 0 && app.totalFee === 0 ? 'exempt' : 'verified';
      nextPaidAmount = targetAmt;
    }

    const updated: EventApplication = {
      ...app,
      paymentStatus: nextPaymentStatus,
      paymentMethod: params.action === 'reject' ? app.paymentMethod : nextMethod,
      transactionId: cleanTxn || undefined,
      paidAmount: nextPaidAmount,
      paymentNote: params.note?.trim() || app.paymentNote,
      verifiedByName: this.currentUser.name,
      verifiedAt: nowStr,
      updatedAt: nowStr,
    };

    this.eventApplications = this.eventApplications.map((a) => (a.id === params.appId ? updated : a));
    this.save('eventApplications', this.eventApplications);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `ইভেন্ট পেমেন্ট ${params.action === 'reject' ? 'প্রত্যাখ্যান' : 'যাচাই'} (${app.registrationCode})`,
        supabase
          .from('event_applications')
          .update({
            payment_status: updated.paymentStatus,
            payment_method: updated.paymentMethod || null,
            transaction_id: updated.transactionId || null,
            paid_amount: updated.paidAmount,
            payment_note: updated.paymentNote || null,
            verified_by: isValidUUID(this.currentUser.id) ? this.currentUser.id : null,
            verified_by_name: this.currentUser.name,
            verified_at: nowISO,
            updated_at: nowISO,
          })
          .eq('id', params.appId)
      );
    }

    // Dedicated Event Fund only — NEVER alters main association funds/accounts/transactions!
    this.appendEventLog(
      app.eventId,
      params.action === 'reject' ? 'REJECT_EVENT_PAYMENT' : 'VERIFY_EVENT_PAYMENT',
      `আবেদন ${app.registrationCode}-এর পেমেন্ট "${nextPaymentStatus}" করা হয়েছে (৳${nextPaidAmount.toLocaleString()}, মাধ্যম: ${updated.paymentMethod || 'N/A'})।`,
      app.id
    );
    this.notify();
    return { success: true };
  }

  public refundEventPayment(
    appId: string,
    reason: string,
    refundAmount?: number
  ): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || (!perms.can_event_manage_refund && this.currentUser.role !== 'super_admin')) {
      return { success: false, error: 'পেমেন্ট রিফান্ড পরিচালনা করার অনুমতি আপনার নেই।' };
    }
    const app = this.eventApplications.find((a) => a.id === appId);
    if (!app) return { success: false, error: 'নিবন্ধন খুঁজে পাওয়া যায়নি।' };
    if (app.paymentStatus !== 'verified') {
      return { success: false, error: 'শুধুমাত্র ভেরিফায়েড (Verified) পেমেন্ট রিফান্ড করা যাবে।' };
    }
    if (!reason || reason.trim().length < 3) {
      return { success: false, error: 'রিফান্ডের কারণ কমপক্ষে ৩ অক্ষরে উল্লেখ করুন।' };
    }

    const cleanRefundAmt = roundBDT(refundAmount !== undefined ? refundAmount : app.paidAmount);
    if (!Number.isFinite(cleanRefundAmt) || cleanRefundAmt <= 0 || cleanRefundAmt > app.paidAmount) {
      return {
        success: false,
        error: `রিফান্ডের পরিমাণ ১ থেকে ৳${app.paidAmount.toLocaleString()}-এর মধ্যে হতে হবে।`,
      };
    }

    const nowISO = new Date().toISOString();
    const nowStr = nowISO.replace('T', ' ').substring(0, 19);
    const updated: EventApplication = {
      ...app,
      paymentStatus: 'refunded',
      refundAmount: cleanRefundAmt,
      refundReason: reason.trim(),
      refundedByName: this.currentUser.name,
      refundedAt: nowStr,
      updatedAt: nowStr,
    };

    this.eventApplications = this.eventApplications.map((a) => (a.id === appId ? updated : a));
    this.save('eventApplications', this.eventApplications);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `ইভেন্ট পেমেন্ট রিফান্ড (${app.registrationCode})`,
        supabase
          .from('event_applications')
          .update({
            payment_status: 'refunded',
            refund_amount: cleanRefundAmt,
            refund_reason: reason.trim(),
            refunded_by: isValidUUID(this.currentUser.id) ? this.currentUser.id : null,
            refunded_by_name: this.currentUser.name,
            refunded_at: nowISO,
            updated_at: nowISO,
          })
          .eq('id', appId)
      );
    }

    // Automatically subtracted from Dedicated Event Net Balance; main association ledger stays untouched!
    this.appendEventLog(
      app.eventId,
      'REFUND_EVENT_PAYMENT',
      `ভেরিফায়েড পেমেন্ট ${app.registrationCode} রিফান্ড করা হয়েছে: ৳${cleanRefundAmt.toLocaleString()} (স্বয়ংক্রিয়ভাবে অনুষ্ঠান ফান্ড থেকে বাদ)। কারণ: ${reason.trim()}`,
      appId
    );
    this.notify();
    return { success: true };
  }

  public deleteEventApplication(appId: string): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || (!perms.can_event_delete_test_data && this.currentUser.role !== 'super_admin')) {
      return { success: false, error: 'আবেদন মুছে ফেলার অনুমতি আপনার নেই।' };
    }
    const app = this.eventApplications.find((a) => a.id === appId);
    if (!app) return { success: false, error: 'আবেদন খুঁজে পাওয়া যায়নি।' };
    if (app.paymentStatus === 'verified') {
      return {
        success: false,
        error: 'ভেরিফায়েড পেমেন্টযুক্ত আবেদন সরাসরি মুছে ফেলা যাবে না; আগে রিফান্ড সম্পন্ন করুন।',
      };
    }

    this.eventApplications = this.eventApplications.filter((a) => a.id !== appId);
    this.save('eventApplications', this.eventApplications);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `আবেদন মোছা (${app.registrationCode})`,
        supabase.from('event_applications').delete().eq('id', appId)
      );
    }

    this.appendEventLog(
      app.eventId,
      'DELETE_EVENT_APPLICATION',
      `আবেদন ${app.registrationCode} (${app.applicantNameBn}) স্থায়ীভাবে মুছে ফেলা হয়েছে।`
    );
    this.notify();
    return { success: true };
  }

  public addEventLedgerEntry(params: {
    eventId: string;
    entryType: EventLedgerEntryType;
    title: string;
    category: string;
    partyName: string;
    paymentMethod: EventPaymentMethod;
    referenceNo?: string;
    amount: number;
    entryDate?: string;
    notes?: string;
  }): { success: boolean; entry?: EventLedgerEntry; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || (!perms.can_event_manage_ledger && this.currentUser.role !== 'super_admin')) {
      return { success: false, error: 'অনুষ্ঠান ফান্ডে অনুদান বা খরচ এন্ট্রি করার অনুমতি আপনার নেই।' };
    }
    const cleanAmt = roundBDT(params.amount);
    if (!Number.isFinite(cleanAmt) || cleanAmt <= 0) {
      return { success: false, error: 'টাকার পরিমাণ অবশ্যই শূন্যের চেয়ে বেশি হতে হবে।' };
    }
    if (!params.title.trim()) {
      return { success: false, error: 'বিবরণ বা শিরোনাম দেওয়া বাধ্যতামূলক।' };
    }

    const nowISO = new Date().toISOString();
    const year = new Date().getFullYear();
    const entryCode = nextSequentialCode(
      'EVL',
      year,
      this.eventLedgerEntries.map((e) => e.entryCode),
      4
    );
    const newEntry: EventLedgerEntry = {
      id: generateUUID(),
      eventId: params.eventId,
      entryCode,
      entryType: params.entryType,
      title: params.title.trim(),
      category: params.category.trim() || (params.entryType === 'donation' ? 'ডোনার অনুদান' : 'অনুষ্ঠান ব্যয়'),
      partyName: params.partyName.trim() || 'সাধারণ',
      paymentMethod: params.paymentMethod || 'cash',
      referenceNo: params.referenceNo?.trim() || undefined,
      amount: cleanAmt,
      notes: params.notes?.trim() || undefined,
      entryDate: (params.entryDate || nowISO.substring(0, 10)).substring(0, 10),
      createdByName: this.currentUser.name,
      createdAt: nowISO.replace('T', ' ').substring(0, 19),
    };

    this.eventLedgerEntries = [newEntry, ...this.eventLedgerEntries];
    this.save('eventLedgerEntries', this.eventLedgerEntries);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `অনুষ্ঠান ফান্ড এন্ট্রি (${newEntry.entryCode})`,
        supabase.from('event_ledger_entries').insert({
          id: newEntry.id,
          event_id: newEntry.eventId,
          entry_code: newEntry.entryCode,
          entry_type: newEntry.entryType,
          title: newEntry.title,
          category: newEntry.category,
          party_name: newEntry.partyName,
          payment_method: newEntry.paymentMethod,
          reference_no: newEntry.referenceNo || null,
          amount: newEntry.amount,
          notes: newEntry.notes || null,
          entry_date: newEntry.entryDate,
          created_by: isValidUUID(this.currentUser.id) ? this.currentUser.id : null,
          created_by_name: newEntry.createdByName,
        })
      );
    }

    this.appendEventLog(
      params.eventId,
      params.entryType === 'donation' ? 'ADD_EVENT_DONATION' : 'ADD_EVENT_EXPENSE',
      `অনুষ্ঠান ফান্ড লেজার ${newEntry.entryCode}: "${newEntry.title}" — ৳${cleanAmt.toLocaleString()} (${params.entryType === 'donation' ? 'ডোনার অনুদান/স্পট আয়' : 'অনুষ্ঠানের খরচ'})।`
    );
    this.notify();
    return { success: true, entry: newEntry };
  }

  public deleteEventLedgerEntry(entryId: string): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (!this.isAuthenticated || (!perms.can_event_manage_ledger && this.currentUser.role !== 'super_admin')) {
      return { success: false, error: 'অনুষ্ঠান লেজার এন্ট্রি মোছার অনুমতি নেই।' };
    }
    const existing = this.eventLedgerEntries.find((e) => e.id === entryId);
    if (!existing) return { success: false, error: 'এন্ট্রি খুঁজে পাওয়া যায়নি।' };

    this.eventLedgerEntries = this.eventLedgerEntries.filter((e) => e.id !== entryId);
    this.save('eventLedgerEntries', this.eventLedgerEntries);

    if (this.canPersistToSupabase() && supabase) {
      this.persistSupabase(
        `অনুষ্ঠান লেজার এন্ট্রি মোছা (${existing.entryCode})`,
        supabase.from('event_ledger_entries').delete().eq('id', entryId)
      );
    }

    this.appendEventLog(
      existing.eventId,
      'DELETE_EVENT_LEDGER',
      `অনুষ্ঠান লেজার এন্ট্রি ${existing.entryCode} ("${existing.title}") মুছে ফেলা হয়েছে।`
    );
    this.notify();
    return { success: true };
  }

  public getEventDashboardStats(eventId: string): EventDashboardStats {
    const apps = this.eventApplications.filter((a) => a.eventId === eventId);
    const ledger = this.eventLedgerEntries.filter((l) => l.eventId === eventId);
    const cats = this.eventCategories.filter((c) => c.eventId === eventId);

    const activeApps = apps.filter((a) => a.applicationStatus !== 'rejected' && a.applicationStatus !== 'cancelled');
    const approvedApps = apps.filter((a) => a.applicationStatus === 'approved');
    const pendingApps = apps.filter((a) => a.applicationStatus === 'pending');
    const rejectedApps = apps.filter((a) => a.applicationStatus === 'rejected');

    const totalRegisteredParticipants = activeApps.reduce((s, a) => s + a.totalParticipants, 0);
    const approvedParticipants = approvedApps.reduce((s, a) => s + a.totalParticipants, 0);
    const expectedTotalFee = roundBDT(activeApps.reduce((s, a) => s + a.totalFee, 0));

    const unpaidApplicationsCount = activeApps.filter((a) => a.paymentStatus === 'unpaid').length;
    const submittedPaymentsCount = activeApps.filter((a) => a.paymentStatus === 'submitted').length;
    const verifiedApps = apps.filter((a) => a.paymentStatus === 'verified');
    const refundedApps = apps.filter((a) => a.paymentStatus === 'refunded');

    // Gross collected includes both still-verified AND refunded original verified amounts for clear reporting
    const grossVerifiedCollection = roundBDT(
      [...verifiedApps, ...refundedApps].reduce((s, a) => s + a.paidAmount, 0)
    );
    const totalRefundedAmount = roundBDT(refundedApps.reduce((s, a) => s + a.refundAmount, 0));
    const eventDonationsTotal = roundBDT(
      ledger.filter((l) => l.entryType === 'donation').reduce((s, l) => s + l.amount, 0)
    );
    const eventExpensesTotal = roundBDT(
      ledger.filter((l) => l.entryType === 'expense').reduce((s, l) => s + l.amount, 0)
    );

    // Event Net Fund Balance = (Net Verified Registration Income + Event Donations) - Event Expenses
    const eventNetFundBalance = roundBDT(
      grossVerifiedCollection - totalRefundedAmount + eventDonationsTotal - eventExpensesTotal
    );

    const catMap = new Map<
      string,
      { categoryId: string; titleBn: string; unitFee: number; registeredParticipants: number; approvedParticipants: number; expectedFeeTotal: number }
    >();
    for (const c of cats) {
      catMap.set(c.id, {
        categoryId: c.id,
        titleBn: c.titleBn,
        unitFee: c.feeAmount,
        registeredParticipants: 0,
        approvedParticipants: 0,
        expectedFeeTotal: 0,
      });
    }
    for (const a of activeApps) {
      for (const item of a.categoryBreakdown) {
        const cur = catMap.get(item.categoryId) || {
          categoryId: item.categoryId,
          titleBn: item.titleBn,
          unitFee: item.unitFee,
          registeredParticipants: 0,
          approvedParticipants: 0,
          expectedFeeTotal: 0,
        };
        cur.registeredParticipants += item.quantity;
        if (a.applicationStatus === 'approved') {
          cur.approvedParticipants += item.quantity;
        }
        cur.expectedFeeTotal = roundBDT(cur.expectedFeeTotal + item.lineTotal);
        catMap.set(item.categoryId, cur);
      }
    }

    const methodMap = new Map<string, { method: string; verifiedCount: number; verifiedAmount: number }>();
    for (const a of verifiedApps) {
      const mKey = a.paymentMethod || 'other';
      const prev = methodMap.get(mKey) || { method: mKey, verifiedCount: 0, verifiedAmount: 0 };
      prev.verifiedCount += 1;
      prev.verifiedAmount = roundBDT(prev.verifiedAmount + a.paidAmount);
      methodMap.set(mKey, prev);
    }

    return {
      totalApplications: apps.length,
      approvedApplications: approvedApps.length,
      pendingApplications: pendingApps.length,
      rejectedApplications: rejectedApps.length,
      totalRegisteredParticipants,
      approvedParticipants,
      expectedTotalFee,
      unpaidApplicationsCount,
      submittedPaymentsCount,
      verifiedPaymentsCount: verifiedApps.length,
      grossVerifiedCollection,
      refundedCount: refundedApps.length,
      totalRefundedAmount,
      eventDonationsTotal,
      eventExpensesTotal,
      eventNetFundBalance,
      categorySummary: Array.from(catMap.values()),
      paymentMethodSummary: Array.from(methodMap.values()),
    };
  }

  // --- BACKUP & DRY-RUN RESTORE VALIDATOR ---
  public exportFullBackupJSON(): string {
    const backupData = {
      version: '6.1',
      exportedAt: new Date().toISOString(),
      organization: this.settings.organizationNameBn,
      metadata: {
        totalMembers: this.members.length,
        totalFunds: this.funds.length,
        totalAccounts: this.accounts.length,
        totalTransactions: this.transactions.length,
        totalCorrections: this.corrections.length,
        totalEvents: this.events.length,
        totalEventApplications: this.eventApplications.length,
        totalPermissionLogs: this.permissionChangeLogs.length,
        fundsTotalBalance: roundBDT(this.funds.reduce((acc, f) => acc + f.currentBalance, 0)),
        accountsTotalBalance: roundBDT(this.accounts.reduce((acc, a) => acc + a.currentBalance, 0)),
      },
      data: {
        settings: this.settings,
        rolePermissions: this.rolePermissions,
        userPermissions: this.userPermissions,
        funds: this.funds,
        accounts: this.accounts,
        transactions: this.transactions,
        corrections: this.corrections,
        members: this.members,
        committees: this.committees,
        notices: this.notices,
        aidApplications: this.aidApplications,
        events: this.events,
        eventCategories: this.eventCategories,
        eventApplications: this.eventApplications,
        eventLedgerEntries: this.eventLedgerEntries,
        eventLogs: this.eventLogs,
        auditLogs: this.auditLogs,
        permissionChangeLogs: this.permissionChangeLogs,
      },
    };
    this.logAudit('EXPORT_BACKUP', 'system', 'backup', 'সম্পূর্ণ ডাটাবেজ ব্যাকআপ (JSON) এক্সপোর্ট করা হয়েছে।');
    return JSON.stringify(backupData, null, 2);
  }

  public validateBackupJSON(jsonStr: string): {
    isValid: boolean;
    error?: string;
    summary?: {
      membersCount: number;
      transactionsCount: number;
      fundsCount: number;
      accountsCount: number;
      fundBalanceSum: number;
      accountBalanceSum: number;
      isDualBalanceMatched: boolean;
    };
  } {
    try {
      const parsed = JSON.parse(jsonStr);
      if (
        !parsed.data ||
        !Array.isArray(parsed.data.funds) ||
        !Array.isArray(parsed.data.accounts) ||
        !Array.isArray(parsed.data.transactions) ||
        !Array.isArray(parsed.data.members)
      ) {
        return { isValid: false, error: 'অকার্যকর ব্যাকআপ ফাইল: ডাটাবেজের মূল টেবিলসমূহ অনুপস্থিত বা অবৈধ।' };
      }

      const funds = parsed.data.funds as FinancialFund[];
      const accounts = parsed.data.accounts as FinancialAccount[];
      const members = parsed.data.members as Member[];
      const transactions = parsed.data.transactions as FinancialTransaction[];

      if (funds.some((f) => !Number.isFinite(f.currentBalance) || f.currentBalance < 0)) {
        return { isValid: false, error: 'ত্রুটিপূর্ণ ব্যাকআপ: কোনো তহবিলের ব্যালেন্স ঋণাত্মক বা অকার্যকর পাওয়া গেছে।' };
      }
      if (accounts.some((a) => !Number.isFinite(a.currentBalance) || a.currentBalance < 0)) {
        return { isValid: false, error: 'ত্রুটিপূর্ণ ব্যাকআপ: কোনো অ্যাকাউন্টের ব্যালেন্স ঋণাত্মক বা অকার্যকর পাওয়া গেছে।' };
      }
      if (transactions.some((t) => !Number.isFinite(t.amount) || t.amount < 0)) {
        return { isValid: false, error: 'ত্রুটিপূর্ণ ব্যাকআপ: কোনো লেনদেনের পরিমাণ ঋণাত্মক পাওয়া গেছে।' };
      }

      const voucherSet = new Set<string>();
      for (const t of transactions) {
        const key = String(t.voucherNo || '').trim().toLowerCase();
        if (!key || voucherSet.has(key)) {
          return { isValid: false, error: `ত্রুটিপূর্ণ ব্যাকআপ: ডুপ্লিকেট বা খালি ভাউচার নম্বর (${t.voucherNo}) শনাক্ত হয়েছে।` };
        }
        voucherSet.add(key);
      }

      const fundSum = roundBDT(funds.reduce((acc, f) => acc + (f.currentBalance || 0), 0));
      const accSum = roundBDT(accounts.reduce((acc, a) => acc + (a.currentBalance || 0), 0));
      const isDualBalanceMatched = Math.abs(fundSum - accSum) < 0.01;

      return {
        isValid: true,
        summary: {
          membersCount: members.length,
          transactionsCount: transactions.length,
          fundsCount: funds.length,
          accountsCount: accounts.length,
          fundBalanceSum: fundSum,
          accountBalanceSum: accSum,
          isDualBalanceMatched,
        },
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { isValid: false, error: 'JSON পার্সিং ত্রুটি: ' + msg };
    }
  }

  public restoreFromBackupJSON(jsonStr: string): { success: boolean; error?: string } {
    const perms = this.getEffectivePermissions();
    if (
      !this.isAuthenticated ||
      (!perms.can_export_backup && this.currentUser.role !== 'super_admin')
    ) {
      return { success: false, error: 'ব্যাকআপ রিস্টোর করার অনুমতি শুধুমাত্র অনুমোদিত প্রশাসকের।' };
    }

    const validation = this.validateBackupJSON(jsonStr);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const d = parsed.data;
      if (d.settings) {
        this.settings = {
          ...INITIAL_SETTINGS,
          ...d.settings,
          enableStudentWing: d.settings.enableStudentWing ?? INITIAL_SETTINGS.enableStudentWing,
          studentWingNameBn: d.settings.studentWingNameBn ?? INITIAL_SETTINGS.studentWingNameBn,
          enableEventsModule: d.settings.enableEventsModule ?? INITIAL_SETTINGS.enableEventsModule,
          themePreset: d.settings.themePreset ?? INITIAL_SETTINGS.themePreset,
          heroImageUrl: d.settings.heroImageUrl ?? INITIAL_SETTINGS.heroImageUrl,
          articles: {
            ...INITIAL_SETTINGS.articles,
            ...(d.settings.articles || {}),
          },
          founders: Array.isArray(d.settings.founders) ? d.settings.founders : INITIAL_SETTINGS.founders,
        };
        this.applyThemeToDocument(this.settings.themePreset);
      }
      if (d.rolePermissions) {
        this.rolePermissions = (Object.keys(INITIAL_ROLE_PERMISSIONS) as Role[]).reduce((acc, roleKey) => {
          acc[roleKey] = {
            ...INITIAL_ROLE_PERMISSIONS[roleKey],
            ...(d.rolePermissions[roleKey] || {}),
          };
          return acc;
        }, {} as Record<Role, AdminPermissions>);
      }
      if (d.userPermissions) this.userPermissions = d.userPermissions;
      if (d.funds) this.funds = d.funds;
      if (d.accounts) this.accounts = d.accounts;
      if (d.transactions) this.transactions = d.transactions;
      if (d.corrections) this.corrections = d.corrections;
      if (d.members) this.members = d.members;
      if (d.committees) this.committees = d.committees;
      if (d.notices) this.notices = d.notices;
      if (d.aidApplications) this.aidApplications = d.aidApplications;
      if (Array.isArray(d.events)) this.events = d.events;
      if (Array.isArray(d.eventCategories)) this.eventCategories = d.eventCategories;
      if (Array.isArray(d.eventApplications)) this.eventApplications = d.eventApplications;
      if (Array.isArray(d.eventLedgerEntries)) this.eventLedgerEntries = d.eventLedgerEntries;
      if (Array.isArray(d.eventLogs)) this.eventLogs = d.eventLogs;
      if (d.auditLogs) this.auditLogs = d.auditLogs;
      if (d.permissionChangeLogs) this.permissionChangeLogs = d.permissionChangeLogs;

      this.save('settings', this.settings);
      this.save('rolePermissions', this.rolePermissions);
      this.save('userPermissions', this.userPermissions);
      this.save('funds', this.funds);
      this.save('accounts', this.accounts);
      this.save('transactions', this.transactions);
      this.save('corrections', this.corrections);
      this.save('members', this.members);
      this.save('committees', this.committees);
      this.save('notices', this.notices);
      this.save('aidApplications', this.aidApplications);
      this.save('events', this.events);
      this.save('eventCategories', this.eventCategories);
      this.save('eventApplications', this.eventApplications);
      this.save('eventLedgerEntries', this.eventLedgerEntries);
      this.save('eventLogs', this.eventLogs);
      this.save('auditLogs', this.auditLogs);
      this.save('permissionChangeLogs', this.permissionChangeLogs);

      if (this.canPersistToSupabase() && supabase) {
        this.persistSettingsToSupabase();
        const sb = supabase;
        for (const f of this.funds) {
          if (isValidUUID(f.id)) {
            this.persistSupabase(
              `রিস্টোর তহবিল (${f.name})`,
              sb.from('funds').upsert({
                id: f.id,
                name: f.name,
                code: f.code,
                description: f.description,
                current_balance: f.currentBalance,
                is_active: f.isActive,
                is_default: f.isDefault,
              })
            );
          }
        }
        for (const a of this.accounts) {
          if (isValidUUID(a.id)) {
            this.persistSupabase(
              `রিস্টোর অ্যাকাউন্ট (${a.name})`,
              sb.from('accounts').upsert({
                id: a.id,
                name: a.name,
                type: a.type,
                account_number: a.accountNumber || null,
                current_balance: a.currentBalance,
                is_active: a.isActive,
              })
            );
          }
        }
      }

      this.logAudit('RESTORE_BACKUP', 'system', 'backup', 'ব্যাকআপ ফাইল থেকে সম্পূর্ণ ডাটাবেজ সফলভাবে রিস্টোর করা হয়েছে।');
      this.notify();
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: 'রিস্টোর ব্যর্থ: ' + msg };
    }
  }
}

export const store = new AppStore();

export function useAppStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return store.subscribe(() => setTick((t) => t + 1));
  }, []);

  return store;
}
