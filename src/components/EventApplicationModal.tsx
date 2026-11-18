/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../db/store.ts';
import {
  X,
  CalendarDays,
  CheckCircle,
  AlertCircle,
  Users,
  Wallet,
  Plus,
  Minus,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { EventItem, EventPaymentMethod } from '../types.ts';
import { formatEventDateBn } from '../utils/dateFormat.ts';

interface EventApplicationModalProps {
  event: EventItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EventApplicationModal: React.FC<EventApplicationModalProps> = ({
  event,
  isOpen,
  onClose,
}) => {
  const store = useAppStore();

  const activeCategories = useMemo(
    () =>
      event
        ? store.eventCategories
            .filter((c) => c.eventId === event.id && c.isActive)
            .sort((a, b) => a.priority - b.priority)
        : [],
    [store.eventCategories, event]
  );

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [applicantNameBn, setApplicantNameBn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [organizationOrAddress, setOrganizationOrAddress] = useState('');
  const [membershipIdRef, setMembershipIdRef] = useState('');
  const [notes, setNotes] = useState('');

  const [paymentChoice, setPaymentChoice] = useState<'pay_later' | 'pay_now'>('pay_later');
  const [paymentMethod, setPaymentMethod] = useState<EventPaymentMethod>('bkash');
  const [transactionId, setTransactionId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [submittedParticipants, setSubmittedParticipants] = useState<number>(0);

  const resetAllFields = () => {
    setQuantities({});
    setApplicantNameBn('');
    setPhone('');
    setEmail('');
    setOrganizationOrAddress('');
    setMembershipIdRef('');
    setNotes('');
    setPaymentChoice('pay_later');
    setPaymentMethod('bkash');
    setTransactionId('');
    setError(null);
    setSubmittedCode(null);
    setSubmittedParticipants(0);
  };

  useEffect(() => {
    if (!isOpen) {
      resetAllFields();
    }
  }, [isOpen, event?.id]);

  if (!isOpen || !event) return null;

  const getQty = (catId: string, idx: number) => {
    if (quantities[catId] !== undefined) return quantities[catId];
    return idx === 0 ? 1 : 0;
  };

  const setQty = (catId: string, nextVal: number, maxQty: number) => {
    const clamped = Math.max(0, Math.min(maxQty, Math.floor(nextVal)));
    setQuantities((prev) => ({ ...prev, [catId]: clamped }));
  };

  const summary = activeCategories.reduce(
    (acc, cat, idx) => {
      const q = getQty(cat.id, idx);
      acc.participants += q;
      acc.totalFee += q * cat.feeAmount;
      return acc;
    },
    { participants: 0, totalFee: 0 }
  );

  const resolvedPaymentChoice = event.allowPayLater ? paymentChoice : 'pay_now';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (!applicantNameBn.trim() || !phone.trim()) {
      setError('অনুগ্রহ করে আপনার নাম ও মোবাইল নম্বর পূরণ করুন।');
      return;
    }
    if (summary.participants < 1) {
      setError('অন্তত ১ জন অংশগ্রহণকারীর সংখ্যা নির্বাচন করুন।');
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadQuantities = activeCategories
        .map((cat, idx) => ({
          categoryId: cat.id,
          quantity: getQty(cat.id, idx),
        }))
        .filter((x) => x.quantity > 0);

      const res = await store.submitPublicEventApplication({
        eventId: event.id,
        applicantNameBn: applicantNameBn.trim(),
        phone: phone.trim(),
        email: email.trim(),
        organizationOrAddress: organizationOrAddress.trim(),
        membershipIdRef: membershipIdRef.trim(),
        quantities: payloadQuantities,
        paymentChoice: summary.totalFee === 0 ? 'pay_later' : resolvedPaymentChoice,
        paymentMethod: summary.totalFee > 0 && resolvedPaymentChoice === 'pay_now' ? paymentMethod : undefined,
        transactionId: summary.totalFee > 0 && resolvedPaymentChoice === 'pay_now' ? transactionId.trim() : undefined,
        notes: notes.trim(),
      });

      if (res.success && res.registrationCode) {
        setSubmittedCode(res.registrationCode);
        setSubmittedParticipants(summary.participants);
        try {
          confetti({ particleCount: 70, spread: 65, origin: { y: 0.6 } });
        } catch {
          // ignore
        }
      } else {
        setError(res.error || 'নিবন্ধন জমা দেওয়া যায়নি।');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseReset = () => {
    resetAllFields();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden">
        {submittedCode ? (
          <div className="text-center p-6 sm:p-8 space-y-4 overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-stone-900">
              উপস্থিতি ও অংশগ্রহণ নিবন্ধন সম্পন্ন!
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto">
              <strong>{event.title}</strong> অনুষ্ঠানে মোট <strong>{submittedParticipants} জন</strong> অংশগ্রহণের জন্য আপনার নিবন্ধন গৃহীত হয়েছে। নিচের ট্র্যাকিং কোডটি সংরক্ষণ করুন:
            </p>
            <div className="inline-block p-3.5 bg-emerald-50 text-emerald-900 font-mono font-bold text-lg rounded-xl border border-emerald-200">
              {submittedCode}
            </div>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              যেকোনো সময় “অনুষ্ঠান ও আয়োজন” পেজের “নিবন্ধনের অবস্থা যাচাই করুন” অংশে এই কোড ও মোবাইল নম্বর দিয়ে আপনার সর্বশেষ অবস্থা দেখতে পারবেন।
            </p>
            <div className="pt-3">
              <button
                type="button"
                onClick={handleCloseReset}
                className="px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer"
              >
                ঠিক আছে (বন্ধ করুন)
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col min-h-0 flex-1">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-5 py-4 sm:px-7 border-b border-stone-100 bg-white shrink-0">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md mb-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>অংশগ্রহণ ও উপস্থিতি নিবন্ধন</span>
                </div>
                <h3 className="text-lg font-bold text-stone-900 leading-snug">{event.title}</h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  তারিখ: {formatEventDateBn(event.eventDate)} · স্থান: {event.venue}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseReset}
                aria-label="বন্ধ করুন"
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 sm:px-7 sm:py-6 overflow-y-auto flex-1 overscroll-contain">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {activeCategories.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600">
                  এই অনুষ্ঠানের জন্য এখনো অংশগ্রহণের ক্যাটাগরি নির্ধারণ করা হয়নি। দয়া করে অ্যাডমিনের সাথে যোগাযোগ করুন।
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5 text-xs">
                  {/* Dynamic Multi-Category Participant Selector */}
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-emerald-700" />
                        <span>কতজন অংশগ্রহণ করবেন? (সংখ্যা নির্বাচন করুন)</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[11px]">
                        মোট: {summary.participants} জন
                      </span>
                    </div>

                    <div className="space-y-2">
                      {activeCategories.map((cat, idx) => {
                        const qty = getQty(cat.id, idx);
                        return (
                          <div
                            key={cat.id}
                            className="p-3 rounded-xl bg-white border border-stone-200 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-stone-900">{cat.titleBn}</div>
                              {cat.descriptionBn && (
                                <div className="text-[11px] text-stone-500">{cat.descriptionBn}</div>
                              )}
                              <div className="text-[11px] font-bold text-emerald-800 mt-0.5">
                                {cat.feeAmount === 0
                                  ? 'বিনামূল্যে (৳০)'
                                  : `জনপ্রতি ফি: ৳${cat.feeAmount.toLocaleString()}`}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setQty(cat.id, qty - 1, cat.maxQtyPerApplication)}
                                className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center border border-stone-300 cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                max={cat.maxQtyPerApplication}
                                value={qty}
                                onChange={(e) =>
                                  setQty(cat.id, Number(e.target.value || 0), cat.maxQtyPerApplication)
                                }
                                className="w-12 text-center py-1 border border-stone-300 rounded-lg font-mono font-bold"
                              />
                              <button
                                type="button"
                                onClick={() => setQty(cat.id, qty + 1, cat.maxQtyPerApplication)}
                                className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-sm font-bold text-stone-900">
                      <span>মোট অংশগ্রহণকারী: {summary.participants} জন</span>
                      <span className="text-emerald-800">
                        {summary.totalFee === 0
                          ? '৳০ (ফ্রি / ফি প্রযোজ্য নয়)'
                          : `প্রযোজ্য ফি: ৳${summary.totalFee.toLocaleString()}`}
                      </span>
                    </div>
                  </div>

                  {/* Personal Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-stone-700 mb-1">আবেদনকারীর পূর্ণ নাম *</label>
                      <input
                        type="text"
                        required
                        placeholder="আপনার নাম লিখুন"
                        value={applicantNameBn}
                        onChange={(e) => setApplicantNameBn(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-stone-700 mb-1">মোবাইল নম্বর *</label>
                      <input
                        type="tel"
                        required
                        placeholder="017XXXXXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block font-bold text-stone-700 mb-1">ঠিকানা / প্রতিষ্ঠান</label>
                      <input
                        type="text"
                        placeholder="রংপুর এলাকা / শিক্ষাপ্রতিষ্ঠান"
                        value={organizationOrAddress}
                        onChange={(e) => setOrganizationOrAddress(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-stone-700 mb-1">সমিতির সদস্য আইডি (যদি থাকে)</label>
                      <input
                        type="text"
                        placeholder="PKS-GEN-..."
                        value={membershipIdRef}
                        onChange={(e) => setMembershipIdRef(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-stone-700 mb-1">ইমেইল (ঐচ্ছিক)</label>
                      <input
                        type="email"
                        placeholder="example@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Attendance-First Payment Section (Optional if allowPayLater) */}
                  {summary.totalFee > 0 && (
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                      <div className="flex items-start gap-2">
                        <Wallet className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-emerald-950">
                            পেমেন্ট তথ্য {event.allowPayLater ? '(ঐচ্ছিক — উপস্থিতি গণনাই মূল উদ্দেশ্য)' : '(বাধ্যতামূলক)'}
                          </div>
                          {event.paymentInstructions && (
                            <p className="text-[11px] text-emerald-800 mt-0.5">{event.paymentInstructions}</p>
                          )}
                        </div>
                      </div>

                      {event.allowPayLater && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setPaymentChoice('pay_later')}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              paymentChoice === 'pay_later'
                                ? 'bg-white border-emerald-700 ring-2 ring-emerald-700/20 font-bold text-emerald-950'
                                : 'bg-white/70 border-stone-200 text-stone-700'
                            }`}
                          >
                            <div>পরে / অনুষ্ঠানস্থলে পরিশোধ করবো</div>
                            <div className="text-[11px] font-normal text-stone-500 mt-0.5">
                              এখন শুধু উপস্থিতি নিশ্চিত করে নিবন্ধন সম্পন্ন করুন
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPaymentChoice('pay_now')}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              paymentChoice === 'pay_now'
                                ? 'bg-white border-emerald-700 ring-2 ring-emerald-700/20 font-bold text-emerald-950'
                                : 'bg-white/70 border-stone-200 text-stone-700'
                            }`}
                          >
                            <div>এখনই পেমেন্ট করছি / তথ্য দিচ্ছি</div>
                            <div className="text-[11px] font-normal text-stone-500 mt-0.5">
                              বিকাশ / নগদ / ব্যাংক বা রসিদ নম্বর দিন
                            </div>
                          </button>
                        </div>
                      )}

                      {resolvedPaymentChoice === 'pay_now' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block font-bold text-stone-700 mb-1">পেমেন্ট মাধ্যম</label>
                            <select
                              value={paymentMethod}
                              onChange={(e) => setPaymentMethod(e.target.value as EventPaymentMethod)}
                              className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                            >
                              <option value="bkash">বিকাশ (bKash)</option>
                              <option value="nagad">নগদ (Nagad)</option>
                              <option value="rocket">রকেট (Rocket)</option>
                              <option value="bank">ব্যাংক ট্রান্সফার</option>
                              <option value="cash">হাতে নগদ (Cash)</option>
                              <option value="other">অন্যান্য</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-bold text-stone-700 mb-1">
                              ট্রানজেকশন আইডি / রসিদ নং (ঐচ্ছিক)
                            </label>
                            <input
                              type="text"
                              placeholder="উদা: TRX882910 (থাকলে দিন)"
                              value={transactionId}
                              onChange={(e) => setTransactionId(e.target.value)}
                              className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">বিশেষ কোনো মন্তব্য (যদি থাকে)</label>
                    <input
                      type="text"
                      placeholder="যাতায়াত, খাবারের বিশেষ অনুরোধ ইত্যাদি..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                    />
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleCloseReset}
                      className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-semibold cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold shadow cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{isSubmitting ? 'জমা হচ্ছে...' : 'উপস্থিতি নিবন্ধন জমা দিন'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
