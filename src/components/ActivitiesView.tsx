/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from '../db/store.ts';
import { HeartHandshake, MapPin, CheckCircle } from 'lucide-react';
import educationAidImg from '../assets/images/education_support_aid_1794505314899.jpg';
import medicalReliefImg from '../assets/images/emergency_medical_relief_1794505315080.jpg';

interface ActivitiesViewProps {
  openAidModal: () => void;
}

export const ActivitiesView: React.FC<ActivitiesViewProps> = ({ openAidModal }) => {
  const store = useAppStore();
  const [filterRegion, setFilterRegion] = useState<'all' | 'rangpur' | 'patgram'>('all');

  const programs = [
    {
      id: 'p1',
      title: 'দরিদ্র ও মেধাবী শিক্ষার্থীদের এককালীন মেধা বৃত্তি ও বই বিতরণ',
      category: 'শিক্ষা সহায়তা',
      region: 'patgram',
      regionName: 'পাটগ্রাম উপজেলা ও রংপুর',
      image: educationAidImg,
      status: 'চলমান কর্মসূচি (Active)',
      statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      date: '২০২৬ শিক্ষাবর্ষ',
      description: 'পাটগ্রামের প্রান্তিক এলাকার অস্বচ্ছল মেধাবী শিক্ষার্থীদের পাঠ্যবই, পরীক্ষার ফি ও বিশ্ববিদ্যালয়ে ভর্তির সহায়তায় নিয়মিত আর্থিক অনুদান প্রদান।',
      beneficiaries: '৫০+ শিক্ষার্থী প্রতি বছর',
    },
    {
      id: 'p2',
      title: 'অসহায় রোগীদের জরুরি চিকিৎসা ও ওষুধ সহায়তা ক্যাম্প',
      category: 'স্বাস্থ্য ও চিকিৎসা',
      region: 'rangpur',
      regionName: 'রংপুর মেডিকেল ও পাটগ্রাম',
      image: medicalReliefImg,
      status: 'চলমান কর্মসূচি (Active)',
      statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      date: 'সার্বক্ষণিক সেবা',
      description: 'রংপুর মেডিকেল কলেজ হাসপাতাল ও বিভিন্ন ক্লিনিকে চিকিৎসাধীন পাটগ্রামের অসহায় রোগীদের আর্থিক সাহায্য ও জরুরি রক্তদাতার সমন্বয়।',
      beneficiaries: '১০০+ পরিবার',
    },
    {
      id: 'p3',
      title: 'শীতবস্ত্র বিতরণ ও দুর্যোগকালীন জরুরি মানবিক ত্রাণ',
      category: 'মানবিক ও দুর্যোগ',
      region: 'patgram',
      regionName: 'পাটগ্রাম উপজেলার ৮টি ইউনিয়ন ও পৌরসভা',
      status: 'পরিকল্পিত কর্মসূচি (Planned)',
      statusColor: 'bg-amber-100 text-amber-800 border-amber-300',
      date: 'শীতকালীন মৌসুম ২০২৬',
      description: 'উত্তরবঙ্গের তীব্র শীতে পাটগ্রামের তিস্তা ও ধরলা তীরবর্তী চরাঞ্চলের অসহায় শীতার্ত মানুষের মাঝে কম্বল ও গরম কাপড় বিতরণ।',
      beneficiaries: '৫০০+ দুস্থ পরিবার',
    },
    {
      id: 'p4',
      title: 'রংপুর মহানগরীতে পাটগ্রামবাসীর বার্ষিক পুনর্মিলনী ও মেধা সংবর্ধনা',
      category: 'সামাজিক ও ভ্রাতৃত্ব',
      region: 'rangpur',
      regionName: 'রংপুর মহানগরী',
      status: 'পরিকল্পিত কর্মসূচি (Planned)',
      statusColor: 'bg-amber-100 text-amber-800 border-amber-300',
      date: 'ডিসেম্বর ২০২৬',
      description: 'রংপুরে বসবাসরত সকল পাটগ্রামবাসীর পারস্পরিক ভ্রাতৃত্ব ও সৌহার্দ্য বিনির্মাণে বাৎসরিক মিলনমেলা, ক্রীড়া ও মেধা সংবর্ধনা উৎসব।',
      beneficiaries: 'সকল সদস্য ও পরিবারবর্গ',
    },
  ];

  const filteredPrograms =
    filterRegion === 'all' ? programs : programs.filter((p) => p.region === filterRegion);

  return (
    <div className="py-16 bg-white min-h-[70vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-2">
              কল্যাণ ও উন্নয়নমূলক কার্যক্রম
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              শিক্ষা, স্বাস্থ্য ও মানবিক সহায়তা কর্মসূচি
            </h2>
            <p className="mt-2 text-stone-600 text-sm leading-relaxed">
              {store.settings.articles.welfareDescription}
            </p>
          </div>

          <button
            onClick={openAidModal}
            className="self-start md:self-auto px-5 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <HeartHandshake className="w-4 h-4 text-amber-300" />
            <span>সহায়তার জন্য আবেদন করুন</span>
          </button>
        </div>

        {/* Region Filter Buttons */}
        <div className="flex items-center gap-2 mb-8 p-1 bg-stone-100 rounded-xl w-fit border border-stone-200">
          <button
            onClick={() => setFilterRegion('all')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterRegion === 'all'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            সকল কর্মসূচি
          </button>
          <button
            onClick={() => setFilterRegion('patgram')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterRegion === 'patgram'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            পাটগ্রাম উপজেলার কল্যাণ
          </button>
          <button
            onClick={() => setFilterRegion('rangpur')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterRegion === 'rangpur'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            রংপুর মহানগরীতে কল্যাণ
          </button>
        </div>

        {/* Program Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filteredPrograms.map((prog) => (
            <div
              key={prog.id}
              className="bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-lg transition-all flex flex-col group"
            >
              {/* Optional Real Image Banner */}
              {prog.image && (
                <div className="h-56 w-full overflow-hidden relative">
                  <img
                    src={prog.image}
                    alt={prog.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-3 py-1 rounded-md bg-stone-900/80 backdrop-blur-sm text-white text-xs font-semibold">
                      {prog.category}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3">
                    <span
                      className={`px-3 py-1 rounded-md text-xs font-bold border backdrop-blur-sm ${prog.statusColor}`}
                    >
                      {prog.status}
                    </span>
                  </div>
                </div>
              )}

              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  {!prog.image && (
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100">
                        {prog.category}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${prog.statusColor}`}>
                        {prog.status}
                      </span>
                    </div>
                  )}

                  <h3 className="text-lg font-bold text-stone-900 mb-2 leading-snug group-hover:text-emerald-800 transition-colors">
                    {prog.title}
                  </h3>

                  <p className="text-xs text-stone-600 leading-relaxed mb-4">
                    {prog.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    <span>{prog.regionName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium text-emerald-800">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>লক্ষ্যমাত্রা: {prog.beneficiaries}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
