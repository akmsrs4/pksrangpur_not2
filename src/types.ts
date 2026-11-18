/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 
  | 'super_admin'
  | 'finance_secretary'
  | 'president'
  | 'general_secretary'
  | 'general_admin'
  | 'student_admin'
  | 'event_admin';

export interface AdminPermissions {
  can_view_finance: boolean;
  can_entry_finance: boolean;
  can_approve_finance: boolean;
  can_view_reports: boolean;
  can_export_reports: boolean;
  can_correct_finance: boolean;
  can_view_correction_history: boolean;
  can_manage_funds: boolean;
  can_manage_accounts: boolean;
  can_manage_members: boolean;
  can_manage_student_wing: boolean;
  can_manage_committees: boolean;
  can_manage_notices: boolean;
  can_manage_settings: boolean;
  can_export_backup: boolean;
  // Event & Participation Management (14 Granular Permissions)
  can_event_view_module: boolean;
  can_event_create: boolean;
  can_event_edit: boolean;
  can_event_manage_categories: boolean;
  can_event_view_applications: boolean;
  can_event_approve_application: boolean;
  can_event_verify_payment: boolean;
  can_event_manage_refund: boolean;
  can_event_manage_ledger: boolean;
  can_event_delete_test_data: boolean;
  can_event_view_finance_summary: boolean;
  can_event_export_reports: boolean;
  can_event_manage_settings: boolean;
  can_event_view_logs: boolean;
}

export interface PermissionChangeLog {
  id: string;
  targetUserId: string;
  targetRole: Role;
  changedByRole: Role;
  changedByName: string;
  permissionKey: keyof AdminPermissions;
  oldValue: boolean;
  newValue: boolean;
  timestamp: string;
  reason?: string;
}

export interface AdminUserAccount {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
  status: 'active' | 'pending_approval' | 'suspended';
  passwordHash?: string; // Stored only as SHA-256 hash in local mode
  salt?: string;
  createdAt: string;
}

export type MemberType = 'general' | 'student' | 'alumni' | 'custom';
export type MemberStatus = 'pending' | 'active' | 'inactive' | 'rejected';

export interface Member {
  id: string;
  membershipId: string; // e.g. PKS-GEN-2026-001 or PKS-STU-2026-001
  type: MemberType;
  fullNameBn: string;
  fullNameEn: string;
  phone: string;
  email: string;
  bloodGroup: string;
  patgramAddress: {
    village: string;
    union: string;
    ward?: string;
  };
  rangpurAddress: {
    area: string;
    thana: string;
    roadOrHolding?: string;
  };
  professionOrDesignation?: string;
  institution?: string; // For students
  department?: string; // For students
  academicYear?: string; // For students
  photoUrl?: string;
  status: MemberStatus;
  joinedDate: string;
  notes?: string;
}

export interface CommitteePosition {
  id: string;
  title: string; // সভাপতি, সাধারণ সম্পাদক, etc.
  memberId?: string;
  memberNameBn: string;
  memberNameEn?: string;
  phone?: string;
  photoUrl?: string;
  priority: number;
  isPublished: boolean; // Admin can toggle whether to display this member publicly
}

export interface CommitteeTerm {
  id: string;
  title: string; // e.g. "কার্যকরী পরিষদ ২০২৬-২০২৮"
  wing: 'central' | 'student_wing' | 'advisory';
  startYear: number;
  endYear: number;
  isCurrent: boolean;
  positions: CommitteePosition[];
}

export interface FinancialFund {
  id: string;
  name: string; // e.g. সাধারণ পরিচালন তহবিল, শিক্ষা সহায়তা তহবিল
  code: string; // GEN, EDU, MED, RELIEF, SOC, STU, RES
  description: string;
  currentBalance: number;
  isActive: boolean;
  isDefault: boolean;
}

export interface FinancialAccount {
  id: string;
  name: string; // e.g. সোনালী ব্যাংক, নগদ হাতে (ক্যাশ), বিকাশ মার্চেন্ট
  type: 'bank' | 'cash' | 'mobile_banking' | 'other';
  accountNumber?: string;
  currentBalance: number;
  isActive: boolean;
}

