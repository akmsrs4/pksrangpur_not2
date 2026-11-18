/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../db/store.ts';
import {
  CalendarDays,
  Plus,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  RotateCcw,
  FileSpreadsheet,
  Printer,
  Settings,
  Trash2,
  SlidersHorizontal,
  History,
  UserPlus,
  Search,
  Lock,
  AlertCircle,
  Wallet,
  Banknote,
  Edit3,
  X,
} from 'lucide-react';
import {
  EventApplication,
  EventApplicationStatus,
  EventFeeCategory,
  EventItem,
  EventLedgerEntryType,
  EventPaymentMethod,
  EventPaymentStatus,
  EventStatus,
  EventType,
} from '../../types.ts';
import { toDateTimeLocalValue, toIsoTimestamp, formatEventDateBn } from '../../utils/dateFormat.ts';

type EventSubTab = 'dashboard' | 'applications' | 'categories' | 'ledger' | 'reports' | 'logs';

type EventReportType =
  | 'full_summary'
  | 'category_breakdown'
  | 'approved_attendance'
  | 'all_applications'
  | 'payment_methods'
  | 'due_pay_later'
  | 'refund_report'
  | 'donor_spot_income'
  | 'event_ledger_statement';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  reunion: 'পুনর্মিলনী / মিলনমেলা',
  iftar: 'ইফতার ও দোয়া মাহফিল',
  picnic: 'বনভোজন / শিক্ষা সফর',
  agm: 'বার্ষিক সাধারণ সভা (AGM)',
  seminar: 'সেমিনার / সংবর্ধনা',
  welfare: 'মানবিক ও কল্যাণ কর্মসূচি',
  general: 'সাধারণ অনুষ্ঠান / আয়োজন',
};

const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'খসড়া (Draft)',
  upcoming: 'আসন্ন (Upcoming)',
  ongoing: 'চলমান (Ongoing)',
  completed: 'সম্পন্ন (Completed)',
  cancelled: 'বাতিল (Cancelled)',
  archived: 'আর্কাইভড (Archived)',
};

const APP_STATUS_LABELS: Record<EventApplicationStatus, string> = {
  pending: 'অপেক্ষমাণ',
  approved: 'অনুমোদিত',
  rejected: 'প্রত্যাখ্যাত',
  cancelled: 'বাতিল',
};

const PAY_STATUS_LABELS: Record<EventPaymentStatus, string> = {
  unpaid: 'বকেয়া / পরে দেবেন',
  submitted: 'যাচাইয়ের অপেক্ষায়',
  verified: 'ভেরিফায়েড',
  rejected: 'পেমেন্ট প্রত্যাখ্যাত',
  refunded: 'রিফান্ডকৃত',
  exempt: 'ফ্রি / প্রযোজ্য নয়',
};

const PAY_METHOD_LABELS: Record<EventPaymentMethod, string> = {
  bkash: 'বিকাশ (bKash)',
  nagad: 'নগদ (Nagad)',
  rocket: 'রকেট (Rocket)',
  bank: 'ব্যাংক ট্রান্সফার',
  cash: 'নগদ ক্যাশ / হাতে হাতে',
  other: 'অন্যান্য',
};

const REPORT_LABELS: Record<EventReportType, string> = {
  full_summary: '১. সম্পূর্ণ ১৬-মেট্রিক অনুষ্ঠান ও ফান্ড সারসংক্ষেপ',
  category_breakdown: '২. ক্যাটাগরি-ভিত্তিক অংশগ্রহণ ও ফি বিশ্লেষণ',
  approved_attendance: '৩. অনুমোদিত উপস্থিতি তালিকা (Check-in Roster)',
  all_applications: '৪. সকল আবেদন ও পেমেন্ট মাস্টার তালিকা',
  payment_methods: '৫. পেমেন্ট মাধ্যম অনুযায়ী সংগ্রহ প্রতিবেদন',
  due_pay_later: '৬. বকেয়া / পরে পরিশোধযোগ্য তালিকা (Pay-Later)',
  refund_report: '৭. রিফান্ড ও বাতিলকৃত পেমেন্ট প্রতিবেদন',
  donor_spot_income: '৮. ডোনার অনুদান ও স্পট সংগ্রহ প্রতিবেদন',
  event_ledger_statement: '৯. আলাদা অনুষ্ঠান ফান্ডের পূর্ণাঙ্গ আয়-ব্যয় বিবরণী',
};

