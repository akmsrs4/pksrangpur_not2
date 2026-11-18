/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../db/store.ts';
import { Users, Lock, Award, BookOpen } from 'lucide-react';
import { PersonAvatar } from './PersonAvatar.tsx';

export const CommitteeView: React.FC = () => {
  const store = useAppStore();
  const centralTerms = store.committees.filter((c) => c.wing === 'central');
  const advisoryTerms = store.committees.filter((c) => c.wing === 'advisory');
  const [selectedTermId, setSelectedTermId] = useState<string>(
    centralTerms.find((c) => c.isCurrent)?.id || centralTerms[0]?.id || ''
  );
  const [selectedAdvisoryTermId, setSelectedAdvisoryTermId] = useState<string>(
    advisoryTerms.find((c) => c.isCurrent)?.id || advisoryTerms[0]?.id || ''
  );

  useEffect(() => {
    if (!centralTerms.some((c) => c.id === selectedTermId)) {
      setSelectedTermId(centralTerms.find((c) => c.isCurrent)?.id || centralTerms[0]?.id || '');
    }
  }, [centralTerms, selectedTermId]);

  useEffect(() => {
    if (!advisoryTerms.some((c) => c.id === selectedAdvisoryTermId)) {
      setSelectedAdvisoryTermId(advisoryTerms.find((c) => c.isCurrent)?.id || advisoryTerms[0]?.id || '');
    }
  }, [advisoryTerms, selectedAdvisoryTermId]);

  const selectedTerm = centralTerms.find((c) => c.id === selectedTermId);
  const selectedAdvisoryTerm = advisoryTerms.find((c) => c.id === selectedAdvisoryTermId);
  const publishedAdvisoryPositions = (selectedAdvisoryTerm?.positions || []).filter((pos) => pos.isPublished);

  // Privacy enforcement: filter only published positions & never render phone/personal contact
  const publishedPositions = (selectedTerm?.positions || []).filter((pos) => pos.isPublished);
  const publishedFounders = (store.settings.founders || [])
    .filter((f) => f.category === 'founder' && f.isPublished)
    .sort((a, b) => a.priority - b.priority);
  const publishedFoundingMembers = (store.settings.founders || [])
    .filter((f) => f.category === 'founding_member' && f.isPublished)
    .sort((a, b) => a.priority - b.priority);

  return (
    <div className="py-16 bg-white min-h-[70vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mb-10">
          <div className="text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-2">
            সাংগঠনিক নেতৃত্ব ও ইতিহাস
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            প্রতিষ্ঠাতাবৃন্দ, কার্যকরী পরিষদ ও কমিটির আর্কাইভ
          </h2>
          <p className="mt-2 text-stone-600 text-sm leading-relaxed">
            সংগঠনের {store.settings.establishedYear} সালের প্রতিষ্ঠালগ্ন থেকে শুরু করে বর্তমান কার্যকরী পরিষদ পর্যন্ত অনুমোদিত ও প্রকাশিত দায়িত্বপ্রাপ্ত নেতৃবৃন্দ এবং প্রতিষ্ঠাতাদের তথ্য এখানে সংরক্ষিত থাকে।
          </p>
        </div>

        {/* Founders & Founding Members Showcase */}
        {(publishedFounders.length > 0 || publishedFoundingMembers.length > 0) && (
          <div className="mb-10 space-y-6">
            {publishedFounders.length > 0 && (
              <div className="bg-emerald-50/40 rounded-2xl border border-emerald-200/80 p-6">
                <h3 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-600" />
                  <span>প্রতিষ্ঠাতাবৃন্দ (Founders)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {publishedFounders.map((founder) => (
                    <div
                      key={founder.id}
                      className="flex items-start gap-3.5 p-4 rounded-xl bg-white border border-emerald-100 shadow-xs"
                    >
                      <PersonAvatar
                        photoUrl={founder.photoUrl}
                        name={founder.nameBn}
                        sizeClass="w-11 h-11"
                        roundedClass="rounded-xl"
                        bgClass="bg-emerald-800"
                        iconClass="text-amber-300"
                        borderClass="border border-emerald-700/40"
                      />
                      <div className="min-w-0">
                        <div className="text-base font-bold text-stone-900">{founder.nameBn}</div>
                        <div className="text-xs font-semibold text-emerald-800 mt-0.5">
                          {founder.designationBn}
                        </div>
                        {founder.bioBn && (
                          <p className="text-xs text-stone-600 mt-1 leading-relaxed">{founder.bioBn}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {publishedFoundingMembers.length > 0 && (
              <div className="bg-stone-50 rounded-2xl border border-stone-200 p-6">
                <h3 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-700" />
                  <span>প্রতিষ্ঠাতা সদস্যবৃন্দ (Founding Members)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {publishedFoundingMembers.map((member) => (
                    <div
                      key={member.id}
                      className="p-3.5 rounded-xl bg-white border border-stone-200 flex items-center gap-3"
                    >
                      <PersonAvatar
                        photoUrl={member.photoUrl}
                        name={member.nameBn}
                        sizeClass="w-9 h-9"
                        roundedClass="rounded-full"
                        bgClass="bg-stone-800"
                        iconClass="text-amber-300"
                        borderClass="border border-stone-700"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-stone-900 truncate">{member.nameBn}</div>
                        <div className="text-[11px] text-stone-600 truncate">{member.designationBn}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Data Privacy Badge Notice */}
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs mb-8 flex items-start gap-3">
          <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">সদস্য তথ্যের গোপনীয়তা সুরক্ষা নীতি:</span> সাধারণ ও ছাত্র সদস্যদের ব্যক্তিগত তথ্য এবং কমিটির সদস্যদের মোবাইল নম্বর ও ব্যক্তিগত ঠিকানা পাবলিক ওয়েবসাইটে প্রকাশ করা হয় না। কেবল অ্যাডমিন কর্তৃক অনুমোদিত নাম, পদবি ও ছবি প্রদর্শিত হয়।
          </div>
        </div>

        {/* Committee Term Switcher Tabs */}
        {centralTerms.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-8 pb-4 border-b border-stone-200">
            {centralTerms.map((term) => (
              <button
                key={term.id}
                onClick={() => setSelectedTermId(term.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                  selectedTermId === term.id
                    ? 'bg-emerald-800 text-white shadow-sm'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <span>{term.title}</span>
                {term.isCurrent && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                    বর্তমান পরিষদ
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Committee Members Grid */}
        {selectedTerm ? (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-stone-900">{selectedTerm.title}</h3>
                <p className="text-xs text-stone-500">
                  কার্যকাল: {selectedTerm.startYear} - {selectedTerm.endYear}
                </p>
              </div>
              <div className="text-xs text-stone-500">
                প্রকাশিত পদসংখ্যা: <strong className="text-stone-900">{publishedPositions.length}</strong>
              </div>
            </div>

            {publishedPositions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {publishedPositions.map((pos) => (
                  <div
                    key={pos.id}
                    className="bg-white rounded-xl border border-stone-200 overflow-hidden hover:border-emerald-600/40 hover:shadow-md transition-all p-5 flex flex-col items-center text-center group"
                  >
                    <PersonAvatar
                      photoUrl={pos.photoUrl}
                      name={pos.memberNameBn}
                      sizeClass="w-20 h-20"
                      roundedClass="rounded-full"
                      bgClass="bg-gradient-to-br from-emerald-100 to-stone-200"
                      iconClass="text-emerald-800/75"
                      borderClass="border-2 border-emerald-700/20"
                      className="mb-4 group-hover:scale-105 transition-transform"
                    />

                    <div className="inline-block px-3 py-1 rounded-md bg-emerald-50 text-emerald-800 text-xs font-bold mb-2 border border-emerald-100">
                      {pos.title}
                    </div>

                    <h4 className="text-base font-bold text-stone-900 mb-1 leading-snug">
                      {pos.memberNameBn}
                    </h4>

                    <div className="text-[11px] text-stone-400 mt-1">
                      {store.settings.organizationNameBn}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-300">
                <Users className="w-10 h-10 text-stone-400 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-stone-700">
                  এই কমিটির পদবির তথ্য এখনো পাবলিক সাইটে প্রকাশিত করা হয়নি
                </h4>
                <p className="text-xs text-stone-500 mt-1">
                  অ্যাডমিন প্যানেল থেকে দায়িত্বপ্রাপ্ত প্রশাসক অনুমোদন দিলে এখানে নাম ও ছবি প্রদর্শিত হবে।
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-300">
            <Users className="w-10 h-10 text-stone-400 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-stone-700">
              কার্যকরী পরিষদের তালিকা এখনো প্রকাশিত হয়নি
            </h4>
            <p className="text-xs text-stone-500 mt-1">
              অ্যাডমিন প্যানেল থেকে নতুন কমিটি যুক্ত ও অনুমোদন করা হলে এখানে প্রদর্শিত হবে।
            </p>
          </div>
        )}

        {/* Advisory Council Showcase */}
        {advisoryTerms.length > 0 && (
          <div className="mt-14 pt-10 border-t border-stone-200 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
                  অভিভাবক ও পরামর্শক পর্ষদ
                </div>
                <h3 className="text-2xl font-extrabold text-stone-900">
                  উপদেষ্টা পরিষদ (Advisory Council)
                </h3>
              </div>

              {advisoryTerms.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  {advisoryTerms.map((term) => (
                    <button
                      key={term.id}
                      onClick={() => setSelectedAdvisoryTermId(term.id)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedAdvisoryTermId === term.id
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {term.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedAdvisoryTerm && publishedAdvisoryPositions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {publishedAdvisoryPositions.map((pos) => (
                  <div
                    key={pos.id}
                    className="bg-amber-50/30 rounded-xl border border-amber-200/80 overflow-hidden hover:border-amber-500/50 hover:shadow-md transition-all p-5 flex flex-col items-center text-center"
                  >
                    <PersonAvatar
                      photoUrl={pos.photoUrl}
                      name={pos.memberNameBn}
                      sizeClass="w-20 h-20"
                      roundedClass="rounded-full"
                      bgClass="bg-gradient-to-br from-amber-100 to-stone-200"
                      iconClass="text-amber-800/75"
                      borderClass="border-2 border-amber-600/25"
                      className="mb-4"
                    />

                    <div className="inline-block px-3 py-1 rounded-md bg-amber-100 text-amber-900 text-xs font-bold mb-2 border border-amber-200">
                      {pos.title}
                    </div>

                    <h4 className="text-base font-bold text-stone-900 mb-1 leading-snug">
                      {pos.memberNameBn}
                    </h4>

                    <div className="text-[11px] text-stone-500 mt-1">
                      {selectedAdvisoryTerm.title}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-300 text-xs text-stone-500">
                উপদেষ্টা পরিষদের সদস্যদের তথ্য এখনো পাবলিক সাইটে প্রকাশিত হয়নি।
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
