/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from '../../db/store.ts';
import {
  Bell,
  HeartHandshake,
  PlusCircle,
  Trash2,
  Pin,
  CheckCircle2,
  XCircle,
  Lock,
  AlertCircle,
  Printer,
} from 'lucide-react';
import { AidApplication, Notice } from '../../types.ts';

export const AdminNoticesAidView: React.FC = () => {
  const store = useAppStore();
  const permissions = store.getEffectivePermissions();

  const canManageNotices = Boolean(permissions.can_manage_notices);
  const canManageAid = Boolean(
    permissions.can_manage_funds ||
      permissions.can_manage_student_wing ||
      store.currentRole === 'super_admin'
  );

  // Notice Form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Notice['category']>('general');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState(store.currentUser.name || 'দপ্তর সম্পাদক');
  const [isPinned, setIsPinned] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!canManageNotices && !canManageAid) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
        <Lock className="w-12 h-12 text-stone-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-stone-900">নোটিশ ও সহায়তা মডিউল সুরক্ষিত</h3>
        <p className="text-xs text-stone-500">আপনার বর্তমান রোলের জন্য এই অংশ পরিচালনার অনুমতি নেই।</p>
      </div>
    );
  }

  const handlePublishNotice = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!title.trim() || !content.trim()) {
      setFeedback({ type: 'error', text: 'নোটিশের শিরোনাম ও বিস্তারিত বিবরণ পূরণ করুন।' });
      return;
    }

    const res = store.addNotice({
      title: title.trim(),
      category,
      content: content.trim(),
      author: author.trim() || store.currentUser.name,
      isPinned,
    });

    if (res.success) {
      setTitle('');
      setContent('');
      setIsPinned(false);
      setFeedback({ type: 'success', text: 'নতুন নোটিশ সফলভাবে পাবলিক নোটিশ বোর্ডে প্রকাশিত হয়েছে!' });
    } else {
      setFeedback({ type: 'error', text: res.error || 'নোটিশ প্রকাশে ত্রুটি হয়েছে।' });
    }
  };

  const handleAidUpdate = (aidId: string, status: AidApplication['status'], fundId?: string) => {
    const res = store.updateAidStatus(aidId, status, fundId);
    if (res.success) {
      setFeedback({ type: 'success', text: `সহায়তা আবেদনের অবস্থা "${status}" হিসেবে হালনাগাদ হয়েছে।` });
    } else {
      setFeedback({ type: 'error', text: res.error || 'অবস্থা পরিবর্তনে ত্রুটি হয়েছে।' });
    }
  };

  return (
    <div className="space-y-8">
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-stone-400 hover:text-stone-700 cursor-pointer">
            ×
          </button>
        </div>
      )}

      {/* SECTION 1: NOTICE BOARD MANAGEMENT */}
      {canManageNotices && (
        <div className="no-print bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-6">
          <div className="pb-4 border-b border-stone-100">
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-emerald-700" />
              <span>কেন্দ্রীয় নোটিশ বোর্ড ব্যবস্থাপনা</span>
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              এখান থেকে প্রকাশিত নোটিশ সরাসরি হোমপেজ ও পাবলিক নোটিশ বোর্ডে প্রদর্শিত হবে।
            </p>
          </div>

          <form onSubmit={handlePublishNotice} className="p-5 rounded-xl bg-stone-50 border border-stone-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">নোটিশের শিরোনাম *</label>
                <input
                  type="text"
                  required
                  placeholder="উদা: কার্যকরী পরিষদের সাধারণ সভা সংক্রান্ত জরুরি বিজ্ঞপ্তি"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">ক্যাটাগরি</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Notice['category'])}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
                >
                  <option value="general">সাধারণ বিজ্ঞপ্তি</option>
                  <option value="urgent">জরুরি নোটিশ</option>
                  <option value="student">ছাত্র কল্যাণ সমিতি</option>
                  <option value="meeting">সভার বিজ্ঞপ্তি</option>
                  <option value="press">প্রেস রিলিজ</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">বিস্তারিত বিবরণ *</label>
              <textarea
                rows={3}
                required
                placeholder="বিজ্ঞপ্তির পূর্ণাঙ্গ তথ্য লিখুন..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-stone-600 font-semibold">প্রদানকারী:</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-stone-300 rounded-lg bg-white"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="rounded text-emerald-800"
                  />
                  <span>হোমপেজে জরুরি নোটিশ হিসেবে পিন করুন</span>
                </label>
              </div>

              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer self-end sm:self-auto"
              >
                <PlusCircle className="w-4 h-4" />
                <span>নোটিশ প্রকাশ করুন</span>
              </button>
            </div>
          </form>

          {/* Existing Notices List */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-stone-600 uppercase">
              প্রকাশিত নোটিশ তালিকা ({store.notices.length}টি)
            </h3>
            {store.notices.length > 0 ? (
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
                {store.notices.map((n) => (
                  <div key={n.id} className="p-4 bg-white flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[11px] text-stone-500">
                        {n.isPinned && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                            <Pin className="w-3 h-3" /> পিনযুক্ত
                          </span>
                        )}
                        <span className="font-mono">{n.publishDate}</span>
                        <span>· {n.author}</span>
                      </div>
                      <div className="text-sm font-bold text-stone-900">{n.title}</div>
                      <p className="text-xs text-stone-600 line-clamp-2">{n.content}</p>
                    </div>
                    <button
                      onClick={() => store.deleteNotice(n.id)}
                      title="নোটিশ মুছুন"
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-stone-500 bg-stone-50 rounded-xl border border-dashed border-stone-300">
                এখনো কোনো নোটিশ প্রকাশ করা হয়নি।
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: AID APPLICATIONS MANAGEMENT */}
      {canManageAid && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5">
          <div className="print-only border-b-2 border-stone-800 pb-3 mb-4 text-center">
            <h1 className="text-xl font-bold text-stone-900">{store.settings.organizationNameBn}</h1>
            <p className="text-xs text-stone-600">
              শিক্ষা ও চিকিৎসা সহায়তা আবেদন প্রতিবেদন — মোট আবেদন: {store.aidApplications.length}টি | তারিখ:{' '}
              {new Date().toISOString().substring(0, 10)}
            </p>
          </div>

          <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-stone-100">
            <div>
              <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-emerald-700" />
                <span>শিক্ষা ও চিকিৎসা সহায়তা আবেদন ব্যবস্থাপনা</span>
              </h2>
              <p className="text-xs text-stone-500 mt-1">
                আবেদন অনুমোদনের পর অর্থ প্রদানের জন্য 'আর্থিক খতিয়ান' থেকে ভাউচারসহ ব্যয় এন্ট্রি করুন।
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700">
                মোট আবেদন: {store.aidApplications.length}টি
              </span>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={store.aidApplications.length === 0}
                className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>সহায়তা রিপোর্ট PDF</span>
              </button>
            </div>
          </div>

          {store.aidApplications.length > 0 ? (
            <div className="space-y-3">
              {store.aidApplications.map((aid) => (
                <div key={aid.id} className="p-4 rounded-xl border border-stone-200 bg-stone-50/70 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-stone-900">{aid.applicantName}</div>
                      <div className="text-[11px] text-stone-500 font-mono">
                        মোবাইল: {aid.phone} · ঠিকানা: {aid.patgramAddress} ({aid.currentAddress})
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        ৳{aid.requestedAmount.toLocaleString()}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          aid.status === 'approved' || aid.status === 'disbursed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : aid.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {aid.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-stone-700 bg-white p-3 rounded-lg border border-stone-200">
                    {aid.reason}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[11px] text-stone-400">জমা: {aid.submittedAt}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {(aid.status === 'submitted' || aid.status === 'under_review') && (
                        <>
                          <button
                            onClick={() => handleAidUpdate(aid.id, 'approved', store.funds[1]?.id || store.funds[0]?.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>অনুমোদন দিন</span>
                          </button>
                          <button
                            onClick={() => handleAidUpdate(aid.id, 'rejected')}
                            className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>বাতিল</span>
                          </button>
                        </>
                      )}
                      {aid.status === 'approved' && (
                        <button
                          onClick={() => handleAidUpdate(aid.id, 'disbursed', aid.allocatedFundId)}
                          className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-bold cursor-pointer"
                        >
                          বিতরণ সম্পন্ন চিহ্নিত করুন
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-stone-500 bg-stone-50 rounded-xl border border-dashed border-stone-300">
              এখনো কোনো মানবিক বা শিক্ষা সহায়তা আবেদন জমা হয়নি।
            </div>
          )}
        </div>
      )}
    </div>
  );
};
