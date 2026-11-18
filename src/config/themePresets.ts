/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ThemePreset } from '../types.ts';

export interface ThemePresetMeta {
  id: ThemePreset;
  labelBn: string;
  subtitleBn: string;
  primaryHex: string;
  accentHex: string;
  surfaceHex: string;
  themeColorMeta: string;
}

export const THEME_PRESETS: ThemePresetMeta[] = [
  {
    id: 'emerald_gold',
    labelBn: 'এমেরাল্ড ও গোল্ড (ডিফল্ট)',
    subtitleBn: 'চিরায়ত সবুজ ও সোনালি আভিজাত্য',
    primaryHex: '#065f46',
    accentHex: '#d97706',
    surfaceHex: '#ecfdf5',
    themeColorMeta: '#14532d',
  },
  {
    id: 'royal_blue',
    labelBn: 'রয়্যাল ব্লু ও গোল্ড',
    subtitleBn: 'প্রাতিষ্ঠানিক নীল ও সোনালি কনট্রাস্ট',
    primaryHex: '#1e40af',
    accentHex: '#d97706',
    surfaceHex: '#eff6ff',
    themeColorMeta: '#1e3a8a',
  },
  {
    id: 'crimson_charcoal',
    labelBn: 'ক্রিমসন ও মেরুন',
    subtitleBn: 'ঐতিহ্যবাহী লালচে-মেরুন ও চারকোল',
    primaryHex: '#9f1239',
    accentHex: '#f59e0b',
    surfaceHex: '#fff1f2',
    themeColorMeta: '#881337',
  },
  {
    id: 'teal_copper',
    labelBn: 'ডিপ টিল ও কপার',
    subtitleBn: 'আধুনিক সমুদ্র-সবুজ ও তামাটে আভা',
    primaryHex: '#115e59',
    accentHex: '#ea580c',
    surfaceHex: '#f0fdfa',
    themeColorMeta: '#134e4a',
  },
  {
    id: 'indigo_forest',
    labelBn: 'ইন্ডিগো ও অ্যাম্বার',
    subtitleBn: 'গভীর নীল-বেগুনি ও সোনালি-হলুদ',
    primaryHex: '#3730a3',
    accentHex: '#d97706',
    surfaceHex: '#eef2ff',
    themeColorMeta: '#312e81',
  },
  {
    id: 'forest_slate',
    labelBn: 'স্লেট ও ব্রোঞ্জ',
    subtitleBn: 'ক্লাসিক ডার্ক স্লেট ও গাম্ভীর্যপূর্ণ ব্রোঞ্জ',
    primaryHex: '#1e293b',
    accentHex: '#d97706',
    surfaceHex: '#f8fafc',
    themeColorMeta: '#0f172a',
  },
];

export const THEME_PRESET_MAP: Record<ThemePreset, ThemePresetMeta> = THEME_PRESETS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<ThemePreset, ThemePresetMeta>
);
