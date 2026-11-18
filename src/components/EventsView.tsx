/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useAppStore } from '../db/store.ts';
import {
  CalendarDays,
  MapPin,
  Users,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { EventApplicationStatus, EventItem, EventPaymentStatus } from '../types.ts';
import { EventApplicationModal } from './EventApplicationModal.tsx';
import { formatEventDateBn } from '../utils/dateFormat.ts';

const APP_STATUS_LABELS: Record<EventApplicationStatus, string> = {
  pending: 'যাচাইয়ের অপেক্ষায়',
  approved: 'উপস্থিতি অনুমোদিত',
  rejected: 'প্রত্যাখ্যাত',
  cancelled: 'বাতিল',
};

const PAY_STATUS_LABELS: Record<EventPaymentStatus, string> = {
  unpaid: 'পরে / অনুষ্ঠানে পরিশোধযোগ্য',
  submitted: 'পেমেন্ট যাচাইয়ের অপেক্ষায়',
  verified: 'পেমেন্ট ভেরিফায়েড',
  rejected: 'পেমেন্ট প্রত্যাখ্যাত',
  refunded: 'রিফান্ডকৃত',
  exempt: 'ফ্রি / ফি প্রযোজ্য নয়',
};

export const EventsView: React.FC = () => {
  const store = useAppStore();

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  // Public Registration Status Check
  const [lookupCode, setLookupCode] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<{
    registrationCode: string;
    eventTitle: string;
    applicantNameBn: string;
    totalParticipants: number;
    totalFee: number;
    applicationStatus: EventApplicationStatus;
    paymentStatus: EventPaymentStatus;
    createdAt: string;
  } | null>(null);

  const publishedEvents = useMemo(() => {
    return store.events
      .filter((e) => e.isPublished && e.status !== 'draft' && e.status !== 'archived')
      .filter((e) => {
        if (statusFilter === 'active') return e.status === 'upcoming' || e.status === 'ongoing';
        if (statusFilter === 'completed') return e.status === 'completed';
        return true;
      });
  }, [store.events, statusFilter]);

  const getPublicHeadcount = (eventId: string) => {
    const remote = store.publicEventCounts[eventId];
    if (remote) return remote;
    const active = store.eventApplications.filter(
      (a) => a.eventId === eventId && a.applicationStatus !== 'rejected' && a.applicationStatus !== 'cancelled'
    );
    return {
      totalParticipants: active.reduce((s, a) => s + a.totalParticipants, 0),
      approvedParticipants: active
        .filter((a) => a.applicationStatus === 'approved')
        .reduce((s, a) => s + a.totalParticipants, 0),
    };
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setLookupResult(null);
    if (!lookupCode.trim() || !lookupPhone.trim()) {
      setLookupError('নিবন্ধন কোড এবং মোবাইল নম্বর উভয়ই দিন।');
      return;
    }
    setIsLookingUp(true);
    try {
      const res = await store.lookupPublicEventRegistration(lookupCode, lookupPhone);
      if (res.found && res.result) {
        setLookupResult(res.result);
      } else {
        setLookupError('প্রদত্ত কোড ও মোবাইল নম্বরে কোনো নিবন্ধন পাওয়া যায়নি।');
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <div className="py-12 sm:py-16 bg-stone-50 min-h-[75vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-stone-200 pb-8">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/70 px-3 py-1 rounded-full">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>সাংগঠনিক অনুষ্ঠান ও অংশগ্রহণ</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900">
              অনুষ্ঠান ও আয়োজনসমূহ
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed">
              সমিতির আসন্ন ইফতার মাহফিল, পুনর্মিলনী, বনভোজন ও সাধারণ সভার বিস্তারিত দেখুন এবং উপস্থিতি নিশ্চিত করতে অনলাইনে নিবন্ধন করুন।
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-stone-200 self-start lg:self-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                statusFilter === 'all' ? 'bg-emerald-800 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              সবগুলো
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                statusFilter === 'active' ? 'bg-emerald-800 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              চলমান ও আসন্ন
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                statusFilter === 'completed' ? 'bg-emerald-800 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              সম্পন্ন অনুষ্ঠান
            </button>
          </div>
        </div>

        {/* Status Lookup Drawer/Card */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <Search className="w-4 h-4 text-emerald-700" />
                <span>নিবন্ধনের অবস্থা যাচাই করুন (Status Check)</span>
              </h2>
              <p className="text-[11px] text-stone-500">
                আবেদনের সময় প্রাপ্ত কোড (যেমন: EVT-2026-123456) ও মোবাইল নম্বর দিয়ে আপনার উপস্থিতি ও পেমেন্টের অবস্থা জানুন।
              </p>
            </div>
          </div>

          <form onSubmit={handleLookup} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <input
              type="text"
              placeholder="নিবন্ধন কোড (যেমন: EVT-2026-XXXXXX)"
              value={lookupCode}
              onChange={(e) => setLookupCode(e.target.value)}
              className="px-3.5 py-2.5 border border-stone-300 rounded-xl font-mono bg-stone-50"
            />
            <input
              type="tel"
              placeholder="নিবন্ধিত মোবাইল নম্বর"
              value={lookupPhone}
              onChange={(e) => setLookupPhone(e.target.value)}
              className="px-3.5 py-2.5 border border-stone-300 rounded-xl font-mono bg-stone-50"
            />
            <button
              type="submit"
              disabled={isLookingUp}
              className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold cursor-pointer"
            >
              {isLookingUp ? 'খোঁজা হচ্ছে...' : 'অবস্থা দেখুন'}
            </button>
          </form>

          {lookupError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{lookupError}</span>
            </div>
          )}

          {lookupResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="font-bold text-emerald-950 text-sm">
                  {lookupResult.applicantNameBn} — {lookupResult.eventTitle}
                </div>
                <div className="text-emerald-800">
                  কোড: <strong className="font-mono">{lookupResult.registrationCode}</strong> · মোট অংশগ্রহণকারী:{' '}
                  <strong>{lookupResult.totalParticipants} জন</strong> · ফি: ৳{lookupResult.totalFee.toLocaleString()}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-white border border-emerald-300 text-emerald-900 font-bold">
                  {APP_STATUS_LABELS[lookupResult.applicationStatus]}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-800 text-white font-bold">
                  {PAY_STATUS_LABELS[lookupResult.paymentStatus]}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Published Events Grid */}
        {publishedEvents.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-stone-200 text-center space-y-2">
            <CalendarDays className="w-12 h-12 text-stone-300 mx-auto" />
            <h3 className="text-base font-bold text-stone-800">বর্তমানে কোনো প্রকাশিত অনুষ্ঠান নেই</h3>
            <p className="text-xs text-stone-500">
              নতুন কোনো আয়োজন বা মিলনমেলার তারিখ ঘোষণা হলে এখানে অংশগ্রহণ নিবন্ধন ফর্ম উন্মুক্ত করা হবে।
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {publishedEvents.map((ev) => {
              const cats = store.eventCategories
                .filter((c) => c.eventId === ev.id && c.isActive)
                .sort((a, b) => a.priority - b.priority);
              const counts = getPublicHeadcount(ev.id);
              const canRegister = ev.registrationOpen && (ev.status === 'upcoming' || ev.status === 'ongoing');

              return (
                <div
                  key={ev.id}
                  className="bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded bg-stone-100 text-stone-700">
                        {ev.code}
                      </span>
                      <div className="flex items-center gap-2">
                        {ev.showParticipantCount && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Users className="w-3 h-3" />
                            <span>নিবন্ধিত: {counts.totalParticipants} জন</span>
                          </span>
                        )}
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            ev.status === 'completed'
                              ? 'bg-stone-200 text-stone-700'
                              : 'bg-emerald-800 text-white'
                          }`}
                        >
                          {ev.status === 'upcoming'
                            ? 'আসন্ন'
                            : ev.status === 'ongoing'
                              ? 'চলমান'
                              : ev.status === 'completed'
                                ? 'সম্পন্ন'
                                : 'বাতিল'}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-xl font-extrabold text-stone-900">{ev.title}</h3>
                    {ev.summary && <p className="text-xs font-medium text-stone-700">{ev.summary}</p>}
                    {ev.description && <p className="text-xs text-stone-500 leading-relaxed">{ev.description}</p>}

                    <div className="pt-2 space-y-1.5 text-xs text-stone-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>তারিখ ও সময়: <strong className="text-stone-900">{formatEventDateBn(ev.eventDate)}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>স্থান: <strong className="text-stone-900">{ev.venue}</strong></span>
                      </div>
                    </div>

                    {cats.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-1.5">
                        {cats.map((c) => (
                          <span
                            key={c.id}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-200 text-stone-700"
                          >
                            {c.titleBn}:{' '}
                            <strong className="text-emerald-800">
                              {c.feeAmount === 0 ? 'ফ্রি' : `৳${c.feeAmount}`}
                            </strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-stone-100 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-stone-500">
                      {ev.allowPayLater
                        ? 'আগে উপস্থিতি নিশ্চিত করুন (পেমেন্ট ঐচ্ছিক / পরে দেওয়া যাবে)'
                        : 'নিবন্ধন ও অংশগ্রহণ ফি প্রযোজ্য'}
                    </span>
                    {canRegister ? (
                      <button
                        type="button"
                        onClick={() => setSelectedEvent(ev)}
                        className="px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4 text-amber-300" />
                        <span>অংশগ্রহণ নিবন্ধন</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-stone-400">নিবন্ধন বন্ধ রয়েছে</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <EventApplicationModal
        event={selectedEvent}
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
};
