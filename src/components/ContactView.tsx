/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from '../db/store.ts';
import { Phone, Mail, MapPin, MessageCircle, ExternalLink, Send, CheckCircle2, AlertCircle } from 'lucide-react';

export const ContactView: React.FC = () => {
  const store = useAppStore();
  const settings = store.settings;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const whatsappUrl = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(
    settings.whatsappPrefilledMessage
  )}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !message.trim()) return;

    store.logAudit(
      'CONTACT_MESSAGE',
      'contact',
      'msg-' + Date.now(),
      `ওয়েবসাইট ভিজিটর ${name} (${phone}) যোগাযোগ বার্তা পাঠিয়েছেন: "${subject || message.substring(0, 30)}"`
    );
    setSent(true);
  };

  return (
    <div className="py-16 bg-white min-h-[70vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mb-12">
          <div className="text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-2">
            যোগাযোগ ও সার্বক্ষণিক সেবা
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            অফিসের ঠিকানা ও সরাসরি সংযোগ
          </h2>
          <p className="mt-2 text-stone-600 text-sm leading-relaxed">
            পাটগ্রাম কল্যাণ সমিতি বা ছাত্র কল্যাণ সমিতির যেকোনো কার্যক্রম, সদস্যপদ, অনুদান বা পরামর্শের জন্য আমাদের সাথে সরাসরি যোগাযোগ করুন।
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Contact Details Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-stone-50 p-6 sm:p-8 rounded-2xl border border-stone-200 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-stone-900 mb-1">কেন্দ্রীয় কার্যালয়</h3>
                <p className="text-xs text-stone-500">{settings.organizationNameBn}</p>
              </div>

              <div className="space-y-4 text-xs sm:text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-stone-800">অফিসের ঠিকানা</div>
                    <div className="text-stone-600 mt-0.5">{settings.officeAddress}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-stone-800">হটলাইন ও সাপোর্ট</div>
                    <div className="text-stone-600 mt-0.5">
                      <a href={`tel:${settings.hotline1}`} className="hover:text-emerald-700 font-medium">
                        {settings.hotline1}
                      </a>{' '}
                      /{' '}
                      <a href={`tel:${settings.hotline2}`} className="hover:text-emerald-700 font-medium">
                        {settings.hotline2}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-stone-800">অফিসিয়াল ইমেইল</div>
                    <div className="text-stone-600 mt-0.5">
                      <a href={`mailto:${settings.email}`} className="hover:text-emerald-700">
                        {settings.email}
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instant WhatsApp Action Card */}
              <div className="p-4 rounded-xl bg-emerald-800 text-white space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <MessageCircle className="w-5 h-5 text-amber-300" />
                  <span>তাত্ক্ষণিক হোয়াটসঅ্যাপ চ্যাট</span>
                </div>
                <p className="text-xs text-emerald-100 leading-relaxed">
                  ক্লিক করার সাথে সাথে প্রি-ফিল্ড মেসেজসহ সরাসরি আমাদের কর্মকর্তা ও প্রতিনিধির সাথে চ্যাট শুরু করুন।
                </p>
                <div className="pt-2">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-emerald-950 font-bold text-xs hover:bg-emerald-50 transition-all shadow"
                  >
                    <span>চ্যাট ওপেন করুন</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Technical Partner Recognition Box */}
            <div className="p-5 rounded-2xl bg-stone-900 text-stone-300 border border-stone-800 space-y-3">
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                কারিগরি সহযোগিতায়
              </div>
              <div className="text-sm font-bold text-white">
                Developed by {settings.technicalPartnerName || 'Rangpur247 & NextBD'}
              </div>
              {(settings.technicalPartnerPhone1 || settings.technicalPartnerPhone2) && (
                <div className="flex items-center gap-2 text-xs text-stone-200 font-mono">
                  <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
              <div className="flex items-center gap-4 text-xs pt-1">
                <a
                  href={settings.technicalPartnerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                >
                  Rangpur247
                </a>
                <span className="text-stone-600">·</span>
                <a
                  href={settings.nextBdUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                >
                  NextBD
                </a>
                <span className="text-stone-600">·</span>
                <a
                  href={settings.facebookPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                >
                  Facebook Page
                </a>
              </div>
            </div>
          </div>

          {/* Contact Message Form */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm">
            <h3 className="text-xl font-bold text-stone-900 mb-2">বার্তা বা পরামর্শ পাঠান</h3>
            <p className="text-xs text-stone-500 mb-6">
              আপনার মতামত, তথ্য অনুসন্ধান বা সাংগঠনিক পরামর্শ লিখে পাঠান। সংশ্লিষ্ট উপ-কমিটি গুরুত্বের সাথে বিবেচনা করবে।
            </p>

            {sent ? (
              <div className="p-8 text-center bg-emerald-50 rounded-xl border border-emerald-200 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-700 mx-auto" />
                <h4 className="text-base font-bold text-emerald-950">
                  আপনার বার্তাটি সফলভাবে পাঠানো হয়েছে!
                </h4>
                <p className="text-xs text-emerald-800">
                  আমাদের নির্বাহী কমিটির দায়িত্বপ্রাপ্ত সদস্য শীঘ্রই আপনার সাথে যোগাযোগ করবেন।
                </p>
                <button
                  onClick={() => setSent(false)}
                  className="mt-3 px-4 py-2 bg-emerald-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  আরেকটি বার্তা পাঠান
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      আপনার নাম *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="উদা: মো. তারিকুল ইসলাম"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      মোবাইল নম্বর *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="০১৭১১..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    বিষয় / শিরোনাম
                  </label>
                  <input
                    type="text"
                    placeholder="উদা: সদস্যপদ নবায়ন সংক্রান্ত প্রশ্ন"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    বিস্তারিত বার্তা *
                  </label>
                  <textarea
                    rows={5}
                    required
                    placeholder="আপনার বার্তা বা প্রশ্নের বিবরণ লিখুন..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>বার্তা প্রেরণ করুন</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
