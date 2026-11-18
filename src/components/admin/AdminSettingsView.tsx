/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../db/store.ts';
import {
  Settings,
  Save,
  CheckCircle2,
  Lock,
  AlertCircle,
  Palette,
  Image as ImageIcon,
  GraduationCap,
  CalendarDays,
  RotateCcw,
} from 'lucide-react';
import { OrganizationArticles, SystemSettings, ThemePreset } from '../../types.ts';
import { THEME_PRESETS } from '../../config/themePresets.ts';
import heroCommunityImg from '../../assets/images/patgram_hero_community_1794505313964.jpg';

export const AdminSettingsView: React.FC = () => {
  const store = useAppStore();
  const permissions = store.getEffectivePermissions();

  const [formData, setFormData] = useState<SystemSettings>({
    ...store.settings,
    articles: { ...store.settings.articles },
  });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [heroPreviewError, setHeroPreviewError] = useState(false);

  useEffect(() => {
    setFormData({
      ...store.settings,
      articles: { ...store.settings.articles },
    });
  }, [store.settings]);

  useEffect(() => {
    setHeroPreviewError(false);
  }, [formData.heroImageUrl]);

  useEffect(() => {
    const savedTheme = store.settings.themePreset;
    return () => {
      store.applyThemeToDocument(savedTheme);
    };
  }, [store, store.settings.themePreset]);

  if (!permissions.can_manage_settings && store.currentRole !== 'super_admin') {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
        <Lock className="w-12 h-12 text-stone-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-stone-900">সিস্টেম সেটিংস সংরক্ষিত</h3>
        <p className="text-xs text-stone-500">শুধুমাত্র অনুমোদিত প্রশাসকের জন্য সিস্টেম সেটিংস পরিবর্তনের অনুমতি রয়েছে।</p>
      </div>
    );
  }

  const handleChange = (key: keyof SystemSettings, val: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const handleArticleChange = (key: keyof OrganizationArticles, val: string) => {
    setFormData((prev) => ({
      ...prev,
      articles: {
        ...prev.articles,
        [key]: val,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSavedSuccess(false);
    const res = store.updateSettings(formData);
    if (res.success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } else {
      setSaveError(res.error || 'সেটিংস সংরক্ষণ করা যায়নি।');
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-700" />
            <span>সিস্টেম সেটিংস, প্রবন্ধ ও যোগাযোগ ব্যবস্থাপনা</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            সংগঠনের নাম, প্রতিষ্ঠাকাল, বিবরণী/প্রবন্ধ, ফোন নম্বর, ঠিকানা ও হোয়াটসঅ্যাপ মেসেজ সরাসরি এখান থেকে পরিবর্তন করুন।
          </p>
        </div>

        {savedSuccess && (
          <div className="px-4 py-2 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>সেটিংস সফলভাবে সংরক্ষিত হয়েছে!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm space-y-6">
        {/* Section 1: Basic Organization Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-stone-900 pb-2 border-b border-stone-100">
            সংগঠনের প্রাথমিক তথ্য
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                সংগঠনের নাম (বাংলা)
              </label>
              <input
                type="text"
                value={formData.organizationNameBn}
                onChange={(e) => handleChange('organizationNameBn', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Organization Name (English)
              </label>
              <input
                type="text"
                value={formData.organizationNameEn}
                onChange={(e) => handleChange('organizationNameEn', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">প্রতিষ্ঠাকাল (সাল)</label>
              <input
                type="number"
                value={formData.establishedYear}
                onChange={(e) => handleChange('establishedYear', Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">মূল স্লোগান</label>
              <input
                type="text"
                value={formData.sloganBn}
                onChange={(e) => handleChange('sloganBn', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Section 1B: Design Theme Presets, Student Wing Switch & Hero Banner Image */}
        <div className="space-y-6 p-5 sm:p-6 rounded-2xl bg-stone-50 border border-stone-200">
          <div className="pb-2 border-b border-stone-200">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Palette className="w-4 h-4 text-emerald-700" />
              <span>ওয়েবসাইট থিম, ছাত্র সংগঠন ও ব্যানার ছবি কাস্টমাইজেশন</span>
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              অন্য উপজেলা বা নতুন সংগঠনের জন্য ওয়েবসাইটের বাহ্যিক রঙ, ছাত্র সংগঠন মডিউল এবং হোম ব্যানারের ছবি এখান থেকেই পরিবর্তন করুন।
            </p>
          </div>

          {/* 1. Student Wing On/Off Toggle */}
          <div className="p-4 rounded-xl bg-white border border-stone-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-900">
                    ছাত্র সংগঠন মডিউল (Student Wing)
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    বন্ধ রাখলে মেনু ও ফর্ম থেকে “ছাত্র সংগঠন” অংশটি সরে যাবে এবং হোমপেজে “সদস্য ও রক্তদান নেটওয়ার্ক / সাংগঠনিক কর্মসূচি” কার্ড দেখাবে।
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={formData.enableStudentWing}
                onClick={() => handleChange('enableStudentWing', !formData.enableStudentWing)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer shrink-0 ${
                  formData.enableStudentWing
                    ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                    : 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    formData.enableStudentWing ? 'bg-amber-300' : 'bg-stone-400'
                  }`}
                />
                <span>{formData.enableStudentWing ? 'চালু আছে (ON)' : 'বন্ধ আছে (OFF)'}</span>
              </button>
            </div>

            {formData.enableStudentWing && (
              <div className="pt-3 border-t border-stone-100">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  ছাত্র সংগঠনের নাম (বাংলা)
                </label>
                <input
                  type="text"
                  value={formData.studentWingNameBn}
                  onChange={(e) => handleChange('studentWingNameBn', e.target.value)}
                  placeholder="উদা: পাটগ্রাম ছাত্র কল্যাণ সমিতি, রংপুর"
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
                />
              </div>
            )}
          </div>

          {/* 1B. Events Module On/Off Toggle */}
          <div className="p-4 rounded-xl bg-white border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-stone-900">
                  অনুষ্ঠান ও আয়োজন মডিউল (Event & Participation Module)
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  চালু রাখলে পাবলিক মেনুতে “অনুষ্ঠান ও আয়োজন” পেজ এবং উপস্থিতি-ভিত্তিক নিবন্ধন ও আলাদা অনুষ্ঠান ফান্ড সক্রিয় থাকবে।
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={formData.enableEventsModule}
              onClick={() => handleChange('enableEventsModule', !formData.enableEventsModule)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer shrink-0 ${
                formData.enableEventsModule
                  ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                  : 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  formData.enableEventsModule ? 'bg-amber-300' : 'bg-stone-400'
                }`}
              />
              <span>{formData.enableEventsModule ? 'চালু আছে (ON)' : 'বন্ধ আছে (OFF)'}</span>
            </button>
          </div>

          {/* 2. 6 Professional Theme Presets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-800">
                পছন্দের কালার থিম নির্বাচন করুন (লাইভ প্রিভিউ — সংরক্ষণ করলে স্থায়ী হবে):
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {THEME_PRESETS.map((preset) => {
                const isSelected = (formData.themePreset || 'emerald_gold') === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      handleChange('themePreset', preset.id as ThemePreset);
                      store.applyThemeToDocument(preset.id);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-white border-emerald-700 ring-2 ring-emerald-700/20 shadow-sm'
                        : 'bg-white border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded-full border border-stone-200 shrink-0"
                          style={{ backgroundColor: preset.primaryHex }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-stone-200 shrink-0"
                          style={{ backgroundColor: preset.accentHex }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-stone-200 shrink-0"
                          style={{ backgroundColor: preset.surfaceHex }}
                        />
                      </div>
                      <div className="text-xs font-bold text-stone-900 truncate">{preset.labelBn}</div>
                      <div className="text-[11px] text-stone-500 leading-snug">{preset.subtitleBn}</div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Hero Banner Image URL */}
          <div className="p-4 rounded-xl bg-white border border-stone-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-700" />
                <span>হোম ব্যানার ব্যাকগ্রাউন্ড ছবির লিংক (Hero Banner Image URL)</span>
              </label>
              {formData.heroImageUrl?.trim() && (
                <button
                  type="button"
                  onClick={() => handleChange('heroImageUrl', '')}
                  className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>ডিফল্ট ছবিতে ফিরুন</span>
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="w-full sm:w-36 h-20 rounded-lg overflow-hidden border border-stone-200 bg-stone-900 shrink-0">
                <img
                  src={
                    !heroPreviewError && formData.heroImageUrl?.trim()
                      ? formData.heroImageUrl.trim()
                      : heroCommunityImg
                  }
                  onError={() => setHeroPreviewError(true)}
                  alt="Hero Banner Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 w-full space-y-1.5">
                <input
                  type="url"
                  value={formData.heroImageUrl || ''}
                  onChange={(e) => handleChange('heroImageUrl', e.target.value)}
                  placeholder="https://example.com/banner.jpg (খালি রাখলে ডিফল্ট ছবি দেখাবে)"
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono bg-white"
                />
                <p className="text-[11px] text-stone-500">
                  {heroPreviewError && formData.heroImageUrl?.trim()
                    ? 'প্রদত্ত লিংকের ছবি লোড হয়নি — তাই স্বয়ংক্রিয়ভাবে ডিফল্ট ব্যানার প্রদর্শিত হবে।'
                    : 'লিংক না দিলে অথবা ছবি লোড না হলে বিল্ট-ইন নিরাপদ ব্যানার ছবি স্বয়ংক্রিয়ভাবে ব্যবহৃত হবে।'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Contact & Hotlines */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-stone-900 pb-2 border-b border-stone-100">
            অফিস ও হটলাইন যোগাযোগ
          </h3>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">কার্যালয়ের ঠিকানা</label>
            <input
              type="text"
              value={formData.officeAddress}
              onChange={(e) => handleChange('officeAddress', e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">হটলাইন ১ (মোবাইল)</label>
              <input
                type="text"
                value={formData.hotline1}
                onChange={(e) => handleChange('hotline1', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">হটলাইন ২</label>
              <input
                type="text"
                value={formData.hotline2}
                onChange={(e) => handleChange('hotline2', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">অফিসিয়াল ইমেইল</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Section 3: WhatsApp Instant Chat Configuration */}
        <div className="space-y-4 p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200">
          <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
            <span>হোয়াটসঅ্যাপ চ্যাট লিংক ও প্রি-ফিল্ড মেসেজ</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-emerald-900 mb-1">
                হোয়াটসঅ্যাপ নম্বর (আন্তর্জাতিক কোডসহ, যেমন: 8801603526000)
              </label>
              <input
                type="text"
                value={formData.whatsappNumber}
                onChange={(e) => handleChange('whatsappNumber', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-emerald-300 rounded-lg font-mono bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-emerald-900 mb-1">
                চ্যাট বক্সে স্বয়ংক্রিয় রেডিমেড মেসেজ
              </label>
              <input
                type="text"
                value={formData.whatsappPrefilledMessage}
                onChange={(e) => handleChange('whatsappPrefilledMessage', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-emerald-300 rounded-lg bg-white"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Technical Collaboration & Partner Branding */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-stone-900 pb-2 border-b border-stone-100">
            কারিগরি সহযোগিতা ও ব্র্যান্ডিং লিংক (Rangpur247 & NextBD)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                কারিগরি পার্টনার টেক্সট
              </label>
              <input
                type="text"
                value={formData.technicalPartnerName}
                onChange={(e) => handleChange('technicalPartnerName', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Rangpur247 পোর্টাল লিংক
              </label>
              <input
                type="url"
                value={formData.technicalPartnerUrl}
                onChange={(e) => handleChange('technicalPartnerUrl', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                কারিগরি সহযোগিতা মোবাইল নম্বর ১
              </label>
              <input
                type="tel"
                placeholder="01717850780"
                value={formData.technicalPartnerPhone1}
                onChange={(e) => handleChange('technicalPartnerPhone1', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                কারিগরি সহযোগিতা মোবাইল নম্বর ২
              </label>
              <input
                type="tel"
                placeholder="01603526000"
                value={formData.technicalPartnerPhone2}
                onChange={(e) => handleChange('technicalPartnerPhone2', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">NextBD লিংক</label>
              <input
                type="url"
                value={formData.nextBdUrl}
                onChange={(e) => handleChange('nextBdUrl', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Facebook Page লিংক</label>
              <input
                type="url"
                value={formData.facebookPageUrl}
                onChange={(e) => handleChange('facebookPageUrl', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">কপিরাইট নোটিস</label>
            <input
              type="text"
              value={formData.copyrightNotice}
              onChange={(e) => handleChange('copyrightNotice', e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
            />
          </div>
        </div>

        {/* Section 5: Financial Correction Policy Threshold */}
        <div className="space-y-4 p-5 rounded-2xl bg-amber-50/50 border border-amber-200">
          <h3 className="text-sm font-bold text-amber-950">
            আর্থিক সংশোধন অনুমোদন নীতি সীমা
          </h3>
          <div>
            <label className="block text-xs font-semibold text-amber-900 mb-1">
              দ্বৈত অনুমোদন ট্রিগার করার আর্থিক সীমা (টাকায়)
            </label>
            <input
              type="number"
              value={formData.correctionThresholdAmount}
              onChange={(e) => handleChange('correctionThresholdAmount', Number(e.target.value))}
              className="w-full max-w-xs px-3 py-2 text-xs border border-amber-300 rounded-lg font-mono font-bold bg-white"
            />
            <p className="text-[11px] text-amber-800 mt-1">
              যেকোনো আর্থিক এন্ট্রির মূল বা সংশোধিত অঙ্ক এই পরিমাণের (বর্তমানে ৳{formData.correctionThresholdAmount?.toLocaleString()}) বেশি হলে সভাপতি/সাধারণ সম্পাদক/অন্য কর্মকর্তার অনুমোদন বাধ্যতামূলক।
            </p>
          </div>
        </div>

        {/* Section 6: Organization Articles & Public Descriptions */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-stone-900 pb-2 border-b border-stone-100">
            সংগঠনের প্রবন্ধ, পরিচিতি ও বিবরণসমূহ
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                হোম ও পরিচিতি সারাংশ
              </label>
              <textarea
                rows={2}
                value={formData.articles.aboutSummary}
                onChange={(e) => handleArticleChange('aboutSummary', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                প্রতিষ্ঠার ঐতিহাসিক পটভূমি ({formData.establishedYear} সাল)
              </label>
              <textarea
                rows={3}
                value={formData.articles.foundingHistory}
                onChange={(e) => handleArticleChange('foundingHistory', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                পুনর্গঠন ও ডিজিটাল রূপান্তর বিবরণ
              </label>
              <textarea
                rows={2}
                value={formData.articles.reorganizationNote}
                onChange={(e) => handleArticleChange('reorganizationNote', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                ভবিষ্যৎ লক্ষ্য ও সাংগঠনিক দর্শন
              </label>
              <textarea
                rows={2}
                value={formData.articles.visionMission}
                onChange={(e) => handleArticleChange('visionMission', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  ছাত্র কল্যাণ সমিতি পরিচিতি
                </label>
                <textarea
                  rows={2}
                  value={formData.articles.studentWingSummary}
                  onChange={(e) => handleArticleChange('studentWingSummary', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  কল্যাণমূলক কর্মসূচি বিবরণ
                </label>
                <textarea
                  rows={2}
                  value={formData.articles.welfareDescription}
                  onChange={(e) => handleArticleChange('welfareDescription', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                ফুটার সংক্ষিপ্ত পরিচিতি
              </label>
              <textarea
                rows={2}
                value={formData.articles.footerSummary}
                onChange={(e) => handleArticleChange('footerSummary', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            {saveError && (
              <div className="px-3.5 py-2 bg-red-50 text-red-800 text-xs font-bold rounded-xl border border-red-200 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            {savedSuccess && (
              <div className="px-3.5 py-2 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>পরিবর্তন সফলভাবে সংরক্ষিত ও কার্যকর হয়েছে!</span>
              </div>
            )}
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow flex items-center gap-2 cursor-pointer self-end sm:self-auto"
          >
            <Save className="w-4 h-4" />
            <span>পরিবর্তন সংরক্ষণ করুন</span>
          </button>
        </div>
      </form>
    </div>
  );
};
