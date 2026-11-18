/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from './db/store.ts';
import { Navbar } from './components/Navbar.tsx';
import { Footer } from './components/Footer.tsx';
import { HomeHero } from './components/HomeHero.tsx';
import { AboutSection } from './components/AboutSection.tsx';
import { CommitteeView } from './components/CommitteeView.tsx';
import { StudentWingView } from './components/StudentWingView.tsx';
import { ActivitiesView } from './components/ActivitiesView.tsx';
import { EventsView } from './components/EventsView.tsx';
import { NoticeBoardView } from './components/NoticeBoardView.tsx';
import { ContactView } from './components/ContactView.tsx';
import { MemberApplicationModal } from './components/MemberApplicationModal.tsx';
import { AidApplicationModal } from './components/AidApplicationModal.tsx';
import { AdminPortal } from './components/admin/AdminPortal.tsx';
import { PWAInstallBanner } from './components/PWAInstallBanner.tsx';
import {
  Bell,
  HeartHandshake,
  Users,
  GraduationCap,
  ArrowRight,
  Droplets,
} from 'lucide-react';

export default function App() {
  const store = useAppStore();
  const [activeTab, setActiveTab] = useState<string>('home');
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isAidModalOpen, setIsAidModalOpen] = useState(false);

  useEffect(() => {
    store.applyThemeToDocument(store.settings.themePreset);
  }, [store, store.settings.themePreset]);

  useEffect(() => {
    if (activeTab === 'student-wing' && !store.settings.enableStudentWing) {
      setActiveTab('home');
    }
    if (activeTab === 'events' && !store.settings.enableEventsModule) {
      setActiveTab('home');
    }
  }, [activeTab, store.settings.enableStudentWing, store.settings.enableEventsModule]);

  // If in Admin view, render the dedicated Admin Portal suite
  if (activeTab === 'admin') {
    return <AdminPortal onBackToPublic={() => setActiveTab('home')} />;
  }

  const pinnedNotices = store.notices.filter((n) => n.isPinned);

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col text-stone-900 selection:bg-emerald-600 selection:text-white overflow-x-clip">
      {/* PWA Install Banner */}
      <PWAInstallBanner />

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openMemberModal={() => setIsMemberModalOpen(true)}
        openAidModal={() => setIsAidModalOpen(true)}
      />

      {/* Main Content Body */}
      <main className="flex-1">
        {/* VIEW 1: HOME */}
        {activeTab === 'home' && (
          <div>
            {/* Hero Section */}
            <HomeHero
              setActiveTab={setActiveTab}
              openMemberModal={() => setIsMemberModalOpen(true)}
              openAidModal={() => setIsAidModalOpen(true)}
            />

            {/* Pinned Urgent Notice Marquee/Strip */}
            {pinnedNotices.length > 0 && (
              <div className="bg-amber-50 border-y border-amber-200 py-3 px-4 sm:px-8">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 font-bold text-amber-900 shrink-0">
                    <span className="flex h-2 w-2 rounded-full bg-red-600 animate-ping" />
                    <Bell className="w-4 h-4 text-amber-700" />
                    <span>জরুরি সাংগঠনিক নোটিশ:</span>
                  </div>
                  <div className="text-amber-950 font-medium truncate flex-1 sm:px-4">
                    {pinnedNotices[0].title}
                  </div>
                  <button
                    onClick={() => setActiveTab('notices')}
                    className="font-bold text-emerald-800 hover:text-emerald-900 underline shrink-0 cursor-pointer"
                  >
                    সম্পূর্ণ পড়ুন →
                  </button>
                </div>
              </div>
            )}

            {/* Core Features Overview Grid */}
            <div className="py-16 bg-white border-b border-stone-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl mb-12">
                  <div className="text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-1">
                    আমাদের মূল সেবাসমূহ
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
                    সংগঠনের প্রধান কার্যক্রম ও কল্যাণ উইং
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Card 1: Membership System */}
                  <div className="p-8 rounded-2xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 hover:shadow-md transition-all flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                        <Users className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-stone-900">
                        সদস্যপদ ব্যবস্থাপনা ও ডিজিটাল আইডি
                      </h3>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        রংপুরে বসবাসকারী পাটগ্রামের সকল সাধারণ মানুষ ও শিক্ষার্থীদের কেন্দ্রীয় ডেটাবেজ। অনলাইনে আবেদন করে ডিজিটাল মেম্বারশিপ গ্রহণ করা যায়।
                      </p>
                    </div>
                    <div className="pt-6">
                      <button
                        onClick={() => setIsMemberModalOpen(true)}
                        className="text-xs font-bold text-emerald-800 hover:text-emerald-700 flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>সদস্য হতে আবেদন করুন</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Student Welfare Wing OR Member & Blood Network Card when disabled */}
                  {store.settings.enableStudentWing ? (
                    <div className="p-8 rounded-2xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 hover:shadow-md transition-all flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                          <GraduationCap className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-stone-900">
                          {store.settings.studentWingNameBn || 'ছাত্র কল্যাণ সমিতি'}
                        </h3>
                        <p className="text-xs text-stone-600 leading-relaxed">
                          রংপুর বিশ্ববিদ্যালয়, মেডিকেল ও বিভিন্ন কলেজে পড়ুয়া শিক্ষার্থীদের স্বতন্ত্র অঙ্গ সংগঠন। ক্যারিয়ার সেমিনার ও নবীন বরণ।
                        </p>
                      </div>
                      <div className="pt-6">
                        <button
                          onClick={() => setActiveTab('student-wing')}
                          className="text-xs font-bold text-emerald-800 hover:text-emerald-700 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>ছাত্র সংগঠন দেখুন</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 rounded-2xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 hover:shadow-md transition-all flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                          <Droplets className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-stone-900">
                          সদস্য ও রক্তদান নেটওয়ার্ক / সাংগঠনিক কর্মসূচি
                        </h3>
                        <p className="text-xs text-stone-600 leading-relaxed">
                          সংগঠনের সদস্যদের পারস্পরিক যোগাযোগ, জরুরি রক্তদান নেটওয়ার্ক এবং বছরব্যাপী সমাজসেবামূলক ও সাংগঠনিক কর্মসূচি।
                        </p>
                      </div>
                      <div className="pt-6">
                        <button
                          onClick={() => setActiveTab('activities')}
                          className="text-xs font-bold text-emerald-800 hover:text-emerald-700 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>কর্মসূচি ও সেবা দেখুন</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Card 3: Humanitarian Aid & Healthcare */}
                  <div className="p-8 rounded-2xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 hover:shadow-md transition-all flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                        <HeartHandshake className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-stone-900">
                        শিক্ষা ও জরুরি চিকিৎসা সহায়তা
                      </h3>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        অসচ্ছল ও মেধাবী শিক্ষার্থীদের মাসিক উপবৃত্তি এবং জটিল রোগে আক্রান্ত পাটগ্রামবাসীর জন্য চিকিৎসা তহবিল থেকে জরুরি অনুদান।
                      </p>
                    </div>
                    <div className="pt-6">
                      <button
                        onClick={() => setIsAidModalOpen(true)}
                        className="text-xs font-bold text-emerald-800 hover:text-emerald-700 flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>সহায়তার জন্য আবেদন</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick About Teaser */}
            <AboutSection />
          </div>
        )}

        {/* VIEW 2: ABOUT */}
        {activeTab === 'about' && <AboutSection />}

        {/* VIEW 3: COMMITTEE */}
        {activeTab === 'committee' && <CommitteeView />}

        {/* VIEW 4: STUDENT WING */}
        {activeTab === 'student-wing' && store.settings.enableStudentWing && (
          <StudentWingView
            openMemberModal={() => setIsMemberModalOpen(true)}
            openAidModal={() => setIsAidModalOpen(true)}
          />
        )}

        {/* VIEW 5: ACTIVITIES */}
        {activeTab === 'activities' && (
          <ActivitiesView openAidModal={() => setIsAidModalOpen(true)} />
        )}

        {/* VIEW 5B: EVENTS & PARTICIPATION */}
        {activeTab === 'events' && store.settings.enableEventsModule && <EventsView />}

        {/* VIEW 6: NOTICES */}
        {activeTab === 'notices' && <NoticeBoardView />}

        {/* VIEW 7: CONTACT */}
        {activeTab === 'contact' && <ContactView />}
      </main>

      {/* Online Member Application Modal */}
      <MemberApplicationModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
      />

      {/* Online Aid Application Modal */}
      <AidApplicationModal
        isOpen={isAidModalOpen}
        onClose={() => setIsAidModalOpen(false)}
      />

      {/* Global Footer with Rangpur247 & NextBD Technical Partnership Credits */}
      <Footer
        setActiveTab={setActiveTab}
        openMemberModal={() => setIsMemberModalOpen(true)}
        openAidModal={() => setIsAidModalOpen(true)}
      />
    </div>
  );
}
