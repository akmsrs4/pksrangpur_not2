/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from '../db/store.ts';
import { X, HeartHandshake, CheckCircle2, AlertCircle } from 'lucide-react';
import { AidApplication } from '../types.ts';

interface AidApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AidApplicationModal: React.FC<AidApplicationModalProps> = ({ isOpen, onClose }) => {
  const store = useAppStore();

  const [applicantName, setApplicantName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<AidApplication['type']>('education_scholarship');
  const [patgramAddress, setPatgramAddress] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [requestedAmount, setRequestedAmount] = useState<number>(10000);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (!applicantName.trim() || !phone.trim() || !reason.trim()) {
      setError('অনুগ্রহ করে নাম, মোবাইল নম্বর এবং সহায়তার বিস্তারিত কারণ পূরণ করুন।');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await store.submitAidApplication({
        applicantName: applicantName.trim(),
        phone: phone.trim(),
        type,
        patgramAddress: patgramAddress.trim() || 'পাটগ্রাম',
        currentAddress: currentAddress.trim() || 'রংপুর',
        requestedAmount: Number(requestedAmount),
        reason: reason.trim(),
      });

      if (res.success) {
        setSubmitted(true);
      } else {
        setError(res.error || 'আবেদন জমা দেওয়া যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setApplicantName('');
    setPhone('');
    setType('education_scholarship');
    setPatgramAddress('');
    setCurrentAddress('');
    setRequestedAmount(10000);
    setReason('');
    setError(null);
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl max-h-[88dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {submitted ? (
          <div className="text-center p-6 sm:p-8 space-y-4 overflow-y-auto overscroll-contain">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-stone-900">
              সহায়তার আবেদনটি সফলভাবে জমা হয়েছে
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto">
              পাটগ্রাম কল্যাণ সমিতির সমাজকল্যাণ ও অর্থ উপ-কমিটি আপনার আবেদনটি নিরপেক্ষভাবে যাচাই করবে। শীঘ্রই আপনার প্রদত্ত মোবাইল নম্বরে যোগাযোগ করা হবে।
            </p>
            <div className="pt-4">
              <button
                onClick={handleReset}
                className="px-6 py-2.5 rounded-xl bg-emerald-800 text-white font-semibold text-xs hover:bg-emerald-700 transition-all cursor-pointer"
              >
                ঠিক আছে (বন্ধ করুন)
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col min-h-0 flex-1">
            {/* Header (Always Visible) */}
            <div className="flex items-start justify-between gap-4 px-5 py-4 sm:px-8 sm:pt-7 sm:pb-4 border-b border-stone-100 shrink-0 bg-white">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md mb-1.5">
                  <HeartHandshake className="w-3.5 h-3.5" />
                  <span>মানবিক সহায়তা ও বৃত্তি উইং</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-stone-900 leading-snug">
                  শিক্ষা ও চিকিৎসা সহায়তা আবেদন
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="বন্ধ করুন"
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="px-5 py-4 sm:px-8 sm:py-6 overflow-y-auto flex-1 overscroll-contain">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  সহায়তার ধরন
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600 bg-white"
                >
                  <option value="education_scholarship">
                    মেধা বৃত্তি ও শিক্ষা সহায়তা (দরিদ্র ও মেধাবী শিক্ষার্থী)
                  </option>
                  <option value="medical_assistance">
                    জরুরি চিকিৎসা ও ওষুধ সহায়তা (অসুস্থ ও দুস্থ পরিবার)
                  </option>
                  <option value="emergency_relief">
                    দুর্যোগকালীন তাৎক্ষণিক ত্রাণ ও মানবিক সহায়তা
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    আবেদনকারীর নাম *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="উদা: মো. রাশেদুল হাসান"
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    মোবাইল নম্বর *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="০১৭১১..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    পাটগ্রামের স্থায়ী ঠিকানা
                  </label>
                  <input
                    type="text"
                    placeholder="গ্রাম ও ইউনিয়ন"
                    value={patgramAddress}
                    onChange={(e) => setPatgramAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    প্রয়োজনীয় আর্থিক পরিমাণ (টাকায়)
                  </label>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  সহায়তার বিস্তারিত কারণ ও প্রেক্ষিত *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="আপনার বা পরিবারের বর্তমান আর্থিক সংকট, চিকিৎসার প্রেসক্রিপশন বা পরীক্ষার ফি-র বিবরণ সংক্ষেপে লিখুন..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl shadow transition-all cursor-pointer"
                >
                  {isSubmitting ? 'জমা দেওয়া হচ্ছে...' : 'আবেদন পেশ করুন'}
                </button>
              </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
