/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAppStore } from '../db/store.ts';
import { GraduationCap, BookOpen, UserPlus, Sparkles } from 'lucide-react';
import { PersonAvatar } from './PersonAvatar.tsx';

interface StudentWingViewProps {
  openMemberModal: () => void;
  openAidModal: () => void;
}

export const StudentWingView: React.FC<StudentWingViewProps> = ({ openMemberModal, openAidModal }) => {
  const store = useAppStore();
  const studentCommittees = store.committees.filter((c) => c.wing === 'student_wing');
  const activeStudentCommittee = studentCommittees.find((c) => c.isCurrent) || studentCommittees[0];

  const studentPrograms = [
    {
      title: 'উচ্চশিক্ষা ও বিশ্ববিদ্যালয় ভর্তি প্রস্তুতি',
      desc: 'পাটগ্রাম থেকে আগত এইচএসসি পাস শিক্ষার্থীদের রংপুর ও দেশের শীর্ষ পাবলিক বিশ্ববিদ্যালয়ে ভর্তি পরীক্ষার বিশেষ মেন্টরিং ও পরামর্শ।',
    },
    {
      title: 'মেধাবী ও অস্বচ্ছল শিক্ষার্থীদের শিক্ষাবৃত্তি',
      desc: 'পাটগ্রাম কল্যাণ সমিতির কেন্দ্রীয় শিক্ষা তহবিল থেকে নিয়মিত সেমিস্টার ফি, বইপত্র ও শিক্ষা উপকরণ সহায়তা প্রদান।',
    },
    {
      title: 'ক্যারিয়ার গাইডলাইন ও বিসিএস/চাকরি প্রস্তুতি',
      desc: 'পড়াশোনা শেষ করা ও শেষ বর্ষের শিক্ষার্থীদের জন্য রংপুর শহরে অবস্থানরত পাটগ্রামের বিসিএস ক্যাডার ও কর্মকর্তাদের দ্বারা সেমিনার।',
    },
    {
      title: 'আইটি ও ডিজিটাল স্কিল উন্নয়ন',
      desc: 'আধুনিক ফ্রিল্যান্সিং, কোডিং ও ডিজিটাল মার্কেটিং দক্ষতা অর্জনে ছাত্র সংগঠনের উদ্যোগে বিশেষ কর্মশালা।',
    },
    {
      title: 'বার্ষিক নবীন বরণ ও মেধা সংবর্ধনা',
      desc: 'রংপুর মহানগরীতে নতুন ভর্তি হওয়া পাটগ্রামের শিক্ষার্থীদের বরণ এবং বিভিন্ন পরীক্ষায় জিপিএ-৫ প্রাপ্তদের সম্মাননা ক্রেস্ট প্রদান।',
    },
    {
      title: 'জরুরি রক্তদান ও শিক্ষার্থী সহায়তা ডিরেক্টরি',
      desc: 'রংপুর মেডিকেল ও বিভিন্ন ক্লিনিকে চিকিৎসাধীন রোগীদের জন্য শিক্ষার্থীদের সমন্বয়ে তাৎক্ষণিক রক্তদাতা সহায়তা সেল।',
    },
  ];

  return (
    <div className="py-16 bg-stone-50 min-h-[70vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-100 text-emerald-900 text-xs font-bold mb-3 border border-emerald-200">
            <GraduationCap className="w-4 h-4 text-emerald-800" />
            <span>অঙ্গ সংগঠন উইং</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            {store.settings.studentWingNameBn || 'পাটগ্রাম ছাত্র কল্যাণ সমিতি, রংপুর'}
          </h2>
          <p className="mt-3 text-stone-600 text-sm sm:text-base leading-relaxed">
            {store.settings.articles.studentWingSummary}
          </p>
        </div>

        {/* CTA Hero Strip for Students */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-8 sm:p-10 text-white mb-14 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>তুমি কি রংপুরে অধ্যয়নরত পাটগ্রামের শিক্ষার্থী?</span>
            </h3>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-xl">
              আজই ছাত্র সদস্যপদে যুক্ত হয়ো। শিক্ষা জীবনে ভ্রাতৃত্বের মেলবন্ধন এবং ভবিষ্যৎ ক্যারিয়ারে পাটগ্রামের অগ্রজদের দিকনির্দেশনা পাওয়ার সুযোগ নাও।
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              onClick={openMemberModal}
              className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs sm:text-sm transition-all shadow cursor-pointer flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>ছাত্র সদস্য আবেদন</span>
            </button>
            <button
              onClick={openAidModal}
              className="px-4 py-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-950 text-white text-xs sm:text-sm font-semibold border border-emerald-600 cursor-pointer"
            >
              শিক্ষা সহায়তার আবেদন
            </button>
          </div>
        </div>

        {/* Programs Grid */}
        <div className="mb-14">
          <h3 className="text-2xl font-bold text-stone-900 mb-6 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-800" />
            <span>ছাত্র সংগঠনের চলমান ও পরিকল্পিত কার্যক্রম</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studentPrograms.map((prog, i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-xl border border-stone-200 hover:border-emerald-600/40 hover:shadow-md transition-all space-y-3"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center text-xs font-bold border border-emerald-200">
                  ০{i + 1}
                </div>
                <h4 className="text-base font-bold text-stone-900">{prog.title}</h4>
                <p className="text-xs text-stone-600 leading-relaxed">{prog.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Student Committee Section */}
        {activeStudentCommittee ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 shadow-sm">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-xl font-bold text-stone-900">
                  {activeStudentCommittee.title}
                </h3>
                <p className="text-xs text-stone-500">
                  মেয়াদকাল: {activeStudentCommittee.startYear} - {activeStudentCommittee.endYear}
                </p>
              </div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold self-start sm:self-auto">
                বর্তমান ছাত্র পরিষদ
              </span>
            </div>

            {activeStudentCommittee.positions.filter((p) => p.isPublished).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {activeStudentCommittee.positions
                  .filter((p) => p.isPublished)
                  .map((pos) => (
                    <div
                      key={pos.id}
                      className="p-5 rounded-xl border border-stone-200 bg-stone-50 flex flex-col items-center text-center"
                    >
                      <PersonAvatar
                        photoUrl={pos.photoUrl}
                        name={pos.memberNameBn}
                        sizeClass="w-16 h-16"
                        roundedClass="rounded-full"
                        bgClass="bg-emerald-800"
                        iconClass="text-emerald-100"
                        borderClass="border-2 border-emerald-700/30"
                        className="mb-3"
                      />
                      <div className="text-xs font-bold text-emerald-800 mb-1">
                        {pos.title}
                      </div>
                      <h5 className="text-sm font-bold text-stone-900 mb-1">{pos.memberNameBn}</h5>
                      <div className="text-[11px] text-stone-400 mt-1">
                        {store.settings.studentWingNameBn || 'পাটগ্রাম ছাত্র কল্যাণ সমিতি, রংপুর'}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-stone-50 rounded-xl border border-dashed border-stone-300 text-xs text-stone-500">
                ছাত্র কল্যাণ পরিষদের পদবির তথ্য এখনো পাবলিক সাইটে প্রকাশিত হয়নি।
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-8 text-center text-xs text-stone-500">
            ছাত্র কল্যাণ সমিতির কমিটি তালিকা এখনো প্রকাশিত হয়নি। অ্যাডমিন প্যানেল থেকে অনুমোদনের পর এখানে দেখা যাবে।
          </div>
        )}
      </div>
    </div>
  );
};
