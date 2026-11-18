/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AdminPermissions,
  AidApplication,
  AuditLog,
  CommitteeTerm,
  EventApplication,
  EventApplicationLog,
  EventFeeCategory,
  EventItem,
  EventLedgerEntry,
  FinancialAccount,
  FinancialFund,
  FinancialTransaction,
  Member,
  Notice,
  Role,
  SystemSettings,
} from '../types.ts';

import { ORGANIZATION_CONFIG } from '../config/organization.ts';

export const INITIAL_SETTINGS: SystemSettings = {
  organizationNameBn: ORGANIZATION_CONFIG.organizationNameBn,
  organizationNameEn: ORGANIZATION_CONFIG.organizationNameEn,
  establishedYear: ORGANIZATION_CONFIG.establishedYear,
  sloganBn: ORGANIZATION_CONFIG.sloganBn,
  officeAddress: ORGANIZATION_CONFIG.officeAddress,
  hotline1: ORGANIZATION_CONFIG.hotline1,
  hotline2: ORGANIZATION_CONFIG.hotline2,
  whatsappNumber: ORGANIZATION_CONFIG.whatsappNumber,
  whatsappPrefilledMessage: ORGANIZATION_CONFIG.whatsappPrefilledMessage,
  facebookPageUrl: ORGANIZATION_CONFIG.facebookPageUrl,
  facebookGroupUrl: ORGANIZATION_CONFIG.facebookGroupUrl,
  messengerUrl: ORGANIZATION_CONFIG.messengerUrl,
  email: ORGANIZATION_CONFIG.email,
  technicalPartnerName: ORGANIZATION_CONFIG.technicalPartnerName,
  technicalPartnerUrl: ORGANIZATION_CONFIG.technicalPartnerUrl,
  technicalPartnerPhone1: ORGANIZATION_CONFIG.technicalPartnerPhone1,
  technicalPartnerPhone2: ORGANIZATION_CONFIG.technicalPartnerPhone2,
  nextBdUrl: ORGANIZATION_CONFIG.nextBdUrl,
  copyrightNotice: ORGANIZATION_CONFIG.copyrightNotice,
  isCommitteePubliclyVisible: false, // Default unpublished until admin explicitly publishes
  correctionThresholdAmount: ORGANIZATION_CONFIG.correctionThresholdAmount,
  enableStudentWing: ORGANIZATION_CONFIG.enableStudentWing,
  studentWingNameBn: ORGANIZATION_CONFIG.studentWingNameBn,
  enableEventsModule: ORGANIZATION_CONFIG.enableEventsModule ?? true,
  themePreset: ORGANIZATION_CONFIG.themePreset,
  heroImageUrl: ORGANIZATION_CONFIG.heroImageUrl,
  articles: { ...ORGANIZATION_CONFIG.defaultArticles },
  founders: ORGANIZATION_CONFIG.defaultFounders.map((f) => ({ ...f })),
};

const ALL_EVENT_PERMS_FALSE = {
  can_event_view_module: false,
  can_event_create: false,
  can_event_edit: false,
  can_event_manage_categories: false,
  can_event_view_applications: false,
  can_event_approve_application: false,
  can_event_verify_payment: false,
  can_event_manage_refund: false,
  can_event_manage_ledger: false,
  can_event_delete_test_data: false,
  can_event_view_finance_summary: false,
  can_event_export_reports: false,
  can_event_manage_settings: false,
  can_event_view_logs: false,
};

const ALL_EVENT_PERMS_TRUE = {
  can_event_view_module: true,
  can_event_create: true,
  can_event_edit: true,
  can_event_manage_categories: true,
  can_event_view_applications: true,
  can_event_approve_application: true,
  can_event_verify_payment: true,
  can_event_manage_refund: true,
  can_event_manage_ledger: true,
  can_event_delete_test_data: true,
  can_event_view_finance_summary: true,
  can_event_export_reports: true,
  can_event_manage_settings: true,
  can_event_view_logs: true,
};

