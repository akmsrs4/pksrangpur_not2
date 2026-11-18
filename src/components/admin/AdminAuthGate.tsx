/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../db/store.ts';
import { supabase, isSupabaseConfigured } from '../../lib/supabase.ts';
import {
  Shield,
  Lock,
  Mail,
  User,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { Role } from '../../types.ts';

interface AdminAuthGateProps {
  onBackToPublic: () => void;
}

export const AdminAuthGate: React.FC<AdminAuthGateProps> = ({ onBackToPublic }) => {
  const store = useAppStore();

  const [isFirstSetup, setIsFirstSetup] = useState<boolean>(() =>
    isSupabaseConfigured ? false : !store.hasAnySuperAdminLocal()
  );
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'update_password'>(() =>
    !isSupabaseConfigured && !store.hasAnySuperAdminLocal() ? 'register' : 'login'
  );

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [requestedRole, setRequestedRole] = useState<Role>('finance_secretary');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update_password');
        setPassword('');
        setConfirmPassword('');
        setFeedback({
          type: 'info',
          text: 'পাসওয়ার্ড রিসেট লিংক যাচাই হয়েছে। নিচে আপনার নতুন পাসওয়ার্ড সেট করুন।',
        });
      }
    });
    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function checkFirstSetup() {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase.rpc('is_first_admin_setup');
          if (active && !error && typeof data === 'boolean') {
            setIsFirstSetup(data);
            if (data) setMode('register');
          }
        } catch {
          // ignore if RPC not installed yet
        }
      } else {
        const first = !store.hasAnySuperAdminLocal();
        setIsFirstSetup(first);
        if (first) setMode('register');
      }
    }
    checkFirstSetup();
    return () => {
      active = false;
    };
  }, [store.adminAccounts.length]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setNeedsEmailConfirm(false);
    setIsLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          const msgLower = error.message.toLowerCase();
          if (msgLower.includes('email not confirmed')) {
            setNeedsEmailConfirm(true);
            setFeedback({
              type: 'error',
              text: 'আপনার ইমেইল এখনো কনফার্ম/যাচাই করা হয়নি। ইমেইল ইনবক্স (বা স্প্যাম) থেকে ভেরিফিকেশন লিংকে ক্লিক করুন অথবা সুপার অ্যাডমিনের মাধ্যমে অ্যাকাউন্ট অনুমোদন সম্পন্ন করান।',
            });
          } else {
            setFeedback({
              type: 'error',
              text:
                error.message === 'Invalid login credentials'
                  ? 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়। দয়া করে আবার যাচাই করুন।'
                  : `লগইন ত্রুটি: ${error.message}`,
            });
          }
          return;
        }

        if (data.user) {
          const profileRes = await store.syncSupabaseProfile(data.user.id, data.user.email || email);
          if (!profileRes.success) {
            setFeedback({ type: 'error', text: profileRes.error || 'প্রোফাইল যাচাইয়ে সমস্যা হয়েছে।' });
          }
        }
      } else {
        const res = await store.loginAdminLocal(email, password);
        if (!res.success) {
          setFeedback({ type: 'error', text: res.error || 'লগইন ব্যর্থ হয়েছে।' });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (password.length < 6) {
      setFeedback({ type: 'error', text: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
      return;
    }
    if (password !== confirmPassword) {
      setFeedback({ type: 'error', text: 'পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মিলছে না।' });
      return;
    }

    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
              ...(isFirstSetup ? {} : { requested_role: requestedRole }),
            },
          },
        });

        if (error) {
          setFeedback({ type: 'error', text: `নিবন্ধন ত্রুটি: ${error.message}` });
          return;
        }

        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setFeedback({
            type: 'error',
            text: 'এই ইমেইল দিয়ে ইতোমধ্যে একটি অ্যাকাউন্ট নিবন্ধিত রয়েছে। দয়া করে "অ্যাডমিন লগইন" ট্যাব থেকে লগইন করুন।',
          });
          return;
        }

        if (data.user && data.session) {
          const profileRes = await store.syncSupabaseProfile(data.user.id, data.user.email || email);
          if (!profileRes.success) {
            setFeedback({ type: 'info', text: profileRes.error || 'নিবন্ধন সম্পন্ন হয়েছে।' });
            setMode('login');
          }
        } else {
          setFeedback({
            type: 'success',
            text: 'অ্যাকাউন্ট নিবন্ধন সফল! আপনার ইমেইল ইনবক্সে ভেরিফিকেশন লিংক পাঠানো হলে তা নিশ্চিত করে লগইন করুন। (প্রথম নিবন্ধিত অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে সুপার অ্যাডমিন হবে।)',
          });
          setMode('login');
        }
      } else {
        const res = await store.registerAdminLocal({
          fullName,
          email,
          phone,
          password,
          requestedRole,
        });

        if (!res.success) {
          setFeedback({ type: 'error', text: res.error || 'নিবন্ধন ব্যর্থ হয়েছে।' });
          return;
        }

        if (res.pendingApproval) {
          setFeedback({
            type: 'success',
            text: 'আপনার কর্মকর্তা অ্যাকাউন্ট আবেদনটি জমা হয়েছে! সুপার অ্যাডমিন অনুমোদন করলে আপনার ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করতে পারবেন।',
          });
          setMode('login');
          setPassword('');
          setConfirmPassword('');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFeedback({ type: 'error', text: 'আপনার নিবন্ধিত ইমেইল ঠিকানা লিখুন।' });
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setFeedback({
        type: 'info',
        text: 'অফলাইন/লোকাল মোডে ইমেইল পাসওয়ার্ড রিসেট চালু নেই। অনুগ্রহ করে সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: window.location.origin,
      });
      if (error) {
        setFeedback({ type: 'error', text: `রিসেট লিংক পাঠানো যায়নি: ${error.message}` });
      } else {
        setFeedback({
          type: 'success',
          text: 'আপনার ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে! ইনবক্স (বা স্প্যাম ফোল্ডার) দেখে লিংকে ক্লিক করুন।',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!isSupabaseConfigured || !supabase || !email.trim()) return;
    setIsLoading(true);
    setFeedback(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        setFeedback({ type: 'error', text: `ইমেইল পাঠানো যায়নি: ${error.message}` });
      } else {
        setNeedsEmailConfirm(false);
        setFeedback({
          type: 'success',
          text: 'আপনার ইমেইলে নতুন ভেরিফিকেশন লিংক পাঠানো হয়েছে। ইনবক্স/স্প্যাম ফোল্ডার চেক করে লিংকে ক্লিক করুন।',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (password.length < 6) {
      setFeedback({ type: 'error', text: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
      return;
    }
    if (password !== confirmPassword) {
      setFeedback({ type: 'error', text: 'নতুন পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মিলছে না।' });
      return;
    }

    if (!isSupabaseConfigured || !supabase) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFeedback({ type: 'error', text: `পাসওয়ার্ড আপডেট ব্যর্থ: ${error.message}` });
      } else {
        setFeedback({
          type: 'success',
          text: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে! এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।',
        });
        setPassword('');
        setConfirmPassword('');
        setMode('login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 text-stone-900">
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Back Button */}
        <div>
          <button
            onClick={onBackToPublic}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold border border-stone-200 shadow-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>পাবলিক ওয়েবসাইটে ফিরে যান</span>
          </button>
        </div>

        {/* Main Auth Card */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-emerald-950 text-white px-6 py-7 text-center space-y-2 relative">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-900 border border-emerald-700/60 text-amber-400 flex items-center justify-center shadow-inner">
              <Shield className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">
              {store.settings.organizationNameBn}
            </h1>
            <p className="text-xs text-emerald-200">
              সুরক্ষিত অ্যাডমিন পোর্টাল ও সুপার অ্যাডমিন অথেন্টিকেশন
            </p>

            {/* Security Badge */}
            <div className="pt-2 flex justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/90 border border-emerald-700 text-[11px] font-semibold text-emerald-200">
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span>সুরক্ষিত ও এনক্রিপ্টেড অ্যাডমিন গেটওয়ে</span>
              </span>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-2 border-b border-stone-200 bg-stone-50">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setFeedback(null);
              }}
              className={`py-3.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-emerald-900 border-b-2 border-emerald-700'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>অ্যাডমিন লগইন</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setFeedback(null);
              }}
              className={`py-3.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-emerald-900 border-b-2 border-emerald-700'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isFirstSetup ? 'প্রথম সুপার অ্যাডমিন সেটআপ' : 'কর্মকর্তা নিবন্ধন'}</span>
            </button>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-7 space-y-5">
            {/* First-time setup callout */}
            {isFirstSetup && mode === 'register' && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>প্রথমবার সুপার অ্যাডমিন অ্যাকাউন্ট তৈরি করুন</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  এখনো কোনো সুপার অ্যাডমিন নিবন্ধিত হয়নি। এখানে আপনার নিজের ইমেইল ও পাসওয়ার্ড দিয়ে নিবন্ধন করলেই আপনি স্বয়ংক্রিয়ভাবে <strong>সুপার অ্যাডমিন (মাস্টার কন্ট্রোল)</strong> হয়ে যাবেন।
                </p>
              </div>
            )}

            {!isFirstSetup && mode === 'register' && (
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-700 text-[11px] leading-relaxed">
                সুপার অ্যাডমিন ইতোমধ্যে নিবন্ধিত রয়েছেন। এখান থেকে নিবন্ধন করলে আপনার অ্যাকাউন্টটি <strong>সুপার অ্যাডমিনের অনুমোদনের (Pending)</strong> জন্য জমা থাকবে।
              </div>
            )}

            {feedback && (
              <div
                className={`p-3.5 rounded-xl text-xs flex flex-col gap-2 border ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : feedback.type === 'info'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.text}</span>
                </div>
                {needsEmailConfirm && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => void handleResendConfirmation()}
                    className="self-start ml-6 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold cursor-pointer"
                  >
                    ভেরিফিকেশন ইমেইল পুনরায় পাঠান
                  </button>
                )}
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    ইমেইল / ইউজার আইডি *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@gmail.com"
                      className="w-full pl-9 pr-3 py-2.5 text-xs border border-stone-300 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    পাসওয়ার্ড *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2.5 text-xs border border-stone-300 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:border-emerald-700"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4 text-amber-300" />
                  <span>{isLoading ? 'যাচাই করা হচ্ছে...' : 'অ্যাডমিন প্যানেলে প্রবেশ করুন'}</span>
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setFeedback(null);
                    }}
                    className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
                  >
                    পাসওয়ার্ড ভুলে গেছেন? রিসেট করুন
                  </button>
                </div>
              </form>
            ) : mode === 'forgot' ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-[11px] text-stone-700 leading-relaxed">
                  আপনার নিবন্ধিত ইমেইল ঠিকানা দিলে পাসওয়ার্ড পুনঃস্থাপনের লিংক পাঠানো হবে।
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    নিবন্ধিত ইমেইল *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your-email@gmail.com"
                      className="w-full pl-9 pr-3 py-2.5 text-xs border border-stone-300 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  {isLoading ? 'পাঠানো হচ্ছে...' : 'রিসেট লিংক পাঠান'}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setFeedback(null);
                    }}
                    className="text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
                  >
                    লগইনে ফিরে যান
                  </button>
                </div>
              </form>
            ) : mode === 'update_password' ? (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3 py-2.5 text-xs border border-stone-300 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    নতুন পাসওয়ার্ড পুনরায় দিন *
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3 py-2.5 text-xs border border-stone-300 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:border-emerald-700"
                  />
                </div>
                <label className="flex items-center gap-2 text-[11px] text-stone-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  <span>পাসওয়ার্ড দেখান</span>
                </label>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  {isLoading ? 'সংরক্ষণ হচ্ছে...' : 'নতুন পাসওয়ার্ড সংরক্ষণ করুন'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    পূর্ণ নাম (বাংলা বা ইংরেজি) *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="আপনার নাম লিখুন"
                      className="w-full pl-9 pr-3 py-2.5 text-xs border border-stone-300 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    ইমেইল (লগইন ইউজার আইডি হিসেবে ব্যবহৃত হবে) *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your-email@gmail.com"
                      className="w-full pl-9 pr-3 py-2.5 text-xs border border-stone-300 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    মোবাইল নম্বর (ঐচ্ছিক)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3 py-2.5 text-xs border border-stone-300 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:border-emerald-700 font-mono"
                  />
                </div>

                {!isFirstSetup && (
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      প্রত্যাশিত দায়িত্ব (ভূমিকা)
                    </label>
                    <select
                      value={requestedRole}
                      onChange={(e) => setRequestedRole(e.target.value as Role)}
                      className="w-full px-3 py-2.5 text-xs border border-stone-300 rounded-xl bg-stone-50"
                    >
                      <option value="finance_secretary">অর্থ সম্পাদক (Finance Secretary)</option>
                      <option value="president">সভাপতি (President)</option>
                      <option value="general_secretary">সাধারণ সম্পাদক (General Secretary)</option>
                      <option value="general_admin">সাধারণ সদস্য অ্যাডমিন</option>
                      <option value="student_admin">ছাত্র সংগঠন অ্যাডমিন</option>
                      <option value="event_admin">অনুষ্ঠান ও আয়োজন অ্যাডমিন (Event Admin)</option>
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full px-3 py-2.5 text-xs border border-stone-300 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      পুনরায় পাসওয়ার্ড দিন *
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full px-3 py-2.5 text-xs border border-stone-300 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-[11px] text-stone-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  <span>পাসওয়ার্ড দেখান</span>
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4 text-amber-300" />
                  <span>
                    {isLoading
                      ? 'প্রক্রিয়াকরণ হচ্ছে...'
                      : isFirstSetup
                        ? 'সুপার অ্যাডমিন হিসেবে নিবন্ধন ও প্রবেশ করুন'
                        : 'নিবন্ধন আবেদন জমা দিন'}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
