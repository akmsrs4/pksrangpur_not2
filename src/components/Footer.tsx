/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAppStore } from '../db/store.ts';
import { Phone, Mail, MapPin, ExternalLink, MessageCircle, Heart, Shield, Landmark } from 'lucide-react';

interface FooterProps {
  setActiveTab: (tab: string) => void;
  openMemberModal: () => void;
  openAidModal: () => void;
}

export const Footer: React.FC<FooterProps> = ({ setActiveTab, openMemberModal, openAidModal }) => {
  const store = useAppStore();
  const settings = store.settings;

  // WhatsApp click-to-chat URL with pre-filled message
  const whatsappUrl = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(
    settings.whatsappPrefilledMessage
  )}`;

  return (
    <footer className="bg-stone-900 text-stone-300 border-t border-stone-800 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-stone-800">
          {/* Column 1: Organization Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-800 text-amber-400 flex items-center justify-center font-bold">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base leading-snug">
                  {settings.organizationNameBn}
                </h3>
                <p className="text-xs text-stone-400">স্থাপিত: {settings.establishedYear} সাল</p>
              </div>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              {settings.articles.footerSummary}
            </p>
            <div className="pt-2">
              <span className="inline-block bg-stone-800 text-emerald-400 text-xs px-3 py-1 rounded-md border border-stone-700">
                নিবন্ধন ও গঠনতন্ত্র সম্মত স্বচ্ছ প্রশাসন
              </span>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 tracking-wide uppercase">
              গুরুত্বপূর্ণ লিঙ্ক
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  onClick={() => setActiveTab('about')}
                  className="hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  সংগঠনের ইতিহাস ও গঠনতন্ত্র
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('committee')}
                  className="hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  বর্তমান পরিষদ ও কমিটি আর্কাইভ
                </button>
              </li>
              <li>
                {settings.enableStudentWing ? (
                  <button
                    onClick={() => setActiveTab('student-wing')}
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    {settings.studentWingNameBn || 'ছাত্র কল্যাণ সমিতি'}
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveTab('activities')}
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    সাংগঠনিক কর্মসূচি ও রক্তদান নেটওয়ার্ক
                  </button>
                )}
              </li>
              <li>
                <button
                  onClick={openMemberModal}
                  className="hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  {settings.enableStudentWing ? 'সাধারণ ও ছাত্র সদস্যপদ আবেদন' : 'অনলাইনে সদস্যপদ আবেদন'}
                </button>
              </li>
              <li>
                <button
                  onClick={openAidModal}
                  className="hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  শিক্ষা ও চিকিৎসা সহায়তা আবেদন
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('notices')}
                  className="hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  জরুরি বিজ্ঞপ্তি ও প্রেস রিলিজ
                </button>
              </li>
              {settings.enableEventsModule && (
                <li>
                  <button
                    onClick={() => setActiveTab('events')}
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    অনুষ্ঠান ও আয়োজন নিবন্ধন
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Column 3: Contact & Emergency */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 tracking-wide uppercase">
              যোগাযোগ ও হটলাইন
            </h4>
            <ul className="space-y-3 text-xs text-stone-300">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{settings.officeAddress}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <a href={`tel:${settings.hotline1}`} className="hover:text-white">
                    {settings.hotline1}
                  </a>{' '}
                  /{' '}
                  <a href={`tel:${settings.hotline2}`} className="hover:text-white">
                    {settings.hotline2}
                  </a>
                </div>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <a href={`mailto:${settings.email}`} className="hover:text-white">
                  {settings.email}
                </a>
              </li>
            </ul>

            {/* Direct WhatsApp Action Button */}
            <div className="mt-4">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold shadow transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span>সরাসরি হোয়াটসঅ্যাপে মেসেজ করুন</span>
              </a>
            </div>
          </div>

          {/* Column 4: Technical Collaboration & Partner Branding */}
          <div className="bg-stone-950 p-5 rounded-2xl border border-stone-800 space-y-4">
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-amber-400 block mb-1">
                কারিগরি সহযোগিতায়
              </span>
              <div className="text-sm font-bold text-white">
                Developed by {settings.technicalPartnerName || 'Rangpur247 & NextBD'}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-400">রংপুর২৪৭ পোর্টাল:</span>
                <a
                  href={settings.technicalPartnerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                >
                  rangpur247.pages.dev <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-400">নেক্সটবিডি:</span>
                <a
                  href={settings.nextBdUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                >
                  nextbd.pages.dev <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {(settings.technicalPartnerPhone1 || settings.technicalPartnerPhone2) && (
                <div className="pt-2 border-t border-stone-800/80 flex items-start gap-2">
                  <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-stone-200 font-mono">
                    {settings.technicalPartnerPhone1 && (
                      <a
                        href={`tel:${settings.technicalPartnerPhone1}`}
                        className="hover:text-emerald-400 transition-colors font-medium"
                      >
                        {settings.technicalPartnerPhone1}
                      </a>
                    )}
                    {settings.technicalPartnerPhone1 && settings.technicalPartnerPhone2 && (
                      <span className="text-stone-600">/</span>
                    )}
                    {settings.technicalPartnerPhone2 && (
                      <a
                        href={`tel:${settings.technicalPartnerPhone2}`}
                        className="hover:text-emerald-400 transition-colors font-medium"
                      >
                        {settings.technicalPartnerPhone2}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Social links */}
            <div className="pt-2 border-t border-stone-800 flex items-center gap-2.5">
              <a
                href={settings.facebookPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-stone-200 rounded border border-stone-700 transition-colors"
              >
                Facebook Page
              </a>
              <a
                href={settings.messengerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-stone-200 rounded border border-stone-700 transition-colors"
              >
                Messenger
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Admin link */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div>
            {settings.copyrightNotice} · সকল অধিকার সংরক্ষিত।
          </div>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1 text-stone-400">
              <Heart className="w-3 h-3 text-red-500" /> পাটগ্রামের কল্যাণে নিবেদিত
            </span>
            <button
              onClick={() => setActiveTab('admin')}
              className="text-stone-400 hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>প্রশাসনিক প্রবেশাধিকার</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
