/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, CheckCircle2, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showDesktopModal, setShowDesktopModal] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    // Check if already running as standalone PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
    }

    // Check if user dismissed previously in this session
    const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isIOSDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallSuccess(true);
      setDeferredPrompt(null);
      setTimeout(() => setInstallSuccess(false), 4000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setInstallSuccess(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // Fallback guided modal for desktop or environments without beforeinstallprompt
      setShowDesktopModal(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  // If already installed or dismissed, do not render banner
  if (isInstalled && !installSuccess) return null;
  if (isDismissed && !showIOSModal && !showDesktopModal) return null;

  return (
    <>
      {/* PWA Notification Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-850 to-teal-950 text-white border-b border-emerald-700/60 py-2.5 px-4 sm:px-6 shadow-md transition-all relative z-50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left Text & Icon */}
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-9 h-9 rounded-xl bg-emerald-800 border border-emerald-600/50 flex items-center justify-center shrink-0 shadow-sm text-amber-300">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
                <span>ফোনে পাটগ্রাম কল্যাণ সমিতি অ্যাপ ইনস্টল করুন</span>
                <span className="hidden md:inline-block px-2 py-0.2 rounded-full bg-amber-400 text-stone-950 text-[10px] font-extrabold uppercase tracking-wide">
                  PWA App
                </span>
              </div>
              <p className="text-[11px] text-emerald-200 hidden sm:block">
                হোম স্ক্রিন থেকে সহজে, দ্রুত ও অফলাইনেও ওয়েবসাইট ও সেবাসমূহ ব্যবহার করুন।
              </p>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {installSuccess ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-emerald-950/80 px-3 py-1.5 rounded-lg border border-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>সফলভাবে ইনস্টল হয়েছে!</span>
              </span>
            ) : (
              <button
                onClick={handleInstallClick}
                className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ইনস্টল (Install)</span>
              </button>
            )}

            <button
              onClick={handleDismiss}
              className="p-1.5 text-emerald-300 hover:text-white rounded-lg hover:bg-emerald-800/60 transition-colors cursor-pointer"
              title="ব্যানার বন্ধ করুন"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Guided Install Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl relative text-stone-900 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-3 pt-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-900">
                আইফোন / আইপ্যাডে ইনস্টল করার নিয়ম
              </h3>
              <div className="text-xs text-stone-600 text-left bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-emerald-800">১.</span>
                  <span>
                    Safari ব্রাউজারের নিচে থাকা <strong>Share (শেয়ার)</strong> আইকনটিতে ট্যাপ করুন।
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-emerald-800">২.</span>
                  <span>
                    নিচে স্ক্রোল করে <strong>Add to Home Screen (হোম স্ক্রিনে যোগ করুন)</strong> অপশনটিতে ট্যাপ করুন।
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-emerald-800">৩.</span>
                  <span>উপরে ডানে <strong>Add</strong> চাপুন—অ্যাপটি আপনার হোম স্ক্রিনে যুক্ত হয়ে যাবে।</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                বুঝেছি (বন্ধ করুন)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Desktop / Browser Guided Install Modal */}
      {showDesktopModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl relative text-stone-900 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <button
              type="button"
              onClick={() => setShowDesktopModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
              aria-label="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-3 pt-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-900">
                ব্রাউজার থেকে অ্যাপ ইনস্টল করার নিয়ম
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-4 rounded-xl border border-stone-200 text-left">
                আপনার ব্রাউজারের অ্যাড্রেস বারের ডানপাশে থাকা <strong>“Install”</strong> আইকনটিতে ক্লিক করুন অথবা ব্রাউজার মেন্যু (⋮) থেকে <strong>“Install পাটগ্রাম কল্যাণ সমিতি”</strong> / <strong>“Add to Home screen”</strong> নির্বাচন করুন।
              </p>

              <button
                type="button"
                onClick={() => setShowDesktopModal(false)}
                className="w-full py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                বুঝেছি (বন্ধ করুন)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