export const AdminEventsView: React.FC = () => {
  const store = useAppStore();
  const perms = store.getEffectivePermissions();
  const isSuperAdmin = store.currentUser.role === 'super_admin';

  const canViewModule = Boolean(
    isSuperAdmin || perms.can_event_view_module || perms.can_event_create || perms.can_event_view_applications
  );
  const canCreateEvent = Boolean(isSuperAdmin || perms.can_event_create);
  const canEditEvent = Boolean(isSuperAdmin || perms.can_event_edit || perms.can_event_manage_settings);
  const canManageCategories = Boolean(isSuperAdmin || perms.can_event_manage_categories);
  const canViewApps = Boolean(isSuperAdmin || perms.can_event_view_applications);
  const canApproveApps = Boolean(isSuperAdmin || perms.can_event_approve_application);
  const canVerifyPayment = Boolean(isSuperAdmin || perms.can_event_verify_payment);
  const canManageRefund = Boolean(isSuperAdmin || perms.can_event_manage_refund);
  const canManageLedger = Boolean(isSuperAdmin || perms.can_event_manage_ledger);
  const canViewFinance = Boolean(isSuperAdmin || perms.can_event_view_finance_summary || perms.can_event_manage_ledger);
  const canDeleteTest = Boolean(isSuperAdmin || perms.can_event_delete_test_data);
  const canExportReports = Boolean(isSuperAdmin || perms.can_event_export_reports);
  const canViewLogs = Boolean(isSuperAdmin || perms.can_event_view_logs);

  const [selectedEventId, setSelectedEventId] = useState<string>(() => store.events[0]?.id || '');
  const [subTab, setSubTab] = useState<EventSubTab>('dashboard');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create/Edit Event Modal
  const [eventModalMode, setEventModalMode] = useState<'create' | 'edit' | null>(null);
  const [evTitle, setEvTitle] = useState('');
  const [evType, setEvType] = useState<EventType>('reunion');
  const [evSummary, setEvSummary] = useState('');
  const [evDescription, setEvDescription] = useState('');
  const [evVenue, setEvVenue] = useState('');
  const [evDate, setEvDate] = useState('');
  const [evDeadline, setEvDeadline] = useState('');
  const [evStatus, setEvStatus] = useState<EventStatus>('upcoming');
  const [evPublished, setEvPublished] = useState(true);
  const [evRegOpen, setEvRegOpen] = useState(true);
  const [evAllowPayLater, setEvAllowPayLater] = useState(true);
  const [evShowCount, setEvShowCount] = useState(true);
  const [evCapacity, setEvCapacity] = useState('');
  const [evPayInstructions, setEvPayInstructions] = useState(
    'চাইলে পরে অনুষ্ঠানস্থলে নগদ দিতে পারবেন অথবা বিকাশ/নগদ নম্বর ০১৭১১-XXXXXX এ সেন্ড মানি করে ট্রানজেকশন আইডি দিন।'
  );
  const [confirmDeleteEventId, setConfirmDeleteEventId] = useState<string | null>(null);

  // Category Form State
  const [catTitle, setCatTitle] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catFee, setCatFee] = useState('0');
  const [catMaxQty, setCatMaxQty] = useState('10');
  const [catPriority, setCatPriority] = useState('1');
  const [editingCat, setEditingCat] = useState<EventFeeCategory | null>(null);

  // Applications Filters & Modals
  const [appSearch, setAppSearch] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState<'all' | EventApplicationStatus>('all');
  const [payStatusFilter, setPayStatusFilter] = useState<'all' | EventPaymentStatus>('all');
  const [spotFilter, setSpotFilter] = useState<'all' | 'spot' | 'online'>('all');
  const [confirmDeleteAppId, setConfirmDeleteAppId] = useState<string | null>(null);

  // Payment Verify / Record Modal
  const [verifyTargetApp, setVerifyTargetApp] = useState<EventApplication | null>(null);
  const [verifyMethod, setVerifyMethod] = useState<EventPaymentMethod>('cash');
  const [verifyTxnId, setVerifyTxnId] = useState('');
  const [verifyAmount, setVerifyAmount] = useState('');
  const [verifyNote, setVerifyNote] = useState('');

  // Refund Modal
  const [refundTargetApp, setRefundTargetApp] = useState<EventApplication | null>(null);
  const [refundAmt, setRefundAmt] = useState('');
  const [refundReason, setRefundReason] = useState('');

  // Spot / Walk-in Registration Modal
  const [spotModalOpen, setSpotModalOpen] = useState(false);
  const [spotName, setSpotName] = useState('');
  const [spotPhone, setSpotPhone] = useState('');
  const [spotAddress, setSpotAddress] = useState('');
  const [spotMemberId, setSpotMemberId] = useState('');
  const [spotQuantities, setSpotQuantities] = useState<Record<string, number>>({});
  const [spotPayStatus, setSpotPayStatus] = useState<'verified' | 'unpaid'>('verified');
  const [spotMethod, setSpotMethod] = useState<EventPaymentMethod>('cash');
  const [spotTxnId, setSpotTxnId] = useState('');
  const [spotAutoApprove, setSpotAutoApprove] = useState(true);
  const [spotNotes, setSpotNotes] = useState('');

  // Dedicated Event Ledger Form
  const [ledgerType, setLedgerType] = useState<EventLedgerEntryType>('donation');
  const [ledgerTitle, setLedgerTitle] = useState('');
  const [ledgerCategory, setLedgerCategory] = useState('ডোনার / স্পন্সর অনুদান');
  const [ledgerParty, setLedgerParty] = useState('');
  const [ledgerMethod, setLedgerMethod] = useState<EventPaymentMethod>('cash');
  const [ledgerRef, setLedgerRef] = useState('');
  const [ledgerAmt, setLedgerAmt] = useState('');
  const [ledgerDate, setLedgerDate] = useState(new Date().toISOString().substring(0, 10));
  const [ledgerNotes, setLedgerNotes] = useState('');
  const [confirmDeleteLedgerId, setConfirmDeleteLedgerId] = useState<string | null>(null);

  // Report Selection
  const [selectedReport, setSelectedReport] = useState<EventReportType>('full_summary');

  const selectedEvent: EventItem | undefined = useMemo(
    () => store.events.find((e) => e.id === selectedEventId) || store.events[0],
    [store.events, selectedEventId]
  );

  const eventCategories = useMemo(
    () =>
      selectedEvent
        ? store.eventCategories.filter((c) => c.eventId === selectedEvent.id).sort((a, b) => a.priority - b.priority)
        : [],
    [store.eventCategories, selectedEvent]
  );

  const eventApps = useMemo(
    () => (selectedEvent ? store.eventApplications.filter((a) => a.eventId === selectedEvent.id) : []),
    [store.eventApplications, selectedEvent]
  );

  const eventLedger = useMemo(
    () => (selectedEvent ? store.eventLedgerEntries.filter((l) => l.eventId === selectedEvent.id) : []),
    [store.eventLedgerEntries, selectedEvent]
  );

  const eventLogs = useMemo(
    () => (selectedEvent ? store.eventLogs.filter((l) => l.eventId === selectedEvent.id) : []),
    [store.eventLogs, selectedEvent]
  );

  const stats = useMemo(
    () => (selectedEvent ? store.getEventDashboardStats(selectedEvent.id) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedEvent, store.eventApplications, store.eventLedgerEntries, store.eventCategories]
  );

  const filteredApps = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    return eventApps.filter((a) => {
      if (appStatusFilter !== 'all' && a.applicationStatus !== appStatusFilter) return false;
      if (payStatusFilter !== 'all' && a.paymentStatus !== payStatusFilter) return false;
      if (spotFilter === 'spot' && !a.isSpotEntry) return false;
      if (spotFilter === 'online' && a.isSpotEntry) return false;
      if (!q) return true;
      return (
        a.applicantNameBn.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q) ||
        a.registrationCode.toLowerCase().includes(q) ||
        (a.transactionId || '').toLowerCase().includes(q) ||
        a.organizationOrAddress.toLowerCase().includes(q)
      );
    });
  }, [eventApps, appSearch, appStatusFilter, payStatusFilter, spotFilter]);

  if (!canViewModule) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
        <Lock className="w-12 h-12 text-stone-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-stone-900">অনুষ্ঠান ও আয়োজন মডিউল সংরক্ষিত</h3>
        <p className="text-xs text-stone-500 mt-1">
          এই মডিউল ব্যবহার করার জন্য সুপার অ্যাডমিনের পক্ষ থেকে অনুমতি প্রদান করা হয়নি।
        </p>
      </div>
    );
  }

  const openCreateEventModal = () => {
    setEventModalMode('create');
    setEvTitle('');
    setEvType('reunion');
    setEvSummary('');
    setEvDescription('');
    setEvVenue('রংপুর টাউন হল / নির্ধারিত স্থান');
    setEvDate('');
    setEvDeadline('');
    setEvStatus('upcoming');
    setEvPublished(true);
    setEvRegOpen(true);
    setEvAllowPayLater(true);
    setEvShowCount(true);
    setEvCapacity('');
    setEvPayInstructions(
      'উপস্থিতি নিশ্চিত করতে ফর্ম পূরণ করুন। চাইলে পরে অনুষ্ঠানস্থলে ফি জমা দিতে পারবেন অথবা বিকাশ/নগদ ট্রানজেকশন আইডি দিয়ে জমা দিতে পারেন।'
    );
  };

  const openEditEventModal = (ev: EventItem) => {
    setEventModalMode('edit');
    setEvTitle(ev.title);
    setEvType(ev.eventType);
    setEvSummary(ev.summary);
    setEvDescription(ev.description);
    setEvVenue(ev.venue);
    setEvDate(toDateTimeLocalValue(ev.eventDate));
    setEvDeadline(toDateTimeLocalValue(ev.registrationDeadline));
    setEvStatus(ev.status);
    setEvPublished(ev.isPublished);
    setEvRegOpen(ev.registrationOpen);
    setEvAllowPayLater(ev.allowPayLater);
    setEvShowCount(ev.showParticipantCount);
    setEvCapacity(ev.maxCapacity ? String(ev.maxCapacity) : '');
    setEvPayInstructions(ev.paymentInstructions);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const payload = {
      title: evTitle,
      eventType: evType,
      summary: evSummary,
      description: evDescription,
      venue: evVenue,
      eventDate: toIsoTimestamp(evDate),
      registrationDeadline: evDeadline ? toIsoTimestamp(evDeadline) : undefined,
      status: evStatus,
      isPublished: evPublished,
      registrationOpen: evRegOpen,
      allowPayLater: evAllowPayLater,
      showParticipantCount: evShowCount,
      maxCapacity: evCapacity ? Number(evCapacity) : undefined,
      paymentInstructions: evPayInstructions,
    };

    if (eventModalMode === 'create') {
      const res = store.addEvent(payload);
      if (res.success && res.event) {
        setSelectedEventId(res.event.id);
        setEventModalMode(null);
        setFeedback({ type: 'success', text: `নতুন অনুষ্ঠান "${res.event.title}" সফলভাবে তৈরি হয়েছে।` });
      } else {
        setFeedback({ type: 'error', text: res.error || 'অনুষ্ঠান তৈরি ব্যর্থ হয়েছে।' });
      }
    } else if (eventModalMode === 'edit' && selectedEvent) {
      const res = store.updateEvent(selectedEvent.id, payload);
      if (res.success) {
        setEventModalMode(null);
        setFeedback({ type: 'success', text: 'অনুষ্ঠানের তথ্য ও সেটিংস হালনাগাদ করা হয়েছে।' });
      } else {
        setFeedback({ type: 'error', text: res.error || 'হালনাগাদ ব্যর্থ হয়েছে।' });
      }
    }
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setFeedback(null);
    if (editingCat) {
      const res = store.updateEventCategory(editingCat.id, {
        titleBn: catTitle,
        descriptionBn: catDesc,
        feeAmount: Number(catFee || 0),
        maxQtyPerApplication: Number(catMaxQty || 10),
        priority: Number(catPriority || 1),
      });
      if (res.success) {
        setEditingCat(null);
        setCatTitle('');
        setCatDesc('');
        setCatFee('0');
        setFeedback({ type: 'success', text: 'ক্যাটাগরি হালনাগাদ হয়েছে (পূর্বের আবেদনের ফি অপরিবর্তিত)।' });
      } else {
        setFeedback({ type: 'error', text: res.error || 'ত্রুটি হয়েছে।' });
      }
    } else {
      const res = store.addEventCategory({
        eventId: selectedEvent.id,
        titleBn: catTitle,
        descriptionBn: catDesc,
        feeAmount: Number(catFee || 0),
        maxQtyPerApplication: Number(catMaxQty || 10),
        priority: Number(catPriority || eventCategories.length + 1),
        isActive: true,
      });
      if (res.success) {
        setCatTitle('');
        setCatDesc('');
        setCatFee('0');
        setCatPriority(String(eventCategories.length + 2));
        setFeedback({ type: 'success', text: 'নতুন অংশগ্রহণের ধরন ও ফি যুক্ত করা হয়েছে।' });
      } else {
        setFeedback({ type: 'error', text: res.error || 'ত্রুটি হয়েছে।' });
      }
    }
  };

  const openVerifyModal = (app: EventApplication) => {
    setVerifyTargetApp(app);
    setVerifyMethod(app.paymentMethod || 'cash');
    setVerifyTxnId(app.transactionId || '');
    setVerifyAmount(String(app.paidAmount > 0 ? app.paidAmount : app.totalFee));
    setVerifyNote(app.paymentNote || '');
  };

  const handleVerifySubmit = (action: 'verify' | 'reject') => {
    if (!verifyTargetApp) return;
    setFeedback(null);
    const res = store.verifyOrRecordEventPayment({
      appId: verifyTargetApp.id,
      action: action === 'reject' ? 'reject' : verifyTargetApp.paymentStatus === 'submitted' ? 'verify' : 'record_and_verify',
      paymentMethod: verifyMethod,
      transactionId: verifyTxnId,
      paidAmount: Number(verifyAmount || 0),
      note: verifyNote,
    });
    if (res.success) {
      setVerifyTargetApp(null);
      setFeedback({
        type: 'success',
        text: action === 'reject' ? 'পেমেন্ট তথ্য প্রত্যাখ্যান করা হয়েছে।' : 'পেমেন্ট সফলভাবে যাচাই ও অনুষ্ঠান ফান্ডে যুক্ত হয়েছে।',
      });
    } else {
      setFeedback({ type: 'error', text: res.error || 'পেমেন্ট যাচাই ব্যর্থ।' });
    }
  };

  const handleRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTargetApp) return;
    setFeedback(null);
    const res = store.refundEventPayment(refundTargetApp.id, refundReason, Number(refundAmt));
    if (res.success) {
      setRefundTargetApp(null);
      setRefundReason('');
      setRefundAmt('');
      setFeedback({
        type: 'success',
        text: 'রিফান্ড সম্পন্ন হয়েছে এবং স্বয়ংক্রিয়ভাবে অনুষ্ঠান ফান্ড থেকে সমন্বয় করা হয়েছে (মূল সমিতির হিসাব অপরিবর্তিত)।',
      });
    } else {
      setFeedback({ type: 'error', text: res.error || 'রিফান্ড ব্যর্থ হয়েছে।' });
    }
  };

  const handleSpotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setFeedback(null);
    const quantities = Object.entries(spotQuantities)
      .filter(([, q]) => q > 0)
      .map(([categoryId, quantity]) => ({ categoryId, quantity }));
    const res = store.addSpotEventApplication({
      eventId: selectedEvent.id,
      applicantNameBn: spotName,
      phone: spotPhone,
      organizationOrAddress: spotAddress,
      membershipIdRef: spotMemberId,
      quantities,
      paymentStatus: spotPayStatus,
      paymentMethod: spotPayStatus === 'verified' ? spotMethod : undefined,
      transactionId: spotTxnId,
      autoApproveApplication: spotAutoApprove,
      notes: spotNotes,
    });
    if (res.success && res.application) {
      setSpotModalOpen(false);
      setSpotName('');
      setSpotPhone('');
      setSpotAddress('');
      setSpotMemberId('');
      setSpotQuantities({});
      setSpotTxnId('');
      setSpotNotes('');
      setFeedback({
        type: 'success',
        text: `স্পট নিবন্ধন ${res.application.registrationCode} সফলভাবে যুক্ত হয়েছে।`,
      });
    } else {
      setFeedback({ type: 'error', text: res.error || 'স্পট নিবন্ধন ব্যর্থ।' });
    }
  };

  const handleAddLedger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setFeedback(null);
    const res = store.addEventLedgerEntry({
      eventId: selectedEvent.id,
      entryType: ledgerType,
      title: ledgerTitle,
      category: ledgerCategory,
      partyName: ledgerParty,
      paymentMethod: ledgerMethod,
      referenceNo: ledgerRef,
      amount: Number(ledgerAmt || 0),
      entryDate: ledgerDate,
      notes: ledgerNotes,
    });
    if (res.success && res.entry) {
      setLedgerTitle('');
      setLedgerParty('');
      setLedgerRef('');
      setLedgerAmt('');
      setLedgerNotes('');
      setFeedback({
        type: 'success',
        text: `অনুষ্ঠান ফান্ড এন্ট্রি ${res.entry.entryCode} সংরক্ষিত হয়েছে।`,
      });
    } else {
      setFeedback({ type: 'error', text: res.error || 'লেজার এন্ট্রি ব্যর্থ।' });
    }
  };

  const escapeCsv = (val: unknown) => {
    const raw = String(val ?? '');
    const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${neutralized.replace(/"/g, '""')}"`;
  };

  const handleDownloadCSVReport = () => {
    if (!selectedEvent || !stats || !canExportReports) return;
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (selectedReport === 'full_summary') {
      headers = ['Metric', 'Value'];
      rows = [
        ['Event Code', selectedEvent.code],
        ['Event Title', selectedEvent.title],
        ['Total Applications', stats.totalApplications],
        ['Approved Applications', stats.approvedApplications],
        ['Pending Applications', stats.pendingApplications],
        ['Rejected Applications', stats.rejectedApplications],
        ['Total Registered Participants', stats.totalRegisteredParticipants],
        ['Approved Participants', stats.approvedParticipants],
        ['Expected Total Fee (BDT)', stats.expectedTotalFee],
        ['Unpaid/Pay-Later Count', stats.unpaidApplicationsCount],
        ['Submitted Payments Count', stats.submittedPaymentsCount],
        ['Verified Payments Count', stats.verifiedPaymentsCount],
        ['Gross Verified Collection (BDT)', stats.grossVerifiedCollection],
        ['Refunded Count', stats.refundedCount],
        ['Total Refunded Amount (BDT)', stats.totalRefundedAmount],
        ['Event Donations / Spot Grants (BDT)', stats.eventDonationsTotal],
        ['Event Expenses (BDT)', stats.eventExpensesTotal],
        ['Net Event Fund Balance (BDT)', stats.eventNetFundBalance],
      ];
    } else if (selectedReport === 'category_breakdown') {
      headers = ['Category', 'Unit Fee', 'Registered Qty', 'Approved Qty', 'Expected Fee'];
      rows = stats.categorySummary.map((c) => [
        c.titleBn,
        c.unitFee,
        c.registeredParticipants,
        c.approvedParticipants,
        c.expectedFeeTotal,
      ]);
    } else if (selectedReport === 'payment_methods') {
      headers = ['Payment Method', 'Verified Count', 'Verified Amount'];
      rows = stats.paymentMethodSummary.map((m) => [m.method, m.verifiedCount, m.verifiedAmount]);
    } else if (selectedReport === 'donor_spot_income' || selectedReport === 'event_ledger_statement') {
      headers = ['Entry Code', 'Type', 'Date', 'Title', 'Category', 'Party', 'Method', 'Reference', 'Amount'];
      const filteredLedger =
        selectedReport === 'donor_spot_income'
          ? eventLedger.filter((l) => l.entryType === 'donation')
          : eventLedger;
      rows = filteredLedger.map((l) => [
        l.entryCode,
        l.entryType,
        l.entryDate,
        l.title,
        l.category,
        l.partyName,
        l.paymentMethod,
        l.referenceNo || '',
        l.amount,
      ]);
    } else {
      headers = [
        'Registration Code',
        'Name',
        'Phone',
        'Address/Org',
        'Membership ID',
        'Participants',
        'Total Fee',
        'App Status',
        'Payment Status',
        'Method',
        'Transaction ID',
        'Paid Amount',
        'Refund Amount',
        'Spot Entry',
        'Created At',
      ];
      const subset = eventApps.filter((a) => {
        if (selectedReport === 'approved_attendance') return a.applicationStatus === 'approved';
        if (selectedReport === 'due_pay_later') return a.paymentStatus === 'unpaid' && a.applicationStatus !== 'rejected';
        if (selectedReport === 'refund_report') return a.paymentStatus === 'refunded';
        return true;
      });
      rows = subset.map((a) => [
        a.registrationCode,
        a.applicantNameBn,
        a.phone,
        a.organizationOrAddress,
        a.membershipIdRef || '',
        a.totalParticipants,
        a.totalFee,
        a.applicationStatus,
        a.paymentStatus,
        a.paymentMethod || '',
        a.transactionId || '',
        a.paidAmount,
        a.refundAmount,
        a.isSpotEntry ? 'Yes' : 'No',
        a.createdAt,
      ]);
    }

    const csvBody = [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvBody], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedEvent.code}_${selectedReport}_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = () => {
    if (!canExportReports || !selectedEvent) return;
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print-Only Event Report Document */}
      {canExportReports && selectedEvent && stats && (
        <div className="print-only space-y-5 text-stone-900">
          <div className="border-b-2 border-stone-900 pb-3 text-center space-y-1">
            <h1 className="text-xl font-bold">{store.settings.organizationNameBn}</h1>
            <p className="text-xs text-stone-600">{store.settings.officeAddress}</p>
            <div className="text-sm font-bold pt-1">
              অনুষ্ঠান প্রতিবেদন: {selectedEvent.title} ({selectedEvent.code})
            </div>
            <div className="text-xs font-semibold text-stone-700">{REPORT_LABELS[selectedReport]}</div>
            <div className="text-[11px] text-stone-500">
              প্রকাশ তারিখ: {new Date().toISOString().substring(0, 10)} | প্রস্তুতকারক: {store.currentUser.name}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 border border-stone-300 rounded">
              <div className="text-stone-500">মোট নিবন্ধিত জনসংখ্যা</div>
              <div className="font-bold text-sm">{stats.totalRegisteredParticipants} জন ({stats.totalApplications} আবেদন)</div>
            </div>
            <div className="p-2.5 border border-stone-300 rounded">
              <div className="text-stone-500">অনুমোদিত উপস্থিতি</div>
              <div className="font-bold text-sm text-emerald-800">{stats.approvedParticipants} জন</div>
            </div>
            <div className="p-2.5 border border-stone-300 rounded">
              <div className="text-stone-500">যাচাইকৃত আয় + অনুদান</div>
              <div className="font-bold text-sm">
                ৳{(stats.grossVerifiedCollection + stats.eventDonationsTotal).toLocaleString()}
              </div>
            </div>
            <div className="p-2.5 border border-stone-300 rounded">
              <div className="text-stone-500">নিট অনুষ্ঠান ফান্ড</div>
              <div className="font-bold text-sm text-emerald-900">৳{stats.eventNetFundBalance.toLocaleString()}</div>
            </div>
          </div>

          <table className="w-full border border-stone-300 text-[11px]">
            <thead className="bg-stone-100">
              <tr>
                <th className="p-1.5 text-left border-b border-stone-300">কোড</th>
                <th className="p-1.5 text-left border-b border-stone-300">নাম ও মোবাইল</th>
                <th className="p-1.5 text-right border-b border-stone-300">জনসংখ্যা</th>
                <th className="p-1.5 text-right border-b border-stone-300">মোট ফি</th>
                <th className="p-1.5 text-left border-b border-stone-300">উপস্থিতি</th>
                <th className="p-1.5 text-left border-b border-stone-300">পেমেন্ট</th>
                <th className="p-1.5 text-right border-b border-stone-300">জমা/রিফান্ড</th>
              </tr>
            </thead>
            <tbody>
              {eventApps
                .filter((a) => {
                  if (selectedReport === 'approved_attendance') return a.applicationStatus === 'approved';
                  if (selectedReport === 'due_pay_later') return a.paymentStatus === 'unpaid';
                  if (selectedReport === 'refund_report') return a.paymentStatus === 'refunded';
                  return true;
                })
                .map((a) => (
                  <tr key={a.id} className="border-b border-stone-200">
                    <td className="p-1.5 font-mono">{a.registrationCode}</td>
                    <td className="p-1.5">
                      {a.applicantNameBn} ({a.phone})
                    </td>
                    <td className="p-1.5 text-right">{a.totalParticipants}</td>
                    <td className="p-1.5 text-right">৳{a.totalFee.toLocaleString()}</td>
                    <td className="p-1.5">{APP_STATUS_LABELS[a.applicationStatus]}</td>
                    <td className="p-1.5">{PAY_STATUS_LABELS[a.paymentStatus]}</td>
                    <td className="p-1.5 text-right">
                      ৳{a.paidAmount.toLocaleString()}
                      {a.refundAmount > 0 ? ` (-৳${a.refundAmount.toLocaleString()})` : ''}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Header & Event Selector */}
      <div className="no-print bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-emerald-700" />
              <span>অনুষ্ঠান ও আয়োজন ব্যবস্থাপনা (Event & Participation Module)</span>
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              উপস্থিতি-ভিত্তিক নিবন্ধন (পেমেন্ট ঐচ্ছিক), স্পট এন্ট্রি, এবং মূল সমিতির হিসাব থেকে সম্পূর্ণ আলাদা অনুষ্ঠান ফান্ড।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canCreateEvent && (
              <button
                type="button"
                onClick={openCreateEventModal}
                className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>নতুন অনুষ্ঠান তৈরি করুন</span>
              </button>
            )}
          </div>
        </div>

        {/* Event Selector Bar */}
        {store.events.length > 0 && (
          <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <span className="text-xs font-bold text-stone-600">চলমান / নির্বাচিত অনুষ্ঠান:</span>
              <select
                value={selectedEvent?.id || ''}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="px-3 py-2 text-xs font-bold border border-stone-300 rounded-xl bg-stone-50 text-stone-900 min-w-[240px]"
              >
                {store.events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    [{ev.code}] {ev.title} — {EVENT_STATUS_LABELS[ev.status]}
                  </option>
                ))}
              </select>
              {selectedEvent && (
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    selectedEvent.isPublished
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {selectedEvent.isPublished ? 'পাবলিক সাইটে দৃশ্যমান' : 'অপ্রকাশিত (Draft/Hidden)'}
                </span>
              )}
            </div>

            {selectedEvent && (
              <div className="flex items-center gap-2">
                {canEditEvent && (
                  <button
                    type="button"
                    onClick={() => openEditEventModal(selectedEvent)}
                    className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>সম্পাদনা / সেটিংস</span>
                  </button>
                )}
                {canDeleteTest && (
                  confirmDeleteEventId === selectedEvent.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const res = store.deleteEvent(selectedEvent.id);
                          setConfirmDeleteEventId(null);
                          if (res.success) {
                            setFeedback({ type: 'success', text: 'অনুষ্ঠানটি নিরাপদভাবে মুছে ফেলা হয়েছে।' });
                          } else {
                            setFeedback({ type: 'error', text: res.error || 'মোছা যায়নি।' });
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-red-700 text-white text-xs font-bold cursor-pointer"
                      >
                        নিশ্চিত মুছুন
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteEventId(null)}
                        className="px-2.5 py-1.5 rounded-lg bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
                      >
                        না
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteEventId(selectedEvent.id)}
                      className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>মুছুন</span>
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="text-stone-500 hover:text-stone-800 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Empty state if no events */}
      {!selectedEvent ? (
        <div className="no-print bg-white p-12 rounded-2xl border border-stone-200 text-center space-y-3">
          <CalendarDays className="w-12 h-12 text-emerald-700 mx-auto opacity-70" />
          <h3 className="text-base font-bold text-stone-900">এখনো কোনো অনুষ্ঠান তৈরি করা হয়নি</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            পুনর্মিলনী, ইফতার মাহফিল, বনভোজন বা বার্ষিক সাধারণ সভার উপস্থিতি ও আলাদা ফান্ড পরিচালনা করতে প্রথম অনুষ্ঠান তৈরি করুন।
          </p>
          {canCreateEvent && (
            <button
              type="button"
              onClick={openCreateEventModal}
              className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>প্রথম অনুষ্ঠান তৈরি করুন</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Module Sub-Navigation */}
          <div className="no-print flex flex-wrap gap-2 bg-white p-2.5 rounded-2xl border border-stone-200">
            <button
              onClick={() => setSubTab('dashboard')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                subTab === 'dashboard' ? 'bg-emerald-800 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>ড্যাশবোর্ড ও পরিসংখ্যান</span>
            </button>

            {canViewApps && (
              <button
                onClick={() => setSubTab('applications')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  subTab === 'applications' ? 'bg-emerald-800 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>আবেদন ও উপস্থিতি ({eventApps.length})</span>
              </button>
            )}

            {canManageCategories && (
              <button
                onClick={() => setSubTab('categories')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  subTab === 'categories' ? 'bg-emerald-800 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>ক্যাটাগরি ও ফি ({eventCategories.length})</span>
              </button>
            )}

            {canViewFinance && (
              <button
                onClick={() => setSubTab('ledger')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  subTab === 'ledger' ? 'bg-emerald-800 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>আলাদা অনুষ্ঠান ফান্ড ({eventLedger.length})</span>
              </button>
            )}

            {canExportReports && (
              <button
                onClick={() => setSubTab('reports')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  subTab === 'reports' ? 'bg-emerald-800 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>৯টি রিপোর্ট (PDF/CSV)</span>
              </button>
            )}

            {canViewLogs && (
              <button
                onClick={() => setSubTab('logs')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  subTab === 'logs' ? 'bg-emerald-800 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>অডিট লগ ({eventLogs.length})</span>
              </button>
            )}
          </div>

          {/* SUBTAB 1: 16-METRIC DASHBOARD */}
          {subTab === 'dashboard' && stats && (
            <div className="no-print space-y-6">
              {/* Attendance & Applications KPIs */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-4">
                <h3 className="text-sm font-bold text-stone-900">উপস্থিতি ও আবেদন পরিসংখ্যান</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="text-[11px] text-stone-500">১. মোট আবেদন</div>
                    <div className="text-xl font-extrabold text-stone-900 mt-1">{stats.totalApplications}টি</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-[11px] text-emerald-800">২. অনুমোদিত আবেদন</div>
                    <div className="text-xl font-extrabold text-emerald-900 mt-1">{stats.approvedApplications}টি</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="text-[11px] text-amber-800">৩. অপেক্ষমাণ আবেদন</div>
                    <div className="text-xl font-extrabold text-amber-900 mt-1">{stats.pendingApplications}টি</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200">
                    <div className="text-[11px] text-red-700">৪. বাতিল/প্রত্যাখ্যাত</div>
                    <div className="text-xl font-extrabold text-red-800 mt-1">{stats.rejectedApplications}টি</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-900 text-white">
                    <div className="text-[11px] text-emerald-200">৫. মোট নিবন্ধিত জনসংখ্যা</div>
                    <div className="text-xl font-extrabold mt-1">{stats.totalRegisteredParticipants} জন</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-800 text-white">
                    <div className="text-[11px] text-amber-300">৬. অনুমোদিত উপস্থিতি</div>
                    <div className="text-xl font-extrabold mt-1">{stats.approvedParticipants} জন</div>
                  </div>
                </div>
              </div>

              {/* Financial KPIs (Gated by can_event_view_finance_summary) */}
              {canViewFinance ? (
                <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-stone-900">আলাদা অনুষ্ঠান ফান্ড ও সংগ্রহ (১০টি আর্থিক মেট্রিক)</h3>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                      মূল সমিতির হিসাব থেকে ১০০% বিচ্ছিন্ন
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                      <div className="text-[11px] text-stone-500">৭. প্রত্যাশিত মোট ফি</div>
                      <div className="text-lg font-bold text-stone-900 mt-1">৳{stats.expectedTotalFee.toLocaleString()}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                      <div className="text-[11px] text-stone-500">৮. পরে পরিশোধ/বকেয়া</div>
                      <div className="text-lg font-bold text-amber-700 mt-1">{stats.unpaidApplicationsCount}টি</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="text-[11px] text-amber-800">৯. পেমেন্ট যাচাই অপেক্ষমাণ</div>
                      <div className="text-lg font-bold text-amber-900 mt-1">{stats.submittedPaymentsCount}টি</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="text-[11px] text-emerald-800">১০. যাচাইকৃত পেমেন্ট</div>
                      <div className="text-lg font-bold text-emerald-900 mt-1">{stats.verifiedPaymentsCount}টি</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="text-[11px] text-emerald-800">১১. মোট ভেরিফায়েড সংগ্রহ</div>
                      <div className="text-lg font-bold text-emerald-900 mt-1">৳{stats.grossVerifiedCollection.toLocaleString()}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                      <div className="text-[11px] text-stone-500">১২. রিফান্ড সংখ্যা</div>
                      <div className="text-lg font-bold text-red-700 mt-1">{stats.refundedCount}টি</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200">
                      <div className="text-[11px] text-red-700">১৩. মোট রিফান্ড পরিমাণ</div>
                      <div className="text-lg font-bold text-red-800 mt-1">-৳{stats.totalRefundedAmount.toLocaleString()}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="text-[11px] text-emerald-800">১৪. ডোনার ও স্পট অনুদান</div>
                      <div className="text-lg font-bold text-emerald-900 mt-1">+৳{stats.eventDonationsTotal.toLocaleString()}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200">
                      <div className="text-[11px] text-red-700">১৫. অনুষ্ঠানের মোট ব্যয়</div>
                      <div className="text-lg font-bold text-red-800 mt-1">-৳{stats.eventExpensesTotal.toLocaleString()}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-emerald-950 text-white">
                      <div className="text-[11px] text-amber-300">১৬. নিট অনুষ্ঠান ফান্ড</div>
                      <div className="text-lg font-extrabold mt-1">৳{stats.eventNetFundBalance.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-stone-400" />
                  <span>অনুষ্ঠানের আর্থিক ও ফান্ড হিসাব দেখার অনুমতি আপনার নেই (শুধু উপস্থিতি পরিসংখ্যান প্রদর্শিত)।</span>
                </div>
              )}

              {/* Category Breakdown & Payment Methods */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-3">
                  <h4 className="text-sm font-bold text-stone-900">ক্যাটাগরি অনুযায়ী উপস্থিতি</h4>
                  {stats.categorySummary.length === 0 ? (
                    <p className="text-xs text-stone-500">কোনো অংশগ্রহণের ধরন তৈরি করা হয়নি।</p>
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
                        <tr>
                          <th className="py-2 px-2.5">ক্যাটাগরি</th>
                          <th className="py-2 px-2.5 text-right">নির্ধারিত ফি</th>
                          <th className="py-2 px-2.5 text-right">নিবন্ধিত</th>
                          <th className="py-2 px-2.5 text-right">অনুমোদিত</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {stats.categorySummary.map((c) => (
                          <tr key={c.categoryId}>
                            <td className="py-2 px-2.5 font-semibold">{c.titleBn}</td>
                            <td className="py-2 px-2.5 text-right font-mono">
                              {c.unitFee === 0 ? 'ফ্রি (৳০)' : `৳${c.unitFee.toLocaleString()}`}
                            </td>
                            <td className="py-2 px-2.5 text-right font-bold">{c.registeredParticipants} জন</td>
                            <td className="py-2 px-2.5 text-right font-bold text-emerald-700">
                              {c.approvedParticipants} জন
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {canViewFinance && (
                  <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-3">
                    <h4 className="text-sm font-bold text-stone-900">পেমেন্ট মাধ্যম অনুযায়ী যাচাইকৃত আদায়</h4>
                    {stats.paymentMethodSummary.length === 0 ? (
                      <p className="text-xs text-stone-500">এখনো কোনো পেমেন্ট ভেরিফাই করা হয়নি।</p>
                    ) : (
                      <div className="space-y-2">
                        {stats.paymentMethodSummary.map((m) => (
                          <div
                            key={m.method}
                            className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-stone-800">
                              {PAY_METHOD_LABELS[m.method as EventPaymentMethod] || m.method} ({m.verifiedCount}টি)
                            </span>
                            <span className="font-mono font-bold text-emerald-800">
                              ৳{m.verifiedAmount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUBTAB 2: APPLICATIONS & PAYMENT VERIFICATION */}
          {subTab === 'applications' && canViewApps && (
            <div className="no-print bg-white p-6 rounded-2xl border border-stone-200 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    অংশগ্রহণকারীদের আবেদন ও পেমেন্ট যাচাই ({filteredApps.length}টি)
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    উপস্থিতি অনুমোদন এবং পেমেন্ট যাচাই/আদায় আলাদাভাবে পরিচালনা করা যায়।
                  </p>
                </div>

                {(canApproveApps || canVerifyPayment) && (
                  <button
                    type="button"
                    onClick={() => {
                      const initQ: Record<string, number> = {};
                      if (eventCategories[0]) initQ[eventCategories[0].id] = 1;
                      setSpotQuantities(initQ);
                      setSpotModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start lg:self-auto"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ স্পট / ওয়াক-ইন নিবন্ধন</span>
                  </button>
                )}
              </div>

              {/* Filter Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="নাম, মোবাইল, কোড বা TxnID..."
                    value={appSearch}
                    onChange={(e) => setAppSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-xl bg-stone-50"
                  />
                </div>
                <select
                  value={appStatusFilter}
                  onChange={(e) => setAppStatusFilter(e.target.value as 'all' | EventApplicationStatus)}
                  className="px-3 py-2 text-xs border border-stone-300 rounded-xl bg-white"
                >
                  <option value="all">সব উপস্থিতি অবস্থা</option>
                  <option value="pending">অপেক্ষমাণ (Pending)</option>
                  <option value="approved">অনুমোদিত (Approved)</option>
                  <option value="rejected">প্রত্যাখ্যাত (Rejected)</option>
                  <option value="cancelled">বাতিল (Cancelled)</option>
                </select>
                <select
                  value={payStatusFilter}
                  onChange={(e) => setPayStatusFilter(e.target.value as 'all' | EventPaymentStatus)}
                  className="px-3 py-2 text-xs border border-stone-300 rounded-xl bg-white"
                >
                  <option value="all">সব পেমেন্ট অবস্থা</option>
                  <option value="unpaid">পরে দেবেন / বকেয়া</option>
                  <option value="submitted">যাচাইয়ের অপেক্ষায়</option>
                  <option value="verified">ভেরিফায়েড</option>
                  <option value="exempt">ফ্রি / প্রযোজ্য নয়</option>
                  <option value="refunded">রিফান্ডকৃত</option>
                  <option value="rejected">পেমেন্ট প্রত্যাখ্যাত</option>
                </select>
                <select
                  value={spotFilter}
                  onChange={(e) => setSpotFilter(e.target.value as 'all' | 'spot' | 'online')}
                  className="px-3 py-2 text-xs border border-stone-300 rounded-xl bg-white"
                >
                  <option value="all">অনলাইন ও স্পট সবগুলো</option>
                  <option value="online">শুধু অনলাইন আবেদন</option>
                  <option value="spot">শুধু স্পট / ওয়াক-ইন এন্ট্রি</option>
                </select>
              </div>

              {filteredApps.length === 0 ? (
                <div className="py-10 text-center text-xs text-stone-500">কোনো নিবন্ধন খুঁজে পাওয়া যায়নি।</div>
              ) : (
                <div className="space-y-3">
                  {filteredApps.map((app) => (
                    <div
                      key={app.id}
                      className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-stone-200 text-stone-800">
                            {app.registrationCode}
                          </span>
                          <span className="font-bold text-sm text-stone-900">{app.applicantNameBn}</span>
                          {app.isSpotEntry && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                              স্পট এন্ট্রি
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              app.applicationStatus === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : app.applicationStatus === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            উপস্থিতি: {APP_STATUS_LABELS[app.applicationStatus]}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              app.paymentStatus === 'verified'
                                ? 'bg-emerald-700 text-white'
                                : app.paymentStatus === 'submitted'
                                  ? 'bg-amber-600 text-white'
                                  : app.paymentStatus === 'refunded'
                                    ? 'bg-red-700 text-white'
                                    : app.paymentStatus === 'exempt'
                                      ? 'bg-sky-100 text-sky-800'
                                      : 'bg-stone-200 text-stone-700'
                            }`}
                          >
                            পেমেন্ট: {PAY_STATUS_LABELS[app.paymentStatus]}
                          </span>
                        </div>

                        <div className="text-xs text-stone-600 flex flex-wrap gap-x-4 gap-y-1">
                          <span>মোবাইল: <strong className="font-mono">{app.phone}</strong></span>
                          {app.organizationOrAddress && <span>ঠিকানা/প্রতিষ্ঠান: {app.organizationOrAddress}</span>}
                          <span>মোট জনসংখ্যা: <strong>{app.totalParticipants} জন</strong></span>
                          <span>প্রদেয় ফি: <strong>৳{app.totalFee.toLocaleString()}</strong></span>
                          {app.paidAmount > 0 && (
                            <span className="text-emerald-800 font-bold">
                              আদায়: ৳{app.paidAmount.toLocaleString()} ({app.paymentMethod || 'cash'}
                              {app.transactionId ? ` · Txn: ${app.transactionId}` : ''})
                            </span>
                          )}
                          {app.refundAmount > 0 && (
                            <span className="text-red-700 font-bold">
                              রিফান্ড: ৳{app.refundAmount.toLocaleString()} ({app.refundReason})
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {app.categoryBreakdown.map((item, idx) => (
                            <span
                              key={`${app.id}-${idx}`}
                              className="text-[11px] bg-white border border-stone-200 px-2 py-0.5 rounded text-stone-700"
                            >
                              {item.titleBn}: {item.quantity} × ৳{item.unitFee} = ৳{item.lineTotal}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Row Actions */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {canApproveApps && app.applicationStatus !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => store.updateEventApplicationStatus(app.id, 'approved')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>উপস্থিতি অনুমোদন</span>
                          </button>
                        )}
                        {canApproveApps && app.applicationStatus === 'pending' && (
                          <button
                            type="button"
                            onClick={() => store.updateEventApplicationStatus(app.id, 'rejected')}
                            className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>প্রত্যাখ্যান</span>
                          </button>
                        )}
                        {canVerifyPayment &&
                          app.paymentStatus !== 'verified' &&
                          app.paymentStatus !== 'refunded' &&
                          app.totalFee > 0 && (
                            <button
                              type="button"
                              onClick={() => openVerifyModal(app)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>
                                {app.paymentStatus === 'submitted' ? 'পেমেন্ট যাচাই' : 'পেমেন্ট সংগ্রহ'}
                              </span>
                            </button>
                          )}
                        {canManageRefund && app.paymentStatus === 'verified' && app.paidAmount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setRefundTargetApp(app);
                              setRefundAmt(String(app.paidAmount));
                              setRefundReason('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>রিফান্ড</span>
                          </button>
                        )}
                        {canDeleteTest && app.paymentStatus !== 'verified' && (
                          confirmDeleteAppId === app.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const res = store.deleteEventApplication(app.id);
                                  setConfirmDeleteAppId(null);
                                  if (!res.success) {
                                    setFeedback({ type: 'error', text: res.error || 'মোছা যায়নি।' });
                                  }
                                }}
                                className="px-2 py-1 rounded-lg bg-red-700 text-white text-[11px] font-bold cursor-pointer"
                              >
                                নিশ্চিত
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteAppId(null)}
                                className="px-2 py-1 rounded-lg bg-stone-200 text-stone-700 text-[11px] cursor-pointer"
                              >
                                না
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteAppId(app.id)}
                              className="px-2 py-1.5 rounded-lg bg-stone-100 hover:bg-red-50 text-stone-600 hover:text-red-700 border border-stone-200 text-[11px] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 3: DYNAMIC FEE CATEGORIES */}
          {subTab === 'categories' && canManageCategories && (
            <div className="no-print grid grid-cols-1 lg:grid-cols-2 gap-6">
              <form
                onSubmit={handleSaveCategory}
                className="bg-white p-6 rounded-2xl border border-stone-200 space-y-4 self-start"
              >
                <h3 className="text-base font-bold text-stone-900">
                  {editingCat ? 'ক্যাটাগরি সম্পাদনা' : 'নতুন অংশগ্রহণের ধরন ও ফি যুক্ত করুন'}
                </h3>
                <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  বিঃদ্রঃ ক্যাটাগরি ফি পরিবর্তন করলে তা শুধু ভবিষ্যতের নতুন আবেদনে প্রযোজ্য হবে; পূর্বের আবেদনের ফ্রোজেন ফি অপরিবর্তিত থাকবে।
                </p>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">ধরন / ক্যাটাগরির নাম *</label>
                  <input
                    type="text"
                    required
                    placeholder="উদা: সাধারণ সদস্য / ছাত্র / অতিথি / ৫ বছরের নিচে শিশু (ফ্রি)"
                    value={catTitle}
                    onChange={(e) => setCatTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">সংক্ষিপ্ত বিবরণ</label>
                  <input
                    type="text"
                    placeholder="যেমন: দুপুরের খাবার ও টি-শার্টসহ"
                    value={catDesc}
                    onChange={(e) => setCatDesc(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">ফি (৳) * (০ = ফ্রি)</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={catFee}
                      onChange={(e) => setCatFee(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">সর্বোচ্চ সংখ্যা</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={catMaxQty}
                      onChange={(e) => setCatMaxQty(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">ক্রম (Priority)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={catPriority}
                      onChange={(e) => setCatPriority(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  {editingCat && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCat(null);
                        setCatTitle('');
                        setCatDesc('');
                        setCatFee('0');
                      }}
                      className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold cursor-pointer"
                    >
                      বাতিল
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    {editingCat ? 'আপডেট সংরক্ষণ করুন' : 'ক্যাটাগরি যুক্ত করুন'}
                  </button>
                </div>
              </form>

              <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-3">
                <h3 className="text-base font-bold text-stone-900">
                  বর্তমান অংশগ্রহণের ধরনসমূহ ({eventCategories.length}টি)
                </h3>
                {eventCategories.length === 0 ? (
                  <p className="text-xs text-stone-500">এখনো কোনো ক্যাটাগরি যুক্ত করা হয়নি। বাম পাশ থেকে যুক্ত করুন।</p>
                ) : (
                  <div className="space-y-2.5">
                    {eventCategories.map((cat) => (
                      <div
                        key={cat.id}
                        className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-stone-900">{cat.titleBn}</span>
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                              {cat.feeAmount === 0 ? 'বিনামূল্যে (৳০)' : `৳${cat.feeAmount.toLocaleString()}`}
                            </span>
                            {!cat.isActive && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-stone-200 text-stone-600">নিষ্ক্রিয়</span>
                            )}
                          </div>
                          {cat.descriptionBn && <div className="text-[11px] text-stone-500 mt-0.5">{cat.descriptionBn}</div>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => store.updateEventCategory(cat.id, { isActive: !cat.isActive })}
                            className="px-2 py-1 rounded-lg bg-white border border-stone-300 text-[11px] font-semibold cursor-pointer"
                          >
                            {cat.isActive ? 'বন্ধ করুন' : 'চালু করুন'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCat(cat);
                              setCatTitle(cat.titleBn);
                              setCatDesc(cat.descriptionBn);
                              setCatFee(String(cat.feeAmount));
                              setCatMaxQty(String(cat.maxQtyPerApplication));
                              setCatPriority(String(cat.priority));
                            }}
                            className="p-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => store.deleteEventCategory(cat.id)}
                            className="p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUBTAB 4: DEDICATED ISOLATED EVENT FUND LEDGER */}
          {subTab === 'ledger' && canViewFinance && stats && (
            <div className="no-print space-y-6">
              <div className="p-4 rounded-2xl bg-emerald-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-amber-300">আলাদা অনুষ্ঠান ফান্ড লেজার (১০০% বিচ্ছিন্ন হিসাব)</div>
                  <div className="text-xs text-emerald-100 mt-0.5">
                    মূল সমিতির তহবিল ও ব্যাংক হিসাবের সাথে এই হিসাব যুক্ত নয়। রিফান্ড দিলে স্বয়ংক্রিয়ভাবে এখান থেকেই বাদ যাবে।
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs shrink-0">
                  <div>
                    <span className="text-emerald-300 block text-[11px]">ফি (রিফান্ড বাদে)</span>
                    <strong className="font-mono text-sm">
                      ৳{(stats.grossVerifiedCollection - stats.totalRefundedAmount).toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    <span className="text-emerald-300 block text-[11px]">ডোনার অনুদান</span>
                    <strong className="font-mono text-sm">+৳{stats.eventDonationsTotal.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-red-300 block text-[11px]">মোট খরচ</span>
                    <strong className="font-mono text-sm text-red-300">-৳{stats.eventExpensesTotal.toLocaleString()}</strong>
                  </div>
                  <div className="px-3 py-1 rounded-xl bg-emerald-900 border border-emerald-700">
                    <span className="text-amber-300 block text-[11px]">নিট স্থিতি</span>
                    <strong className="font-mono text-base">৳{stats.eventNetFundBalance.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {canManageLedger && (
                  <form
                    onSubmit={handleAddLedger}
                    className="bg-white p-5 rounded-2xl border border-stone-200 space-y-3 self-start"
                  >
                    <h3 className="text-sm font-bold text-stone-900">নতুন ডোনার অনুদান বা অনুষ্ঠান খরচ লিখুন</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLedgerType('donation');
                          setLedgerCategory('ডোনার / স্পন্সর অনুদান');
                        }}
                        className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                          ledgerType === 'donation'
                            ? 'bg-emerald-800 text-white border-emerald-800'
                            : 'bg-stone-50 text-stone-700 border-stone-200'
                        }`}
                      >
                        + ডোনার / স্পট অনুদান
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLedgerType('expense');
                          setLedgerCategory('আপ্যায়ন ও ভেন্যু খরচ');
                        }}
                        className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                          ledgerType === 'expense'
                            ? 'bg-red-700 text-white border-red-700'
                            : 'bg-stone-50 text-stone-700 border-stone-200'
                        }`}
                      >
                        - অনুষ্ঠানের খরচ
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="শিরোনাম * (উদা: স্পন্সর অনুদান / স্টেজ ভাড়া)"
                      value={ledgerTitle}
                      onChange={(e) => setLedgerTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl"
                    />
                    <input
                      type="text"
                      placeholder="খাত / ক্যাটাগরি"
                      value={ledgerCategory}
                      onChange={(e) => setLedgerCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl"
                    />
                    <input
                      type="text"
                      placeholder={ledgerType === 'donation' ? 'দাতা / স্পন্সরের নাম' : 'প্রাপক / দোকানের নাম'}
                      value={ledgerParty}
                      onChange={(e) => setLedgerParty(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="টাকার পরিমাণ *"
                        value={ledgerAmt}
                        onChange={(e) => setLedgerAmt(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl font-mono font-bold"
                      />
                      <select
                        value={ledgerMethod}
                        onChange={(e) => setLedgerMethod(e.target.value as EventPaymentMethod)}
                        className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl bg-white"
                      >
                        {Object.entries(PAY_METHOD_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={ledgerDate}
                        onChange={(e) => setLedgerDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl"
                      />
                      <input
                        type="text"
                        placeholder="রসিদ/রেফারেন্স নং"
                        value={ledgerRef}
                        onChange={(e) => setLedgerRef(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl font-mono"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                    >
                      অনুষ্ঠান ফান্ডে সংরক্ষণ করুন
                    </button>
                  </form>
                )}

                <div className={`${canManageLedger ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white p-5 rounded-2xl border border-stone-200 space-y-3`}>
                  <h3 className="text-sm font-bold text-stone-900">অনুদান ও খরচের খতিয়ান ({eventLedger.length}টি)</h3>
                  {eventLedger.length === 0 ? (
                    <p className="text-xs text-stone-500 py-6 text-center">এখনো কোনো আলাদা অনুদান বা খরচ এন্ট্রি হয়নি।</p>
                  ) : (
                    <div className="space-y-2">
                      {eventLedger.map((entry) => (
                        <div
                          key={entry.id}
                          className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-stone-500">{entry.entryCode}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  entry.entryType === 'donation'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {entry.entryType === 'donation' ? 'ডোনার/স্পট আয়' : 'অনুষ্ঠান ব্যয়'}
                              </span>
                              <span className="font-bold text-stone-900">{entry.title}</span>
                            </div>
                            <div className="text-[11px] text-stone-500 mt-0.5">
                              {entry.entryDate} · {entry.partyName} · {PAY_METHOD_LABELS[entry.paymentMethod]}
                              {entry.referenceNo ? ` · Ref: ${entry.referenceNo}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`font-mono font-bold text-sm ${
                                entry.entryType === 'donation' ? 'text-emerald-800' : 'text-red-700'
                              }`}
                            >
                              {entry.entryType === 'donation' ? '+' : '-'}৳{entry.amount.toLocaleString()}
                            </span>
                            {canManageLedger && (
                              confirmDeleteLedgerId === entry.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      store.deleteEventLedgerEntry(entry.id);
                                      setConfirmDeleteLedgerId(null);
                                    }}
                                    className="px-2 py-1 rounded bg-red-700 text-white text-[10px] font-bold cursor-pointer"
                                  >
                                    নিশ্চিত
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteLedgerId(null)}
                                    className="px-2 py-1 rounded bg-stone-200 text-stone-700 text-[10px] cursor-pointer"
                                  >
                                    না
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteLedgerId(entry.id)}
                                  className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-700 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 5: 9 REPORTS (PDF & EXCEL CSV) */}
          {subTab === 'reports' && canExportReports && stats && (
            <div className="no-print bg-white p-6 rounded-2xl border border-stone-200 space-y-5">
              <div>
                <h3 className="text-base font-bold text-stone-900">৯টি অনুষ্ঠান রিপোর্ট ও এক্সপোর্ট কেন্দ্র (PDF & Excel CSV)</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  বাংলা এক্সেল সাপোর্টসহ UTF-8 BOM CSV ফাইল এবং প্রিন্ট/PDF ডাউনলোড সুবিধা।
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(Object.keys(REPORT_LABELS) as EventReportType[]).map((repKey) => (
                  <button
                    key={repKey}
                    type="button"
                    onClick={() => setSelectedReport(repKey)}
                    className={`p-3.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                      selectedReport === repKey
                        ? 'bg-emerald-50 border-emerald-700 text-emerald-950 ring-2 ring-emerald-700/20'
                        : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {REPORT_LABELS[repKey]}
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-stone-600">
                  নির্বাচিত রিপোর্ট: <strong className="text-stone-900">{REPORT_LABELS[selectedReport]}</strong>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadCSVReport}
                    className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>Excel CSV ডাউনলোড</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintPDF}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Export PDF / প্রিন্ট</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 6: EVENT AUDIT LOGS */}
          {subTab === 'logs' && canViewLogs && (
            <div className="no-print bg-white p-6 rounded-2xl border border-stone-200 space-y-3">
              <h3 className="text-base font-bold text-stone-900">অনুষ্ঠানের অডিট লগ ({eventLogs.length}টি)</h3>
              {eventLogs.length === 0 ? (
                <p className="text-xs text-stone-500">এখনো কোনো লগ রেকর্ড নেই।</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {eventLogs.map((l) => (
                    <div key={l.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500 mb-1">
                        <span className="font-mono font-bold text-emerald-800">{l.action}</span>
                        <span>
                          {l.actorName} ({l.actorRole}) · {l.createdAt}
                        </span>
                      </div>
                      <div className="text-stone-800">{l.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL 1: CREATE / EDIT EVENT */}
      {eventModalMode && (
        <div className="no-print fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="text-base font-bold text-stone-900">
                {eventModalMode === 'create' ? 'নতুন অনুষ্ঠান ও আয়োজন তৈরি করুন' : 'অনুষ্ঠানের তথ্য ও সেটিংস সম্পাদনা'}
              </h3>
              <button onClick={() => setEventModalMode(null)} className="text-stone-400 hover:text-stone-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">অনুষ্ঠানের শিরোনাম *</label>
                <input
                  type="text"
                  required
                  placeholder="উদা: বার্ষিক ইফতার ও দোয়া মাহফিল ২০২৬"
                  value={evTitle}
                  onChange={(e) => setEvTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">ধরন</label>
                  <select
                    value={evType}
                    onChange={(e) => setEvType(e.target.value as EventType)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                  >
                    {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">অবস্থা (Status)</label>
                  <select
                    value={evStatus}
                    onChange={(e) => setEvStatus(e.target.value as EventStatus)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                  >
                    {Object.entries(EVENT_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">স্থান (Venue) *</label>
                  <input
                    type="text"
                    required
                    value={evVenue}
                    onChange={(e) => setEvVenue(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">তারিখ ও সময় *</label>
                  <input
                    type="datetime-local"
                    required
                    value={evDate}
                    onChange={(e) => setEvDate(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono"
                  />
                  {evDate && (
                    <p className="text-[10px] text-emerald-700 mt-1">{formatEventDateBn(evDate)}</p>
                  )}
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">সর্বোচ্চ ধারণক্ষমতা</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="ঐচ্ছিক"
                    value={evCapacity}
                    onChange={(e) => setEvCapacity(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">সংক্ষিপ্ত সারাংশ</label>
                <input
                  type="text"
                  value={evSummary}
                  onChange={(e) => setEvSummary(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">বিস্তারিত বিবরণ</label>
                <textarea
                  rows={2}
                  value={evDescription}
                  onChange={(e) => setEvDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">পেমেন্ট / অংশগ্রহণ নির্দেশনা</label>
                <textarea
                  rows={2}
                  value={evPayInstructions}
                  onChange={(e) => setEvPayInstructions(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
                  <input type="checkbox" checked={evPublished} onChange={(e) => setEvPublished(e.target.checked)} />
                  <span>পাবলিশ করুন</span>
                </label>
                <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
                  <input type="checkbox" checked={evRegOpen} onChange={(e) => setEvRegOpen(e.target.checked)} />
                  <span>নিবন্ধন খোলা</span>
                </label>
                <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
                  <input type="checkbox" checked={evAllowPayLater} onChange={(e) => setEvAllowPayLater(e.target.checked)} />
                  <span>পেমেন্ট ঐচ্ছিক</span>
                </label>
                <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
                  <input type="checkbox" checked={evShowCount} onChange={(e) => setEvShowCount(e.target.checked)} />
                  <span>সংখ্যা দেখান</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setEventModalMode(null)}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  {eventModalMode === 'create' ? 'অনুষ্ঠান তৈরি করুন' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VERIFY / RECORD PAYMENT */}
      {verifyTargetApp && (
        <div className="no-print fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200">
              <h3 className="text-sm font-bold text-stone-900">
                পেমেন্ট যাচাই ও সংগ্রহ — {verifyTargetApp.registrationCode}
              </h3>
              <button onClick={() => setVerifyTargetApp(null)} className="text-stone-400 hover:text-stone-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <div>আবেদনকারী: <strong>{verifyTargetApp.applicantNameBn}</strong> ({verifyTargetApp.totalParticipants} জন)</div>
              <div>নির্ধারিত মোট ফি: <strong>৳{verifyTargetApp.totalFee.toLocaleString()}</strong></div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-bold mb-1">পেমেন্ট মাধ্যম</label>
                <select
                  value={verifyMethod}
                  onChange={(e) => setVerifyMethod(e.target.value as EventPaymentMethod)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                >
                  {Object.entries(PAY_METHOD_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">আদায়কৃত পরিমাণ (৳)</label>
                <input
                  type="number"
                  min="0"
                  value={verifyAmount}
                  onChange={(e) => setVerifyAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">ট্রানজেকশন আইডি / রসিদ নং (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={verifyTxnId}
                  onChange={(e) => setVerifyTxnId(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">নোট</label>
                <input
                  type="text"
                  value={verifyNote}
                  onChange={(e) => setVerifyNote(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleVerifySubmit('reject')}
                className="px-3.5 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 font-bold cursor-pointer"
              >
                প্রত্যাখ্যান
              </button>
              <button
                type="button"
                onClick={() => handleVerifySubmit('verify')}
                className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              >
                ভেরিফাই ও ফান্ডে যুক্ত করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REFUND */}
      {refundTargetApp && (
        <div className="no-print fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleRefundSubmit} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200">
              <h3 className="text-sm font-bold text-red-800">ভেরিফায়েড পেমেন্ট রিফান্ড</h3>
              <button type="button" onClick={() => setRefundTargetApp(null)} className="text-stone-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
              রিফান্ড সম্পন্ন হলে এই টাকা স্বয়ংক্রিয়ভাবে অনুষ্ঠান ফান্ডের নিট ব্যালেন্স থেকে বাদ যাবে (অতিরিক্ত অনুমোদনের প্রয়োজন নেই এবং মূল সমিতির হিসাব অপরিবর্তিত থাকবে)।
            </p>
            <div>
              <label className="block font-bold mb-1">রিফান্ড পরিমাণ (সর্বোচ্চ ৳{refundTargetApp.paidAmount.toLocaleString()}) *</label>
              <input
                type="number"
                min="1"
                max={refundTargetApp.paidAmount}
                required
                value={refundAmt}
                onChange={(e) => setRefundAmt(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">রিফান্ডের কারণ *</label>
              <input
                type="text"
                required
                minLength={3}
                placeholder="উদা: আবেদনকারীর উপস্থিতি বাতিল / অতিরিক্ত ফি ফেরত"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundTargetApp(null)}
                className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-bold cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold cursor-pointer"
              >
                রিফান্ড নিশ্চিত করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: SPOT / WALK-IN ENTRY */}
      {spotModalOpen && selectedEvent && (
        <div className="no-print fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSpotSubmit} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200">
              <h3 className="text-sm font-bold text-stone-900">স্পট / ওয়াক-ইন অংশগ্রহণ নিবন্ধন</h3>
              <button type="button" onClick={() => setSpotModalOpen(false)} className="text-stone-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="অংশগ্রহণকারীর নাম *"
                value={spotName}
                onChange={(e) => setSpotName(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl"
              />
              <input
                type="tel"
                required
                placeholder="মোবাইল নম্বর *"
                value={spotPhone}
                onChange={(e) => setSpotPhone(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="ঠিকানা / প্রতিষ্ঠান"
                value={spotAddress}
                onChange={(e) => setSpotAddress(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl"
              />
              <input
                type="text"
                placeholder="সদস্য আইডি (যদি থাকে)"
                value={spotMemberId}
                onChange={(e) => setSpotMemberId(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono"
              />
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="font-bold text-stone-800">অংশগ্রহণের ধরন ও সংখ্যা:</div>
              {eventCategories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between gap-2">
                  <span>
                    {cat.titleBn} (৳{cat.feeAmount})
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={cat.maxQtyPerApplication}
                    value={spotQuantities[cat.id] || 0}
                    onChange={(e) =>
                      setSpotQuantities((prev) => ({ ...prev, [cat.id]: Number(e.target.value || 0) }))
                    }
                    className="w-20 px-2 py-1 border border-stone-300 rounded-lg text-center font-mono"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">পেমেন্ট অবস্থা</label>
                <select
                  value={spotPayStatus}
                  onChange={(e) => setSpotPayStatus(e.target.value as 'verified' | 'unpaid')}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                >
                  <option value="verified">হাতে নগদ / ভেরিফায়েড আদায়</option>
                  <option value="unpaid">পরে পরিশোধ করবেন (Unpaid)</option>
                </select>
              </div>
              {spotPayStatus === 'verified' && (
                <div>
                  <label className="block font-bold mb-1">মাধ্যম</label>
                  <select
                    value={spotMethod}
                    onChange={(e) => setSpotMethod(e.target.value as EventPaymentMethod)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                  >
                    {Object.entries(PAY_METHOD_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {spotPayStatus === 'verified' && (
              <input
                type="text"
                placeholder="রসিদ নম্বর / ট্রানজেকশন আইডি (ঐচ্ছিক)"
                value={spotTxnId}
                onChange={(e) => setSpotTxnId(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono"
              />
            )}

            <label className="flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={spotAutoApprove}
                onChange={(e) => setSpotAutoApprove(e.target.checked)}
              />
              <span>সরাসরি উপস্থিতি অনুমোদিত (Approved) হিসেবে যুক্ত করুন</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSpotModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-bold cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              >
                স্পট নিবন্ধন সংরক্ষণ করুন
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
