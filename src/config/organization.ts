/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FinancialAccount,
  FinancialFund,
  FounderEntry,
  OrganizationArticles,
  ThemePreset,
} from '../types.ts';

/**
 * White-Label Configuration File
 * অন্য কোনো উপজেলা, জেলা বা সামাজিক সংগঠনের জন্য নতুন ওয়েবসাইট/অ্যাপ তৈরি করতে
 * শুধুমাত্র এই একটি ফাইলের তথ্য পরিবর্তন করলেই পুরো অ্যাপের নাম, প্রতিষ্ঠাকাল,
 * ঠিকানা, হটলাইন, হোয়াটসঅ্যাপ, SEO ও প্রারম্ভিক তহবিল ৩০ মিনিটের মধ্যে প্রস্তুত হয়ে যাবে।
 */
export const ORGANIZATION_CONFIG = {
  // Site & SEO Identity
  siteUrl: 'https://patgram.pages.dev',
  googleSiteVerification: '8KuwzHs_3MK7kHBgSpV9NJCIUEPrTA7t4LqimZ5UB7A',
  shortNameBn: 'পাটগ্রাম সমিতি',
  organizationNameBn: 'পাটগ্রাম কল্যাণ সমিতি, রংপুর',
  organizationNameEn: 'Patgram Kalyan Samity, Rangpur',
  enableStudentWing: true,
  studentWingNameBn: 'পাটগ্রাম ছাত্র কল্যাণ সমিতি, রংপুর',
  enableEventsModule: true,
  themePreset: 'emerald_gold' as ThemePreset,
  heroImageUrl: '',
  establishedYear: 2000,
  sloganBn: 'ঐক্য, ভ্রাতৃত্ব, কল্যাণ ও টেকসই মানবিক উন্নয়ন',
  regionTitleBn: 'রংপুর মহানগরী ও পাটগ্রাম উপজেলা',
  seoTitle: 'পাটগ্রাম কল্যাণ সমিতি, রংপুর — ঐক্য, ভ্রাতৃত্ব ও মানবিক কল্যাণ',
  seoDescription:
    'পাটগ্রাম কল্যাণ সমিতি, রংপুর (স্থাপিত: ২০০০) — রংপুরে বসবাসরত পাটগ্রামবাসীর ঐক্য, ছাত্র কল্যাণ, শিক্ষা বৃত্তি ও মানবিক সেবার কেন্দ্রীয় ডিজিটাল পোর্টাল।',
  seoKeywords:
    'পাটগ্রাম কল্যাণ সমিতি, পাটগ্রাম কল্যাণ সমিতি রংপুর, Patgram Kalyan Samity Rangpur, পাটগ্রাম ছাত্র কল্যাণ সমিতি, লালমনিরহাট পাটগ্রাম, rangpur247, patgram samity',

  // Office & Contact Defaults
  officeAddress: 'রোড নং-০৩, বাড়ি নং-১২, ধাপ ইঞ্জিনিয়ার্স পাড়া, রংপুর মহানগরী-৫৪০০',
  hotline1: '01717850780',
  hotline2: '01603526000',
  whatsappNumber: '8801717850780',
  whatsappPrefilledMessage: 'আসসালামু আলাইকুম, আপনার সেবা সম্পর্কে জানতে চাই।',
  email: 'patgramkalyan.rangpur@gmail.com',

  // Social & Technical Partner Branding
  facebookPageUrl: 'https://www.facebook.com/Rangpur247bd/',
  facebookGroupUrl: 'https://www.facebook.com/groups/patgramsamity',
  messengerUrl: 'https://m.me/rangpur247bd',
  technicalPartnerName: 'Rangpur247 & NextBD',
  technicalPartnerUrl: 'https://rangpur247.pages.dev/',
  technicalPartnerPhone1: '01717850780',
  technicalPartnerPhone2: '01603526000',
  nextBdUrl: 'https://nextbd.pages.dev/',
  copyrightNotice: '© 2026 পাটগ্রাম কল্যাণ সমিতি, রংপুর · Rangpur247. All Rights Reserved.',

  // Financial Policy
  correctionThresholdAmount: 30000,
  memberIdPrefixGeneral: 'PKS-GEN',
  memberIdPrefixStudent: 'PKS-STU',

  // Editable Default Articles & Organizational Content
  defaultArticles: {
    aboutSummary:
      'পাটগ্রাম কল্যাণ সমিতি, রংপুর কোনো সাধারণ সংগঠন নয়—এটি রংপুর বিভাগে পাটগ্রামবাসীর আত্মিক বন্ধন ও পারস্পরিক সহযোগিতার বিশ্বস্ত ঠিকানা।',
    foundingHistory:
      '২০০০ সালে রংপুর মহানগরীতে বসবাসকারী পাটগ্রামের প্রবীণ মুরব্বী, সরকারি-বেসরকারি কর্মকর্তা, শিক্ষক, আইনজীবী এবং সচেতন নাগরিকদের ঐকান্তিক প্রচেষ্টায় “পাটগ্রাম কল্যাণ সমিতি, রংপুর” আনুষ্ঠানিকভাবে প্রতিষ্ঠা লাভ করে।',
    reorganizationNote:
      'প্রতিষ্ঠার পর সময়ের বিবর্তনে সাংগঠনিক কার্যক্রম আরও বেগবান করার প্রয়োজনীয়তা দেখা দেয়। পরবর্তীতে ২০২৬ সালে সকল ভেদাভেদ ভুলে সংগঠনটিকে পুনর্গঠন, সম্প্রসারণ ও আধুনিক ডিজিটাল ব্যবস্থাপনার আওতায় নিয়ে আসার যুগান্তকারী উদ্যোগ গ্রহণ করা হয়।',
    visionMission:
      'সময়ের সাথে তাল মিলিয়ে সংগঠনের গঠনতন্ত্র, সদস্য ডাটাবেজ, কমিটির ঐতিহাসিক আর্কাইভ এবং ৭টি মানবিক তহবিলের পূর্ণাঙ্গ হিসাবরক্ষণ সম্পূর্ণ স্বচ্ছ, কাগজবিহীন ও জবাবদিহিতামূলক পদ্ধতিতে পরিচালনা করাই আমাদের লক্ষ্য।',
    studentWingSummary:
      'রংপুর মহানগরীর বিভিন্ন বিশ্ববিদ্যালয়, মেডিকেল কলেজ, কারমাইকেল কলেজ ও অন্যান্য শিক্ষা প্রতিষ্ঠানে অধ্যয়নরত পাটগ্রামের শিক্ষার্থীদের মেধা বিকাশ, ঐক্য ও পারস্পরিক সহায়তায় নিবেদিত একটি সক্রিয় অঙ্গ সংগঠন।',
    welfareDescription:
      'অসচ্ছল ও মেধাবী শিক্ষার্থীদের বৃত্তি, জটিল রোগে আক্রান্ত পাটগ্রামবাসীর চিকিৎসা সহায়তা, জরুরি রক্তদান এবং শীতবস্ত্র ও দুর্যোগকালীন ত্রাণ কার্যক্রমের মাধ্যমে পাটগ্রাম ও রংপুরের মানুষের পাশে দাঁড়ানো।',
    footerSummary:
      'রংপুর মহানগরীতে বসবাসরত পাটগ্রাম-সম্পর্কিত মানুষের ঐক্য, ভ্রাতৃত্ব এবং পাটগ্রাম উপজেলার সুবিধাবঞ্চিত মানুষের শিক্ষা, চিকিৎসা ও মানবিক উন্নয়নে নিবেদিত একটি স্বেচ্ছাসেবী ও অরাজনৈতিক সামাজিক সংগঠন।',
  } satisfies OrganizationArticles,

  // Default Founders & Founding Members (Editable by Super Admin & Committee Managers)
  defaultFounders: [
    {
      id: 'founder-1',
      nameBn: 'জনাব আতাউর রহমান প্রধান',
      nameEn: 'Md. Ataur Rahman Prodhan',
      designationBn: 'সাবেক এমডি, সোনালী ব্যাংক পিএলসি',
      category: 'founder',
      priority: 1,
      isPublished: true,
    },
    {
      id: 'founder-2',
      nameBn: 'জনাব মাহবুব আলম',
      nameEn: 'Mahbub Alam',
      designationBn: 'সাবেক যুগ্ম সচিব',
      category: 'founder',
      priority: 2,
      isPublished: true,
    },
  ] satisfies FounderEntry[],

  // Clean Initial Multi-Fund Structure (All balances start strictly at ৳0)
  defaultFunds: [
    {
      id: 'fund-1',
      name: 'সাধারণ পরিচালন তহবিল',
      code: 'GEN',
      description: 'সদস্যদের নিয়মিত চাঁদা, ভর্তি ফি এবং সংগঠনের দৈনন্দিন প্রাতিষ্ঠানিক পরিচালনা ব্যয়।',
      currentBalance: 0,
      isActive: true,
      isDefault: true,
    },
    {
      id: 'fund-2',
      name: 'শিক্ষা সহায়তা তহবিল',
      code: 'EDU',
      description: 'দরিদ্র ও মেধাবী শিক্ষার্থীদের বৃত্তি, বই খাতা, ফরম পূরণ ও উচ্চশিক্ষা সহায়তা।',
      currentBalance: 0,
      isActive: true,
      isDefault: false,
    },
    {
      id: 'fund-3',
      name: 'চিকিৎসা ও জরুরি সহায়তা তহবিল',
      code: 'MED',
      description: 'অসুস্থ, অসহায় ও জরুরি চিকিৎসার প্রয়োজন রয়েছে এমন পাটগ্রামবাসীর মানবিক সহায়তা।',
      currentBalance: 0,
      isActive: true,
      isDefault: false,
    },
    {
      id: 'fund-4',
      name: 'দুর্যোগ ও মানবিক সহায়তা তহবিল',
      code: 'RELIEF',
      description: 'বন্যা, শীতবস্ত্র, অগ্নিকাণ্ড ও প্রাকৃতিক দুর্যোগকালীন অসহায় পরিবারের ত্রাণ কার্যক্রম।',
      currentBalance: 0,
      isActive: true,
      isDefault: false,
    },
    {
      id: 'fund-5',
      name: 'সমাজকল্যাণ ও উন্নয়ন তহবিল',
      code: 'SOC',
      description: 'পাটগ্রাম উপজেলার সামাজিক উন্নয়ন, পাঠাগার উন্নয়ন ও জনকল্যাণমূলক দীর্ঘমেয়াদি উদ্যোগ।',
      currentBalance: 0,
      isActive: true,
      isDefault: false,
    },
    {
      id: 'fund-6',
      name: 'ছাত্রকল্যাণ তহবিল',
      code: 'STU',
      description: 'পাটগ্রাম ছাত্র কল্যাণ সমিতি, রংপুরের শিক্ষা, ক্যারিয়ার ও সাংস্কৃতিক কার্যক্রম তহবিল।',
      currentBalance: 0,
      isActive: true,
      isDefault: false,
    },
    {
      id: 'fund-7',
      name: 'স্থায়ী বা সংরক্ষিত তহবিল',
      code: 'RES',
      description: 'সংগঠনের দীর্ঘমেয়াদি স্থায়িত্ব, স্থায়ী কার্যালয় ও ভবিষ্যৎ নিরাপত্তার জন্য সংরক্ষিত অর্থ।',
      currentBalance: 0,
      isActive: true,
      isDefault: false,
    },
  ] satisfies FinancialFund[],

  // Clean Initial Accounts Structure (All balances start strictly at ৳0)
  defaultAccounts: [
    {
      id: 'acc-1',
      name: 'ব্যাংক অ্যাকাউন্ট (প্রধান তহবিল)',
      type: 'bank',
      accountNumber: 'অ্যাডমিন প্যানেল থেকে যুক্ত করুন',
      currentBalance: 0,
      isActive: true,
    },
    {
      id: 'acc-2',
      name: 'নগদ হাতে ক্যাশ (কোষাধ্যক্ষ)',
      type: 'cash',
      accountNumber: 'ক্যাশ ব্যালেন্স',
      currentBalance: 0,
      isActive: true,
    },
    {
      id: 'acc-3',
      name: 'মোবাইল ব্যাংকিং ওয়ালেট (বিকাশ / নগদ)',
      type: 'mobile_banking',
      accountNumber: '01603526000',
      currentBalance: 0,
      isActive: true,
    },
  ] satisfies FinancialAccount[],
};