export type TransactionType = 'income' | 'expense' | 'fund_transfer';
export type TransactionStatus = 'pending_approval' | 'approved' | 'rejected' | 'corrected';

export interface FinancialTransaction {
  id: string;
  transactionCode: string; // TXN-2026-XXXX
  voucherNo: string;
  type: TransactionType;
  fundId: string;
  toFundId?: string; // Only for fund_transfer
  accountId: string;
  toAccountId?: string; // Only for fund_transfer
  amount: number;
  category: string;
  donorOrPayee: string;
  description: string;
  receiptUrl?: string;
  status: TransactionStatus;
  createdByRole: Role;
  createdByName: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface FinancialCorrection {
  id: string;
  correctionCode: string; // CORR-2026-XXXX
  originalTransactionId: string;
  previousAmount: number;
  correctedAmount: number;
  previousCategory: string;
  correctedCategory: string;
  previousFundId: string;
  correctedFundId: string;
  previousAccountId: string;
  correctedAccountId: string;
  originalSnapshot: Partial<FinancialTransaction>;
  correctedSnapshot: Partial<FinancialTransaction>;
  correctionReason: string; // Mandatory!
  correctedById?: string;
  correctedByRole: Role;
  correctedByName: string;
  createdAt: string;
  requiresDualApproval: boolean;
  approvalStatus: 'approved' | 'pending_approval' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  approvalNote?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorRole: Role;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  metadata?: Record<string, any>;
  previousHash?: string;
  currentHash: string;
}

export interface Notice {
  id: string;
  title: string;
  category: 'general' | 'urgent' | 'meeting' | 'student' | 'election' | 'press';
  content: string;
  publishDate: string;
  isPinned: boolean;
  author: string;
  attachmentUrl?: string;
}

export interface AidApplication {
  id: string;
  applicantName: string;
  phone: string;
  email?: string;
  type: 'education_scholarship' | 'medical_assistance' | 'emergency_relief';
  patgramAddress: string;
  currentAddress: string;
  requestedAmount: number;
  reason: string;
  status: 'submitted' | 'under_review' | 'approved' | 'disbursed' | 'rejected';
  submittedAt: string;
  reviewedBy?: string;
  allocatedFundId?: string;
}

export type FounderCategory = 'founder' | 'founding_member';

export interface FounderEntry {
  id: string;
  nameBn: string;
  nameEn?: string;
  designationBn: string;
  category: FounderCategory;
  phone?: string;
  photoUrl?: string;
  bioBn?: string;
  priority: number;
  isPublished: boolean;
  notes?: string;
}

export interface OrganizationArticles {
  aboutSummary: string;
  foundingHistory: string;
  reorganizationNote: string;
  visionMission: string;
  studentWingSummary: string;
  welfareDescription: string;
  footerSummary: string;
}

export type ThemePreset =
  | 'emerald_gold'
  | 'royal_blue'
  | 'crimson_charcoal'
  | 'teal_copper'
  | 'indigo_forest'
  | 'forest_slate';

export interface SystemSettings {
  organizationNameBn: string;
  organizationNameEn: string;
  establishedYear: number;
  sloganBn: string;
  officeAddress: string;
  hotline1: string;
  hotline2: string;
  whatsappNumber: string;
  whatsappPrefilledMessage: string;
  facebookPageUrl: string;
  facebookGroupUrl: string;
  messengerUrl: string;
  email: string;
  technicalPartnerName: string;
  technicalPartnerUrl: string;
  technicalPartnerPhone1: string;
  technicalPartnerPhone2: string;
  nextBdUrl: string;
  copyrightNotice: string;
  isCommitteePubliclyVisible: boolean; // Default setting toggleable by admin
  correctionThresholdAmount: number; // 30,000 BDT
  enableStudentWing: boolean;
  studentWingNameBn: string;
  enableEventsModule: boolean;
  themePreset: ThemePreset;
  heroImageUrl?: string;
  articles: OrganizationArticles;
  founders: FounderEntry[];
}

// ====================================================================
// EVENT & PARTICIPATION MANAGEMENT MODULE ("অনুষ্ঠান ও আয়োজন")
// ====================================================================

export type EventStatus = 'draft' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled' | 'archived';
export type EventType = 'reunion' | 'iftar' | 'picnic' | 'agm' | 'seminar' | 'welfare' | 'general';

export interface EventItem {
  id: string;
  code: string; // EVT-2026-001
  title: string;
  eventType: EventType;
  summary: string;
  description: string;
  venue: string;
  eventDate: string; // ISO or YYYY-MM-DD HH:mm
  registrationDeadline?: string;
  status: EventStatus;
  isPublished: boolean;
  registrationOpen: boolean;
  allowPayLater: boolean;
  showParticipantCount: boolean;
  maxCapacity?: number;
  paymentInstructions: string;
  coverImageUrl?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EventFeeCategory {
  id: string;
  eventId: string;
  titleBn: string;
  descriptionBn: string;
  feeAmount: number; // >= 0 (supports ৳0 free exemption)
  maxQtyPerApplication: number;
  priority: number;
  isActive: boolean;
}

export interface EventCategoryBreakdownItem {
  categoryId: string;
  titleBn: string;
  unitFee: number; // Frozen fee snapshot at application submit time
  quantity: number;
  lineTotal: number;
}

export type EventApplicationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type EventPaymentStatus = 'unpaid' | 'submitted' | 'verified' | 'rejected' | 'refunded' | 'exempt';
export type EventPaymentMethod = 'bkash' | 'nagad' | 'rocket' | 'bank' | 'cash' | 'other';

export interface EventApplication {
  id: string;
  eventId: string;
  registrationCode: string; // EVT-2026-XXXXXX
  applicantNameBn: string;
  applicantNameEn?: string;
  phone: string;
  email?: string;
  organizationOrAddress: string;
  membershipIdRef?: string;
  categoryBreakdown: EventCategoryBreakdownItem[];
  totalParticipants: number;
  totalFee: number;
  applicationStatus: EventApplicationStatus;
  paymentStatus: EventPaymentStatus;
  paymentMethod?: EventPaymentMethod;
  transactionId?: string;
  paidAmount: number;
  refundAmount: number;
  paymentNote?: string;
  refundReason?: string;
  notes?: string;
  isSpotEntry?: boolean;
  reviewedByName?: string;
  reviewedAt?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  refundedByName?: string;
  refundedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type EventLedgerEntryType = 'donation' | 'expense';

export interface EventLedgerEntry {
  id: string;
  eventId: string;
  entryCode: string; // EVL-2026-0001
  entryType: EventLedgerEntryType;
  title: string;
  category: string;
  partyName: string;
  paymentMethod: EventPaymentMethod;
  referenceNo?: string;
  amount: number;
  notes?: string;
  entryDate: string;
  createdByName: string;
  createdAt: string;
}

export interface EventApplicationLog {
  id: string;
  eventId: string;
  applicationId?: string;
  action: string;
  actorRole: Role;
  actorName: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface EventDashboardStats {
  totalApplications: number;
  approvedApplications: number;
  pendingApplications: number;
  rejectedApplications: number;
  totalRegisteredParticipants: number;
  approvedParticipants: number;
  expectedTotalFee: number;
  unpaidApplicationsCount: number;
  submittedPaymentsCount: number;
  verifiedPaymentsCount: number;
  grossVerifiedCollection: number;
  refundedCount: number;
  totalRefundedAmount: number;
  eventDonationsTotal: number;
  eventExpensesTotal: number;
  eventNetFundBalance: number;
  categorySummary: {
    categoryId: string;
    titleBn: string;
    unitFee: number;
    registeredParticipants: number;
    approvedParticipants: number;
    expectedFeeTotal: number;
  }[];
  paymentMethodSummary: {
    method: string;
    verifiedCount: number;
    verifiedAmount: number;
  }[];
}