export const INITIAL_ROLE_PERMISSIONS: Record<Role, AdminPermissions> = {
  super_admin: {
    can_view_finance: true,
    can_entry_finance: true,
    can_approve_finance: true,
    can_view_reports: true,
    can_export_reports: true,
    can_correct_finance: true,
    can_view_correction_history: true,
    can_manage_funds: true,
    can_manage_accounts: true,
    can_manage_members: true,
    can_manage_student_wing: true,
    can_manage_committees: true,
    can_manage_notices: true,
    can_manage_settings: true,
    can_export_backup: true,
    ...ALL_EVENT_PERMS_TRUE,
  },
  finance_secretary: {
    can_view_finance: true,
    can_entry_finance: true,
    can_approve_finance: false,
    can_view_reports: true,
    can_export_reports: true,
    can_correct_finance: true,
    can_view_correction_history: true,
    can_manage_funds: false,
    can_manage_accounts: false,
    can_manage_members: false,
    can_manage_student_wing: false,
    can_manage_committees: false,
    can_manage_notices: true,
    can_manage_settings: false,
    can_export_backup: false,
    ...ALL_EVENT_PERMS_FALSE,
    can_event_view_module: true,
    can_event_view_finance_summary: true,
    can_event_export_reports: true,
  },
  president: {
    can_view_finance: true,
    can_entry_finance: false,
    can_approve_finance: true,
    can_view_reports: true,
    can_export_reports: true,
    can_correct_finance: false,
    can_view_correction_history: true,
    can_manage_funds: false,
    can_manage_accounts: false,
    can_manage_members: true,
    can_manage_student_wing: true,
    can_manage_committees: true,
    can_manage_notices: true,
    can_manage_settings: false,
    can_export_backup: true,
    ...ALL_EVENT_PERMS_FALSE,
    can_event_view_module: true,
    can_event_view_applications: true,
    can_event_view_finance_summary: true,
    can_event_export_reports: true,
    can_event_view_logs: true,
  },
  general_secretary: {
    can_view_finance: true,
    can_entry_finance: true,
    can_approve_finance: true,
    can_view_reports: true,
    can_export_reports: true,
    can_correct_finance: false,
    can_view_correction_history: true,
    can_manage_funds: false,
    can_manage_accounts: false,
    can_manage_members: true,
    can_manage_student_wing: true,
    can_manage_committees: true,
    can_manage_notices: true,
    can_manage_settings: false,
    can_export_backup: true,
    ...ALL_EVENT_PERMS_FALSE,
    can_event_view_module: true,
    can_event_view_applications: true,
    can_event_view_finance_summary: true,
    can_event_export_reports: true,
    can_event_view_logs: true,
  },
  general_admin: {
    can_view_finance: false,
    can_entry_finance: false,
    can_approve_finance: false,
    can_view_reports: false,
    can_export_reports: false,
    can_correct_finance: false,
    can_view_correction_history: false,
    can_manage_funds: false,
    can_manage_accounts: false,
    can_manage_members: true,
    can_manage_student_wing: false,
    can_manage_committees: false,
    can_manage_notices: true,
    can_manage_settings: false,
    can_export_backup: false,
    ...ALL_EVENT_PERMS_FALSE,
  },
  student_admin: {
    can_view_finance: false,
    can_entry_finance: false,
    can_approve_finance: false,
    can_view_reports: false,
    can_export_reports: false,
    can_correct_finance: false,
    can_view_correction_history: false,
    can_manage_funds: false,
    can_manage_accounts: false,
    can_manage_members: false,
    can_manage_student_wing: true,
    can_manage_committees: false,
    can_manage_notices: true,
    can_manage_settings: false,
    can_export_backup: false,
    ...ALL_EVENT_PERMS_FALSE,
  },
  event_admin: {
    can_view_finance: false,
    can_entry_finance: false,
    can_approve_finance: false,
    can_view_reports: false,
    can_export_reports: false,
    can_correct_finance: false,
    can_view_correction_history: false,
    can_manage_funds: false,
    can_manage_accounts: false,
    can_manage_members: false,
    can_manage_student_wing: false,
    can_manage_committees: false,
    can_manage_notices: true,
    can_manage_settings: false,
    can_export_backup: false,
    ...ALL_EVENT_PERMS_TRUE,
    can_event_delete_test_data: false, // Safety default: Super Admin enables if needed
  },
};

