/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from '../db/store.ts';
import { Bell, Pin, Calendar, User, Search, Filter, X } from 'lucide-react';
import { Notice } from '../types.ts';

export const NoticeBoardView: React.FC = () => {
  const store = useAppStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalNotice, setActiveModalNotice] = useState<Notice | null>(null);

  const categories = [
    { id: 'all', label: 'সকল বিজ্ঞপ্তি' },
    { id: 'urgent', label: 'জরুরি নোটিশ' },
    { id: 'student', label: 'ছাত্র কল্যাণ সমিতি' },
    { id: 'general', label: 'সাধারণ বিজ্ঞপ্তি' },
  ];

  const filteredNotices = store.notices.filter((n) => {
    const matchesCategory = selectedCategory === 'all' || n.category === selectedCategory;
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="py-16 bg-stone-50 min-h-[70vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mb-10">
          <div className="text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-2">
            অফিসিয়াল বিজ্ঞপ্তি ও প্রেস রিলিজ
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            কেন্দ্রীয় নোটিশ বোর্ড ও সাংগঠনিক আপডেট
          </h2>
          <p className="mt-2 text-stone-600 text-sm leading-relaxed">
            পাটগ্রাম কল্যাণ সমিতি ও ছাত্র কল্যাণ সমিতির সকল গুরুত্বপূর্ণ সভা, পুনর্গঠন বিজ্ঞপ্তি, নির্বাচন ও সাধারণ নির্দেশনাবলী এখানে নিয়মিত প্রকাশ করা হয়।
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8 bg-white p-3 rounded-2xl border border-stone-200">
          <div className="flex flex-wrap items-center gap-1">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedCategory === c.id
                    ? 'bg-emerald-800 text-white shadow-sm'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="বিজ্ঞপ্তি খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Notice List */}
        <div className="space-y-4">
          {filteredNotices.length > 0 ? (
            filteredNotices.map((notice) => (
              <div
                key={notice.id}
                onClick={() => setActiveModalNotice(notice)}
                className="bg-white p-6 rounded-2xl border border-stone-200 hover:border-emerald-600/40 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    {notice.isPinned && (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold">
                        <Pin className="w-3 h-3 text-amber-700" /> পিনযুক্ত
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[11px] font-semibold">
                      {notice.category === 'urgent'
                        ? 'জরুরি'
                        : notice.category === 'student'
                        ? 'ছাত্র সংগঠন'
                        : 'সাধারণ বিজ্ঞপ্তি'}
                    </span>
                    <span className="text-xs text-stone-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {notice.publishDate}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-stone-900 group-hover:text-emerald-800 transition-colors">
                    {notice.title}
                  </h3>

                  <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                    {notice.content}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0 text-xs text-stone-500">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-stone-400" />
                    <span>{notice.author}</span>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold group-hover:bg-emerald-800 group-hover:text-white transition-all">
                    বিস্তারিত পড়ুন
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white p-12 text-center rounded-2xl border border-stone-200 text-stone-500 text-sm">
              কোনো বিজ্ঞপ্তি খুঁজে পাওয়া যায়নি।
            </div>
          )}
        </div>
      </div>

      {/* Notice View Modal */}
      {activeModalNotice && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-8 shadow-xl max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-100 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded">
                    {activeModalNotice.category}
                  </span>
                  <span className="text-xs text-stone-400">{activeModalNotice.publishDate}</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-stone-900">
                  {activeModalNotice.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveModalNotice(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="text-sm text-stone-700 leading-relaxed space-y-4 mb-8 whitespace-pre-line">
              {activeModalNotice.content}
            </div>

            <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
              <div>বিজ্ঞপ্তি প্রদানকারী: <strong className="text-stone-800">{activeModalNotice.author}</strong></div>
              <button
                onClick={() => setActiveModalNotice(null)}
                className="px-4 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
