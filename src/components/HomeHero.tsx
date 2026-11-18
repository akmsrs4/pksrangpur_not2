/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../db/store.ts';
import { UserPlus, ArrowRight, Sparkles, HeartHandshake } from 'lucide-react';
import heroCommunityImg from '../assets/images/patgram_hero_community_1794505313964.jpg';

interface HomeHeroProps {
  setActiveTab: (tab: string) => void;
  openMemberModal: () => void;
  openAidModal: () => void;
}

export const HomeHero: React.FC<HomeHeroProps> = ({ setActiveTab, openMemberModal, openAidModal }) => {
  const store = useAppStore();
  const settings = store.settings;
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [settings.heroImageUrl]);

  const resolvedHeroSrc =
    !imgError && settings.heroImageUrl?.trim() ? settings.heroImageUrl.trim() : heroCommunityImg;

  return (
    <div className="relative overflow-hidden bg-stone-900 text-white">
      {/* Background Graphic Image with measured scrim */}
      <div className="absolute inset-0 z-0">
        <img
          src={resolvedHeroSrc}
          onError={() => setImgError(true)}
          alt={settings.organizationNameBn}
          className="w-full h-full object-cover object-center brightness-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900/80 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="max-w-3xl">
          {/* Trust Kicker */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900/70 border border-emerald-600/40 text-emerald-300 text-xs font-semibold mb-6 shadow-sm backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>প্রতিষ্ঠাকাল: {settings.establishedYear} সাল · পুনর্গঠন ও আধুনিকায়ন</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight mb-6">
            পাটগ্রামের মানুষের ঐক্য, <span className="text-emerald-400">ভ্রাতৃত্ব</span> ও সামগ্রিক কল্যাণ
          </h1>

          <p className="text-base sm:text-lg text-stone-200 leading-relaxed mb-8 max-w-2xl font-light">
            রংপুর মহানগরীতে বসবাসরত পাটগ্রাম উপজেলার শিক্ষক, শিক্ষার্থী, পেশাজীবী ও সাধারণ মানুষের ভ্রাতৃত্ববোধ সুদৃঢ় করা এবং নিজ এলাকার অসহায়, দরিদ্র ও সুবিধাবঞ্চিত মানুষের পাশে দাঁড়ানোর কেন্দ্রীয় ডিজিটাল প্ল্যাটফর্ম।
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-4 mb-12">
            <button
              onClick={openMemberModal}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg hover:shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>অনলাইনে সদস্যপদ আবেদন</span>
            </button>
            <button
              onClick={openAidModal}
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-stone-800/90 hover:bg-stone-750 text-stone-100 font-semibold text-sm border border-stone-700 backdrop-blur-sm transition-all cursor-pointer"
            >
              <HeartHandshake className="w-4 h-4 text-emerald-400" />
              <span>শিক্ষা ও চিকিৎসা সহায়তা আবেদন</span>
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className="flex items-center gap-1.5 px-4 py-3.5 text-stone-300 hover:text-white text-sm font-medium transition-colors cursor-pointer"
            >
              <span>আমাদের ইতিহাস</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 Key Pillars Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-stone-800/80">
          <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800 backdrop-blur-sm">
            <div className="text-2xl sm:text-3xl font-bold text-amber-400 mb-1">{settings.establishedYear} সাল</div>
            <div className="text-xs text-stone-400 font-medium">প্রতিষ্ঠাতা ঐতিহ্য ও দীর্ঘমেয়াদি অঙ্গীকার</div>
          </div>
          <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800 backdrop-blur-sm">
            <div className="text-2xl sm:text-3xl font-bold text-emerald-400 mb-1">৭টি বিশেষায়িত</div>
            <div className="text-xs text-stone-400 font-medium">কল্যাণ, শিক্ষা, চিকিৎসা ও সমাজ তহবিল</div>
          </div>
          <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800 backdrop-blur-sm">
            <div className="text-2xl sm:text-3xl font-bold text-white mb-1">১০০% ডিজিটাল</div>
            <div className="text-xs text-stone-400 font-medium">স্বচ্ছ হিসাবরক্ষণ ও আধুনিক ডিজিটাল প্রশাসন</div>
          </div>
          {settings.enableStudentWing ? (
            <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800 backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-300 mb-1">ছাত্র কল্যাণ</div>
              <div className="text-xs text-stone-400 font-medium">শিক্ষার্থীদের স্বতন্ত্র উইং ও সহায়তা</div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800 backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-300 mb-1">সদস্য ও রক্তদান</div>
              <div className="text-xs text-stone-400 font-medium">জরুরি রক্তদান ও সামাজিক নেটওয়ার্ক</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