// CLEAN PRODUCTION FUNDS STRUCTURE (All balances start strictly at ৳0)
export const INITIAL_FUNDS: FinancialFund[] = ORGANIZATION_CONFIG.defaultFunds.map((f) => ({ ...f }));

// CLEAN PRODUCTION ACCOUNTS STRUCTURE (All balances start strictly at ৳0)
export const INITIAL_ACCOUNTS: FinancialAccount[] = ORGANIZATION_CONFIG.defaultAccounts.map((a) => ({ ...a }));

// Clean empty production arrays (zero fake demo data exposed publicly)
export const INITIAL_MEMBERS: Member[] = [];
export const INITIAL_COMMITTEES: CommitteeTerm[] = [];
export const INITIAL_TRANSACTIONS: FinancialTransaction[] = [];
export const INITIAL_NOTICES: Notice[] = [];
export const INITIAL_AID_APPLICATIONS: AidApplication[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
export const INITIAL_EVENTS: EventItem[] = [];
export const INITIAL_EVENT_CATEGORIES: EventFeeCategory[] = [];
export const INITIAL_EVENT_APPLICATIONS: EventApplication[] = [];
export const INITIAL_EVENT_LEDGER_ENTRIES: EventLedgerEntry[] = [];
export const INITIAL_EVENT_LOGS: EventApplicationLog[] = [];

// =========================================================================
// ISOLATED DEMO SANDBOX DATA (Loaded ONLY when Super Admin explicitly activates Sandbox Mode)
// =========================================================================
export const DEMO_SANDBOX_FUNDS: FinancialFund[] = INITIAL_FUNDS.map((f, idx) => ({
  ...f,
  currentBalance: [75500, 120000, 85000, 50000, 65000, 42000, 250000][idx] ?? 0,
}));

export const DEMO_SANDBOX_ACCOUNTS: FinancialAccount[] = [
  {
    id: 'acc-1',
    name: '[ডেমো] সোনালী ব্যাংক পিএলসি (ধাপ শাখা, রংপুর)',
    type: 'bank',
    accountNumber: 'DEMO-01220345',
    currentBalance: 395500,
    isActive: true,
  },
  {
    id: 'acc-2',
    name: '[ডেমো] নগদ হাতে ক্যাশ (কোষাধ্যক্ষ)',
    type: 'cash',
    accountNumber: 'DEMO-CASH',
    currentBalance: 142000,
    isActive: true,
  },
  {
    id: 'acc-3',
    name: '[ডেমো] মোবাইল ব্যাংকিং ওয়ালেট (বিকাশ / নগদ)',
    type: 'mobile_banking',
    accountNumber: 'DEMO-MFS',
    currentBalance: 150000,
    isActive: true,
  },
];

export const DEMO_SANDBOX_MEMBERS: Member[] = [
  {
    id: 'demo-mem-1',
    membershipId: 'DEMO-GEN-001',
    type: 'general',
    fullNameBn: '[ডেমো] নমুনা সাধারণ সদস্য',
    fullNameEn: '[DEMO] Sample General Member',
    phone: '01700000001',
    email: 'demo-member1@example.test',
    bloodGroup: 'A+',
    patgramAddress: { village: 'নমুনা গ্রাম', union: 'পাটগ্রাম', ward: '০১' },
    rangpurAddress: { area: 'ধাপ', thorough: 'কোতোয়ালী', thana: 'কোতোয়ালী' } as unknown as Member['rangpurAddress'],
    professionOrDesignation: 'টেস্ট ডেমো প্রোফাইল',
    status: 'active',
    joinedDate: '2026-01-01',
  },
  {
    id: 'demo-mem-2',
    membershipId: 'DEMO-STU-001',
    type: 'student',
    fullNameBn: '[ডেমো] নমুনা ছাত্র সদস্য',
    fullNameEn: '[DEMO] Sample Student Member',
    phone: '01700000002',
    email: 'demo-student@example.test',
    bloodGroup: 'O+',
    patgramAddress: { village: 'নমুনা গ্রাম', union: 'দহগ্রাম' },
    rangpurAddress: { area: 'লালবাগ', thana: 'তাজহাট' },
    institution: 'নমুনা বিশ্ববিদ্যালয়, রংপুর',
    department: 'কম্পিউটার সায়েন্স',
    academicYear: '৩য় বর্ষ',
    status: 'pending',
    joinedDate: '2026-11-01',
  },
];

export const DEMO_SANDBOX_COMMITTEES: CommitteeTerm[] = [
  {
    id: 'demo-comm-1',
    title: '[ডেমো] নমুনা কার্যকরী পরিষদ (টেস্ট)',
    wing: 'central',
    startYear: 2025,
    endYear: 2027,
    isCurrent: true,
    positions: [
      {
        id: 'demo-pos-1',
        title: 'সভাপতি (ডেমো)',
        memberNameBn: '[ডেমো] নমুনা সভাপতি',
        phone: '01700000001',
        priority: 1,
        isPublished: false,
      },
    ],
  },
];

export const DEMO_SANDBOX_TRANSACTIONS: FinancialTransaction[] = [
  {
    id: 'demo-txn-1',
    transactionCode: 'DEMO-TXN-0001',
    voucherNo: 'DEMO-V-01',
    type: 'income',
    fundId: 'fund-1',
    accountId: 'acc-1',
    amount: 50000,
    category: '[ডেমো] নমুনা অনুদান',
    donorOrPayee: 'নমুনা দাতা',
    description: 'এটি শুধুমাত্র পরীক্ষার জন্য ডেমো লেনদেন।',
    status: 'approved',
    createdByRole: 'super_admin',
    createdByName: 'ডেমো সিস্টেম',
    createdAt: '2026-11-01 10:00:00',
    approvedBy: 'ডেমো সিস্টেম',
    approvedAt: '2026-11-01 10:05:00',
  },
];

export const DEMO_SANDBOX_NOTICES: Notice[] = [
  {
    id: 'demo-not-1',
    title: '[ডেমো বিজ্ঞপ্তি] এটি সিস্টেম পরীক্ষার একটি নমুনা নোটিশ',
    category: 'general',
    content: 'সুপার অ্যাডমিন প্যানেলের স্যান্ডবক্স টেস্ট মোড চালু থাকায় এই নমুনা নোটিশটি দেখা যাচ্ছে।',
    publishDate: '2026-11-12',
    isPinned: false,
    author: 'স্যান্ডবক্স টেস্ট সিস্টেম',
  },
];

export const DEMO_SANDBOX_AID_APPLICATIONS: AidApplication[] = [
  {
    id: 'demo-aid-1',
    applicantName: '[ডেমো] নমুনা আবেদনকারী',
    phone: '01700000009',
    type: 'education_scholarship',
    patgramAddress: 'নমুনা গ্রাম, পাটগ্রাম',
    currentAddress: 'রংপুর',
    requestedAmount: 10000,
    reason: 'সিস্টেম পরীক্ষার জন্য নমুনা সহায়তা আবেদন।',
    status: 'submitted',
    submittedAt: '2026-11-10 12:00:00',
    allocatedFundId: 'fund-2',
  },
];
