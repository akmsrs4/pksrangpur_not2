/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAppStore } from '../db/store.ts';
import { Landmark, Compass, Award, BookOpen, Layers, CheckCircle2 } from 'lucide-react';
import { PersonAvatar } from './PersonAvatar.tsx';

export const AboutSection: React.FC = () => {
  const store = useAppStore();
  const settings = store.settings;

  const objectives = [
    {
      title: 'ঐক্য ও ভ্রাতৃত্ববোধ সৃষ্টি',
      desc: 'রংপুর মহানগরীতে বসবাসরত, কর্মরত এবং অধ্যয়নরত পাটগ্রাম উপজেলার মানুষের মধ্যে পারস্পরিক যোগাযোগ, সৌহার্দ্য ও ভ্রাতৃত্ব স্থাপন।',
    },
    {
      title: 'দরিদ্র ও সুবিধাবঞ্চিতদের কল্যাণ',
      desc: 'পাটগ্রাম উপজেলার প্রত্যন্ত এলাকার অসহায়, সুবিধাবঞ্চিত ও দুস্থ পরিবারের পাশে দাঁড়ানো এবং তাদের জীবনমান উন্নয়নে কাজ করা।',
    },
    {
      title: 'শিক্ষা সহায়তা ও মেধা বিকাশ',
      desc: 'দরিদ্র ও মেধাবী শিক্ষার্থীদের উপবৃত্তি, বই-পুস্তক, উচ্চশিক্ষা ও ভর্তি পরীক্ষায় গাইডলাইন প্রদান এবং নিয়মিত সম্মাননা প্রদান।',
    },
    {
      title: 'জরুরি স্বাস্থ্য ও মানবিক ত্রাণ',
      desc: 'গুরুতর অসুস্থ রোগীদের চিকিৎসা সহায়তা, রক্তদান নেটওয়ার্ক এবং বন্যা বা প্রাকৃতিক দুর্যোগকালীন তাৎক্ষণিক ত্রাণ তৎপরতা।',
    },
    {
      title: 'তরুণ ও শিক্ষার্থীদের দিকনির্দেশনা',
      desc: settings.enableStudentWing
        ? `নতুন প্রজন্মের শিক্ষার্থীদের ক্যারিয়ার ও দক্ষতা উন্নয়নে ${settings.studentWingNameBn || 'ছাত্র কল্যাণ সমিতি'}-এর মাধ্যমে বিশেষ সেমিনার আয়োজন।`
        : 'নতুন প্রজন্ম ও তরুণদের মেধা, ক্যারিয়ার পরামর্শ ও দক্ষতা উন্নয়নে বিশেষ সেমিনার ও কর্মশালা আয়োজন।',
    },
    {
      title: 'ডিজিটাল ও স্বচ্ছ সাংগঠনিক ব্যবস্থাপনা',
      desc: 'সংগঠনের সদস্যপদ, প্রতিটি আর্থিক তহবিল এবং কার্যবিবরণীকে আধুনিক প্রযুক্তির মাধ্যমে সম্পূর্ণ স্বচ্ছ ও জবাবদিহিতামূলক করা।',
    },
  ];

  const publishedFounders = (settings.founders || [])
    .filter((f) => f.category === 'founder' && f.isPublished)
    .sort((a, b) => a.priority - b.priority);
  const publishedFoundingMembers = (settings.founders || [])
    .filter((f) => f.category === 'founding_member' && f.isPublished)
    .sort((a, b) => a.priority - b.priority);

  return (
    <div className="py-16 bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-2">
            পরিচিতি ও পটভূমি
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            ঐতিহ্যবাহী সূচনা থেকে আধুনিক ডিজিটাল রূপান্তর
          </h2>
          <p className="mt-3 text-stone-600 text-sm sm:text-base leading-relaxed">
            {settings.articles.aboutSummary}
          </p>
        </div>

        {/* Founding Story Box */}
        <div className="bg-white rounded-2xl border border-stone-200 p-8 sm:p-10 mb-12 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">
                প্রতিষ্ঠাকাল {settings.establishedYear} ও পুনর্গঠনের ঐতিহাসিক প্রেক্ষাপট
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed mb-4">
                {settings.articles.foundingHistory}
              </p>
              <p className="text-sm text-stone-600 leading-relaxed mb-4">
                {settings.articles.reorganizationNote}
              </p>
              <div className="flex flex-wrap gap-3 pt-2 text-xs">
                <span className="px-3 py-1 bg-stone-100 text-stone-700 rounded-md font-medium border border-stone-200">
                  মূল নীতি: মানবকল্যাণ ও আঞ্চলিক সংহতি
                </span>
                {settings.enableStudentWing && (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-md font-medium border border-emerald-200">
                    স্বতন্ত্র ছাত্র উইং: {settings.studentWingNameBn || 'ছাত্র কল্যাণ সমিতি'}
                  </span>
                )}
                <span className="px-3 py-1 bg-amber-50 text-amber-800 rounded-md font-medium border border-amber-200">
                  স্থাপিত: {settings.establishedYear} সাল
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Founders & Founding Members Showcase */}
        {(publishedFounders.length > 0 || publishedFoundingMembers.length > 0) && (
          <div className="mb-14 space-y-8">
            {publishedFounders.length > 0 && (
              <div className="bg-white rounded-2xl border border-emerald-200/80 p-6 sm:p-8 shadow-sm">
                <h3 className="text-xl font-bold text-stone-900 mb-5 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-600" />
                  <span>প্রতিষ্ঠাতাবৃন্দ (Founders)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {publishedFounders.map((founder) => (
                    <div
                      key={founder.id}
                      className="flex items-start gap-4 p-4 rounded-xl bg-emerald-50/50 border border-emerald-100"
                    >
                      <PersonAvatar
                        photoUrl={founder.photoUrl}
                        name={founder.nameBn}
                        sizeClass="w-12 h-12"
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
                          <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">{founder.bioBn}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {publishedFoundingMembers.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-700" />
                  <span>প্রতিষ্ঠাতা সদস্যবৃন্দ (Founding Members)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {publishedFoundingMembers.map((member) => (
                    <div
                      key={member.id}
                      className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-center gap-3"
                    >
                      <PersonAvatar
                        photoUrl={member.photoUrl}
                        name={member.nameBn}
                        sizeClass="w-10 h-10"
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

        {/* Objectives Grid */}
        <div className="mb-14">
          <h3 className="text-2xl font-bold text-stone-900 mb-6 flex items-center gap-2">
            <Compass className="w-6 h-6 text-emerald-700" />
            <span>সংগঠনের মূল লক্ষ্য ও উদ্দেশ্যসমূহ</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {objectives.map((obj, i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-xl border border-stone-200 hover:border-emerald-500/50 hover:shadow-md transition-all space-y-3"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-800 text-amber-400 flex items-center justify-center text-xs font-bold">
                  ০{i + 1}
                </div>
                <h4 className="text-base font-bold text-stone-900">{obj.title}</h4>
                <p className="text-xs text-stone-600 leading-relaxed">{obj.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Organizational Vision & Governance Philosophy */}
        <div className="bg-emerald-950 text-emerald-100 rounded-2xl p-8 sm:p-10 border border-emerald-900">
          <div className="flex items-center gap-3 mb-4">
            <Layers className="w-6 h-6 text-amber-400" />
            <h3 className="text-xl font-bold text-white">
              ভবিষ্যৎ লক্ষ্য ও আধুনিক সাংগঠনিক ব্যবস্থাপনা
            </h3>
          </div>
          <p className="text-sm text-emerald-200 leading-relaxed mb-6">
            {settings.articles.visionMission}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs text-emerald-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>সহজ ও স্বচ্ছ সদস্যপদ এবং পদবি ব্যবস্থাপনা</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>বিগত সকল কমিটির ঐতিহাসিক আর্কাইভ</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>সুরক্ষিত আর্থিক হিসাবরক্ষণ ও অডিট ট্রেইল</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
