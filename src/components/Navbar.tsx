/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from '../db/store.ts';
import { Shield, UserPlus, Menu, X, Landmark, Phone } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openMemberModal: () => void;
  openAidModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  openMemberModal,
  openAidModal,
}) => {
  const store = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'home', label: 'হোম' },
    { id: 'about', label: 'পরিচিতি' },
    { id: 'committee', label: 'কমিটি' },
    ...(store.settings.enableStudentWing ? [{ id: 'student-wing', label: 'ছাত্র সংগঠন' }] : []),
    { id: 'activities', label: 'কর্মসূচি' },
    ...(store.settings.enableEventsModule ? [{ id: 'events', label: 'অনুষ্ঠান ও আয়োজন' }] : []),
    { id: 'notices', label: 'নোটিশ' },
    { id: 'contact', label: 'যোগাযোগ' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 transition-all overflow-x-clip">
      {/* Top micro ribbon */}
      <div className="bg-emerald-900 text-emerald-100 text-xs py-1.5 px-3 sm:px-6 lg:px-8 border-b border-emerald-800 flex justify-between items-center">
        <div className="flex items-center gap-2 truncate">
          <span className="font-bold tracking-wide shrink-0">স্থাপিত: {store.settings.establishedYear} সাল</span>
          <span className="text-emerald-400 shrink-0">·</span>
          <span className="truncate hidden sm:inline text-emerald-200">
            রংপুর মহানগরীতে পাটগ্রামবাসীর ডিজিটাল প্ল্যাটফর্ম
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-[11px] sm:text-xs">
          <a
            href={`tel:${store.settings.hotline1}`}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <Phone className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="font-mono">{store.settings.hotline1}</span>
          </a>
          <span className="text-emerald-700">|</span>
          <button
            onClick={() => setActiveTab('admin')}
            className="flex items-center gap-1 font-semibold text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
          >
            <Shield className="w-3 h-3 text-amber-400" />
            <span>অ্যাডমিন পোর্টাল</span>
          </button>
        </div>
      </div>

      {/* Main Top Bar Contract: Brand - Nav Links - Primary Action */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-3 md:gap-4 lg:gap-6">
        {/* Brand Zone */}
        <div
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2.5 cursor-pointer select-none shrink-0"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-950 text-amber-400 flex items-center justify-center shadow-sm border border-emerald-700/50 shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base sm:text-lg xl:text-xl font-bold tracking-tight text-stone-900 truncate">
              {store.settings.organizationNameBn}
            </div>
            <div className="text-[10px] text-stone-500 hidden sm:block">
              ঐক্য · ভ্রাতৃত্ব · টেকসই কল্যাণ
            </div>
          </div>
        </div>

        {/* Navigation Links Zone (Responsive spacing and compact typography) */}
        <nav className="hidden lg:flex items-center gap-3.5 xl:gap-5 text-xs xl:text-sm font-semibold text-stone-700">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => setActiveTab(link.id)}
              className={`whitespace-nowrap transition-colors cursor-pointer py-1 ${
                activeTab === link.id
                  ? 'text-emerald-800 font-bold border-b-2 border-emerald-700'
                  : 'text-stone-600 hover:text-stone-950'
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Primary Action Zone - Ultra-Responsive to prevent right clipping */}
        <div className="hidden sm:flex items-center gap-2 xl:gap-3 shrink-0">
          <button
            onClick={openAidModal}
            className="hidden xl:inline-block px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors whitespace-nowrap cursor-pointer"
          >
            সহায়তা আবেদন
          </button>
          <button
            onClick={openMemberModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 text-amber-300" />
            <span>সদস্য আবেদন</span>
          </button>
        </div>

        {/* Mobile / Tablet Hamburger Toggle */}
        <div className="flex lg:hidden items-center gap-1.5">
          <button
            onClick={openMemberModal}
            className="sm:hidden px-2.5 py-1.5 text-[11px] font-bold text-white bg-emerald-800 rounded-lg shrink-0"
          >
            সদস্য
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-stone-700 hover:text-stone-950 rounded-lg focus:outline-none"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-stone-200 px-4 pt-2 pb-6 space-y-3 shadow-lg">
          <div className="grid grid-cols-2 gap-2 pt-2 pb-3 border-b border-stone-100">
            <button
              onClick={() => {
                openMemberModal();
                setMobileMenuOpen(false);
              }}
              className="w-full py-2.5 text-center text-xs font-bold text-white bg-emerald-800 rounded-lg flex items-center justify-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5 text-amber-300" />
              <span>সদস্য আবেদন</span>
            </button>
            <button
              onClick={() => {
                openAidModal();
                setMobileMenuOpen(false);
              }}
              className="w-full py-2.5 text-center text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg"
            >
              সহায়তার আবেদন
            </button>
          </div>
          <div className="flex flex-col space-y-1.5">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => {
                  setActiveTab(link.id);
                  setMobileMenuOpen(false);
                }}
                className={`text-left py-2 px-3 rounded-md text-xs sm:text-sm font-medium ${
                  activeTab === link.id
                    ? 'bg-emerald-50 text-emerald-900 font-bold'
                    : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => {
                setActiveTab('admin');
                setMobileMenuOpen(false);
              }}
              className="text-left py-2 px-3 rounded-md text-xs sm:text-sm font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 flex items-center justify-between"
            >
              <span>অ্যাডমিন ম্যানেজমেন্ট পোর্টাল</span>
              <Shield className="w-4 h-4 text-amber-700" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
