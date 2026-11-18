/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../db/store.ts';
import {
  Shield,
  PlusCircle,
  Eye,
  EyeOff,
  Lock,
  Archive,
  Printer,
  Trash2,
  Edit3,
  Award,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { CommitteePosition, FounderCategory, FounderEntry } from '../../types.ts';
import { PersonAvatar } from '../PersonAvatar.tsx';

export const AdminCommitteesView: React.FC = () => {
  const store = useAppStore();
  const permissions = store.getEffectivePermissions();

  const [selectedTermId, setSelectedTermId] = useState<string>(
    store.committees[0]?.id || ''
  );
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDeleteTermId, setConfirmDeleteTermId] = useState<string | null>(null);
  const [confirmDeletePosId, setConfirmDeletePosId] = useState<string | null>(null);

  // Founders & Founding Members state
  const [founderFilter, setFounderFilter] = useState<'all' | FounderCategory>('all');
  const [showFounderModal, setShowFounderModal] = useState(false);
  const [editingFounder, setEditingFounder] = useState<FounderEntry | null>(null);
  const [confirmDeleteFounderId, setConfirmDeleteFounderId] = useState<string | null>(null);
  const [fCategory, setFCategory] = useState<FounderCategory>('founder');
  const [fNameBn, setFNameBn] = useState('');
  const [fNameEn, setFNameEn] = useState('');
  const [fDesignationBn, setFDesignationBn] = useState('');
  const [fPhotoUrl, setFPhotoUrl] = useState('');
  const [fBioBn, setFBioBn] = useState('');
  const [fPriority, setFPriority] = useState(1);
  const [fIsPublished, setFIsPublished] = useState(true);

  useEffect(() => {
    if (!store.committees.some((c) => c.id === selectedTermId)) {
      setSelectedTermId(store.committees[0]?.id || '');
    }
  }, [store.committees, selectedTermId]);

  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<CommitteePosition | null>(null);
  const [showAddTermModal, setShowAddTermModal] = useState(false);

  // New / Edit Position Form State (Privacy default: unpublished until admin toggles)
  const [posTitle, setPosTitle] = useState('');
  const [posMemberName, setPosMemberName] = useState('');
  const [posPhone, setPosPhone] = useState('');
  const [posPhotoUrl, setPosPhotoUrl] = useState('');
  const [posPriority, setPosPriority] = useState(10);
  const [posIsPublished, setPosIsPublished] = useState(false);

  // New Term Form State
  const [termTitle, setTermTitle] = useState('');
  const [termWing, setTermWing] = useState<'central' | 'student_wing' | 'advisory'>('central');
  const [termStartYear, setTermStartYear] = useState(new Date().getFullYear());
  const [termEndYear, setTermEndYear] = useState(new Date().getFullYear() + 2);
  const [termIsCurrent, setTermIsCurrent] = useState(true);

  if (!permissions.can_manage_committees) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
        <Lock className="w-12 h-12 text-stone-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-stone-900">কমিটি প্রশাসন সুরক্ষিত</h3>
        <p className="text-xs text-stone-500">আপনার বর্তমান রোলের জন্য কমিটি পরিচালনার অনুমতি নেই।</p>
      </div>
    );
  }

  const selectedTerm = store.committees.find((c) => c.id === selectedTermId);

  const openAddPositionModal = () => {
    setEditingPosition(null);
    setPosTitle('');
    setPosMemberName('');
    setPosPhone('');
    setPosPhotoUrl('');
    const nextPriority = (selectedTerm?.positions.length || 0) + 1;
    setPosPriority(nextPriority);
    setPosIsPublished(false);
    setShowAddPositionModal(true);
  };

  const openEditPositionModal = (pos: CommitteePosition) => {
    setEditingPosition(pos);
    setPosTitle(pos.title);
    setPosMemberName(pos.memberNameBn);
    setPosPhone(pos.phone || '');
    setPosPhotoUrl(pos.photoUrl || '');
    setPosPriority(pos.priority);
    setPosIsPublished(pos.isPublished);
    setShowAddPositionModal(true);
  };

  const handlePositionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!posTitle.trim() || !posMemberName.trim()) return;
    setFeedback(null);

    const payload = {
      title: posTitle.trim(),
      memberNameBn: posMemberName.trim(),
      phone: posPhone.trim() || undefined,
      photoUrl: posPhotoUrl.trim() || undefined,
      priority: Number(posPriority) || 1,
      isPublished: posIsPublished,
    };

    const res = editingPosition
      ? store.updateCommitteePosition(selectedTermId, editingPosition.id, payload)
      : store.addCommitteePosition(selectedTermId, payload);

    if (res.success) {
      setShowAddPositionModal(false);
      setEditingPosition(null);
      setPosTitle('');
      setPosMemberName('');
      setPosPhone('');
      setPosPhotoUrl('');
      setPosIsPublished(false);
      setFeedback({
        type: 'success',
        text: editingPosition ? 'কমিটির পদবি ও ছবি সফলভাবে হালনাগাদ হয়েছে।' : 'নতুন পদবি ও তথ্য যুক্ত হয়েছে।',
      });
    } else {
      setFeedback({ type: 'error', text: res.error || 'পদবি সংরক্ষণ করা যায়নি।' });
    }
  };

  const handleAddTermSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termTitle.trim()) return;

    const res = store.addCommitteeTerm({
      title: termTitle.trim(),
      wing: termWing,
      startYear: Number(termStartYear),
      endYear: Number(termEndYear),
      isCurrent: termIsCurrent,
      positions: [],
    });

    if (res.term) {
      setSelectedTermId(res.term.id);
    }
    setShowAddTermModal(false);
    setTermTitle('');
  };

  const handleDeleteTerm = (termId: string) => {
    const res = store.deleteCommitteeTerm(termId);
    setConfirmDeleteTermId(null);
    if (res.success) {
      setFeedback({ type: 'success', text: 'কমিটি মেয়াদ সফলভাবে মুছে ফেলা হয়েছে।' });
    } else {
      setFeedback({ type: 'error', text: res.error || 'কমিটি মুছে ফেলা যায়নি।' });
    }
  };

  const handleDeletePosition = (termId: string, positionId: string) => {
    const res = store.deleteCommitteePosition(termId, positionId);
    setConfirmDeletePosId(null);
    if (res.success) {
      setFeedback({ type: 'success', text: 'কমিটির পদবিটি মুছে ফেলা হয়েছে।' });
    } else {
      setFeedback({ type: 'error', text: res.error || 'পদবি মুছে ফেলা যায়নি।' });
    }
  };

  const openAddFounderModal = (category: FounderCategory) => {
    setEditingFounder(null);
    setFCategory(category);
    setFNameBn('');
    setFNameEn('');
    setFDesignationBn('');
    setFPhotoUrl('');
    setFBioBn('');
    const sameCategoryCount = (store.settings.founders || []).filter((f) => f.category === category).length;
    setFPriority(sameCategoryCount + 1);
    setFIsPublished(true);
    setShowFounderModal(true);
  };

  const openEditFounderModal = (entry: FounderEntry) => {
    setEditingFounder(entry);
    setFCategory(entry.category);
    setFNameBn(entry.nameBn);
    setFNameEn(entry.nameEn || '');
    setFDesignationBn(entry.designationBn);
    setFPhotoUrl(entry.photoUrl || '');
    setFBioBn(entry.bioBn || '');
    setFPriority(entry.priority);
    setFIsPublished(entry.isPublished);
    setShowFounderModal(true);
  };

  const handleFounderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const payload = {
      category: fCategory,
      nameBn: fNameBn.trim(),
      nameEn: fNameEn.trim() || undefined,
      designationBn: fDesignationBn.trim(),
      photoUrl: fPhotoUrl.trim() || undefined,
      bioBn: fBioBn.trim() || undefined,
      priority: Number(fPriority) || 1,
      isPublished: fIsPublished,
    };

    const res = editingFounder
      ? store.updateFounder(editingFounder.id, payload)
      : store.addFounder(payload);

    if (res.success) {
      setShowFounderModal(false);
      setEditingFounder(null);
      setFeedback({
        type: 'success',
        text: editingFounder ? 'প্রতিষ্ঠাতা / সদস্যের তথ্য সংশোধিত হয়েছে!' : 'নতুন প্রতিষ্ঠাতা / সদস্য তালিকায় যুক্ত হয়েছে!',
      });
    } else {
      setFeedback({ type: 'error', text: res.error || 'সংরক্ষণ করা যায়নি।' });
    }
  };

  const handleDeleteFounder = (founderId: string) => {
    const res = store.deleteFounder(founderId);
    setConfirmDeleteFounderId(null);
    if (res.success) {
      setFeedback({ type: 'success', text: 'তালিকা থেকে নামটি মুছে ফেলা হয়েছে।' });
    } else {
      setFeedback({ type: 'error', text: res.error || 'মুছে ফেলা যায়নি।' });
    }
  };

  const allFounders = (store.settings.founders || []).slice().sort((a, b) => a.priority - b.priority);
  const filteredFounders =
    founderFilter === 'all' ? allFounders : allFounders.filter((f) => f.category === founderFilter);

  return (
    <div className="space-y-6">
      {selectedTerm && (
        <div className="print-only border-b-2 border-stone-800 pb-3 mb-4 text-center">
          <h1 className="text-xl font-bold text-stone-900">{store.settings.organizationNameBn}</h1>
          <p className="text-xs text-stone-600">
            {selectedTerm.title} ({selectedTerm.startYear}–{selectedTerm.endYear}) — কর্মকর্তা ও পদবি তালিকা | তারিখ:{' '}
            {new Date().toISOString().substring(0, 10)}
          </p>
        </div>
      )}

      {/* Top Banner */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-700" />
            <span>কমিটি ও কার্যকরী পরিষদ প্রশাসন</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            নতুন কমিটি তৈরি, পদবি সংযোজন, প্রতিষ্ঠাতাবৃন্দ ও প্রতিষ্ঠাতা সদস্যবৃন্দের তালিকা এবং পাবলিক ডিসপ্লে নিয়ন্ত্রণ।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedTerm && (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs shadow flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>কমিটি তালিকা PDF</span>
            </button>
          )}
          <button
            onClick={() => setShowAddTermModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ নতুন কমিটি তৈরি</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`no-print p-3.5 rounded-xl text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-stone-400 hover:text-stone-700 cursor-pointer">
            ×
          </button>
        </div>
      )}

      {/* Term Selector Strip */}
      <div className="no-print flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-stone-200">
        <span className="text-xs font-semibold text-stone-500 mr-2">কমিটি নির্বাচন:</span>
        {store.committees.map((term) => (
          <button
            key={term.id}
            onClick={() => setSelectedTermId(term.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedTermId === term.id
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
            }`}
          >
            <span>{term.title}</span>
            {term.isCurrent && (
              <span className="px-1.5 py-0.2 bg-emerald-600 text-white text-[9px] font-bold rounded">
                সক্রিয়
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active Committee Details */}
      {selectedTerm ? (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-stone-900">{selectedTerm.title}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                  {selectedTerm.wing === 'central'
                    ? 'মূল কার্যকরী পরিষদ'
                    : selectedTerm.wing === 'student_wing'
                    ? store.settings.studentWingNameBn || 'ছাত্র কল্যাণ সমিতি'
                    : 'উপদেষ্টা পরিষদ'}
                </span>
                {selectedTerm.isCurrent ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    বর্তমান সক্রিয় মেয়াদ
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 font-bold flex items-center gap-1">
                    <Archive className="w-3 h-3" /> আর্কাইভকৃত ইতিহাস
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-1">
                মেয়াদকাল: {selectedTerm.startYear} - {selectedTerm.endYear} · মোট পদবি: {selectedTerm.positions.length}টি
              </p>
            </div>

            <div className="no-print flex flex-wrap items-center gap-2">
              <button
                onClick={openAddPositionModal}
                className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs border border-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-emerald-700" />
                <span>+ নতুন পদ যুক্ত করুন</span>
              </button>
              {confirmDeleteTermId === selectedTerm.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDeleteTerm(selectedTerm.id)}
                    className="px-3 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold cursor-pointer"
                  >
                    নিশ্চিত কমিটি মুছুন
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteTermId(null)}
                    className="px-2.5 py-2 rounded-xl bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
                  >
                    বাতিল
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteTermId(selectedTerm.id)}
                  className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>কমিটি মুছুন</span>
                </button>
              )}
            </div>
          </div>

          {/* Positions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">পদমর্যাদা (ক্রম)</th>
                  <th className="py-3 px-4">পদবির নাম</th>
                  <th className="py-3 px-4">দায়িত্বপ্রাপ্ত কর্মকর্তার নাম</th>
                  <th className="py-3 px-4">ফোন নম্বর</th>
                  <th className="py-3 px-4 text-center">পাবলিক ডিসপ্লে স্থিতি</th>
                  <th className="py-3 px-4 text-center no-print">টগল অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {selectedTerm.positions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-stone-500">{pos.priority}</td>
                    <td className="py-3 px-4 font-bold text-stone-900">{pos.title}</td>
                    <td className="py-3 px-4 font-semibold text-emerald-900">
                      <div className="flex items-center gap-2.5">
                        <PersonAvatar
                          photoUrl={pos.photoUrl}
                          name={pos.memberNameBn}
                          sizeClass="w-8 h-8"
                          roundedClass="rounded-full"
                          bgClass={
                            selectedTerm.wing === 'advisory'
                              ? 'bg-amber-100'
                              : 'bg-emerald-100'
                          }
                          iconClass={
                            selectedTerm.wing === 'advisory'
                              ? 'text-amber-800/80'
                              : 'text-emerald-800/80'
                          }
                          borderClass="border border-stone-200"
                        />
                        <div className="min-w-0">
                          <div className="truncate">{pos.memberNameBn}</div>
                          <div className="text-[10px] font-normal text-stone-400">
                            {pos.photoUrl ? 'ছবি সংযুক্ত' : 'ডিফল্ট অবয়ব'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-stone-600">{pos.phone || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          pos.isPublished
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {pos.isPublished ? 'পাবলিকে প্রদর্শিত' : 'অপ্রকাশিত / গোপন'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center no-print">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditPositionModal(pos)}
                          title="তথ্য ও ছবি সংশোধন"
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 border border-stone-200 text-emerald-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>সংশোধন</span>
                        </button>
                        <button
                          onClick={() => store.togglePositionVisibility(selectedTerm.id, pos.id)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                            pos.isPublished
                              ? 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                              : 'bg-emerald-800 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {pos.isPublished ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>লুকান</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>প্রকাশ করুন</span>
                            </>
                          )}
                        </button>
                        {confirmDeletePosId === pos.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeletePosition(selectedTerm.id, pos.id)}
                              className="px-2 py-1 rounded bg-red-700 text-white text-[10px] font-bold cursor-pointer"
                            >
                              মুছুন
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePosId(null)}
                              className="px-1.5 py-1 rounded bg-stone-200 text-stone-700 text-[10px] cursor-pointer"
                            >
                              না
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePosId(pos.id)}
                            title="পদবি মুছে ফেলুন"
                            className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-stone-500">কোনো কমিটি পাওয়া যায়নি।</div>
      )}

      {/* Founders & Founding Members Management Panel */}
      <div className="no-print bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-stone-100">
          <div>
            <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              <span>প্রতিষ্ঠাতাবৃন্দ ও প্রতিষ্ঠাতা সদস্যবৃন্দ (Founders & Founding Members)</span>
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              এখানে সংরক্ষিত তালিকা পাবলিক ওয়েবসাইটের “পরিচিতি” ও “কমিটি” পেজে পৃথকভাবে প্রদর্শিত হয়।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openAddFounderModal('founder')}
              className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-amber-300" />
              <span>+ প্রতিষ্ঠাতা যুক্ত করুন</span>
            </button>
            <button
              type="button"
              onClick={() => openAddFounderModal('founding_member')}
              className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-amber-300" />
              <span>+ প্রতিষ্ঠাতা সদস্য যুক্ত করুন</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFounderFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              founderFilter === 'all' ? 'bg-emerald-800 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            সকল ({allFounders.length})
          </button>
          <button
            type="button"
            onClick={() => setFounderFilter('founder')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              founderFilter === 'founder' ? 'bg-emerald-800 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            প্রতিষ্ঠাতাবৃন্দ ({allFounders.filter((f) => f.category === 'founder').length})
          </button>
          <button
            type="button"
            onClick={() => setFounderFilter('founding_member')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              founderFilter === 'founding_member' ? 'bg-emerald-800 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            প্রতিষ্ঠাতা সদস্যবৃন্দ ({allFounders.filter((f) => f.category === 'founding_member').length})
          </button>
        </div>

        {filteredFounders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFounders.map((entry) => (
              <div
                key={entry.id}
                className="p-4 rounded-xl border border-stone-200 bg-stone-50/70 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <PersonAvatar
                    photoUrl={entry.photoUrl}
                    name={entry.nameBn}
                    sizeClass="w-10 h-10"
                    roundedClass="rounded-xl"
                    bgClass={entry.category === 'founder' ? 'bg-emerald-800' : 'bg-stone-800'}
                    iconClass="text-amber-300"
                    borderClass="border border-stone-200"
                  />
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-700">
                        ক্রম: {entry.priority}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          entry.category === 'founder'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}
                      >
                        {entry.category === 'founder' ? 'প্রতিষ্ঠাতা (Founder)' : 'প্রতিষ্ঠাতা সদস্য'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          entry.isPublished ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-200 text-stone-600'
                        }`}
                      >
                        {entry.isPublished ? 'প্রকাশিত' : 'লুকানো'}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-stone-900">{entry.nameBn}</div>
                    <div className="text-xs font-semibold text-emerald-800">{entry.designationBn}</div>
                    {entry.bioBn && <p className="text-[11px] text-stone-600 leading-relaxed">{entry.bioBn}</p>}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200/70">
                  <button
                    type="button"
                    onClick={() => store.toggleFounderVisibility(entry.id)}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-stone-100 border border-stone-200 text-xs font-semibold text-stone-700 flex items-center gap-1 cursor-pointer"
                  >
                    {entry.isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{entry.isPublished ? 'লুকান' : 'প্রকাশ'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditFounderModal(entry)}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 border border-stone-200 text-xs font-semibold text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>সংশোধন</span>
                  </button>
                  {confirmDeleteFounderId === entry.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteFounder(entry.id)}
                        className="px-2.5 py-1 rounded-lg bg-red-700 text-white text-xs font-bold cursor-pointer"
                      >
                        নিশ্চিত মুছুন
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteFounderId(null)}
                        className="px-2 py-1 rounded-lg bg-stone-200 text-stone-700 text-xs cursor-pointer"
                      >
                        না
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteFounderId(entry.id)}
                      className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>মুছুন</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-stone-500 bg-stone-50 rounded-xl border border-dashed border-stone-300">
            এই ক্যাটাগরিতে এখনো কোনো নাম যুক্ত করা হয়নি।
          </div>
        )}
      </div>

      {/* Add / Edit Position Modal */}
      {showAddPositionModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <h3 className="text-base font-bold text-stone-900 mb-4">
              {editingPosition ? 'কমিটির পদবি ও ছবি সংশোধন' : 'কমিটিতে নতুন পদবি ও সদস্য যুক্ত করুন'}
            </h3>
            <form onSubmit={handlePositionSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">পদবির নাম *</label>
                <input
                  type="text"
                  required
                  placeholder="উদা: প্রচার সম্পাদক / উপ-কোষাধ্যক্ষ"
                  value={posTitle}
                  onChange={(e) => setPosTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">দায়িত্বপ্রাপ্তের নাম *</label>
                <input
                  type="text"
                  required
                  placeholder="উদা: মো. তারিকুল ইসলাম"
                  value={posMemberName}
                  onChange={(e) => setPosMemberName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">ছবির URL (ঐচ্ছিক)</label>
                <div className="flex items-center gap-3">
                  <PersonAvatar
                    photoUrl={posPhotoUrl}
                    name={posMemberName || 'প্রিভিউ'}
                    sizeClass="w-11 h-11"
                    roundedClass="rounded-full"
                    bgClass="bg-emerald-50"
                    iconClass="text-emerald-800/75"
                    borderClass="border border-stone-300"
                  />
                  <input
                    type="url"
                    placeholder="https://... (খালি রাখলে ডিফল্ট মানুষের অবয়ব দেখাবে)"
                    value={posPhotoUrl}
                    onChange={(e) => setPosPhotoUrl(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-stone-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">ফোন নম্বর</label>
                <input
                  type="tel"
                  placeholder="০১৭১১..."
                  value={posPhone}
                  onChange={(e) => setPosPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">ক্রম নম্বর (Priority)</label>
                <input
                  type="number"
                  min="1"
                  value={posPriority}
                  onChange={(e) => setPosPriority(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="posPublish"
                  checked={posIsPublished}
                  onChange={(e) => setPosIsPublished(e.target.checked)}
                  className="rounded text-emerald-800"
                />
                <label htmlFor="posPublish" className="text-xs text-stone-700 cursor-pointer">
                  পাবলিক ওয়েবসাইটে নাম, পদবি ও ছবি প্রকাশ করুন
                </label>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPositionModal(false);
                    setEditingPosition(null);
                  }}
                  className="px-3 py-1.5 text-xs text-stone-600 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  {editingPosition ? 'সংশোধন সংরক্ষণ করুন' : 'পদবি সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Term Modal */}
      {showAddTermModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <h3 className="text-base font-bold text-stone-900 mb-4">নতুন কমিটি বা পরিষদ তৈরি করুন</h3>
            <form onSubmit={handleAddTermSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">কমিটির শিরোনাম *</label>
                <input
                  type="text"
                  required
                  placeholder="উদা: কার্যকরী পরিষদ (২০২৭-২০২৯)"
                  value={termTitle}
                  onChange={(e) => setTermTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">উইং / শাখা</label>
                <select
                  value={!store.settings.enableStudentWing && termWing === 'student_wing' ? 'central' : termWing}
                  onChange={(e) => setTermWing(e.target.value as 'central' | 'student_wing' | 'advisory')}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
                >
                  <option value="central">মূল কার্যকরী পরিষদ ({store.settings.organizationNameBn})</option>
                  {store.settings.enableStudentWing && (
                    <option value="student_wing">{store.settings.studentWingNameBn || 'ছাত্র কল্যাণ সমিতি'}</option>
                  )}
                  <option value="advisory">উপদেষ্টা পরিষদ</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">শুরুর সাল</label>
                  <input
                    type="number"
                    value={termStartYear}
                    onChange={(e) => setTermStartYear(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">শেষের সাল</label>
                  <input
                    type="number"
                    value={termEndYear}
                    onChange={(e) => setTermEndYear(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="termCurrent"
                  checked={termIsCurrent}
                  onChange={(e) => setTermIsCurrent(e.target.checked)}
                  className="rounded text-emerald-800"
                />
                <label htmlFor="termCurrent" className="text-xs text-stone-700 cursor-pointer">
                  এটিকে বর্তমান সক্রিয় পরিষদ হিসেবে নির্ধারণ করুন (পূর্বেরটি স্বয়ংক্রিয়ভাবে আর্কাইভে সংরক্ষিত থাকবে)
                </label>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTermModal(false)}
                  className="px-3 py-1.5 text-xs text-stone-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 text-white rounded-lg text-xs font-bold"
                >
                  কমিটি তৈরি করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Founder or Founding Member Modal */}
      {showFounderModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <h3 className="text-base font-bold text-stone-900 mb-4">
              {editingFounder ? 'প্রতিষ্ঠাতা / সদস্যের তথ্য সংশোধন' : 'নতুন প্রতিষ্ঠাতা / প্রতিষ্ঠাতা সদস্য যুক্ত করুন'}
            </h3>
            <form onSubmit={handleFounderSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">তালিকার ধরন *</label>
                <select
                  value={fCategory}
                  onChange={(e) => setFCategory(e.target.value as FounderCategory)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white font-semibold"
                >
                  <option value="founder">প্রতিষ্ঠাতাবৃন্দ (Founder)</option>
                  <option value="founding_member">প্রতিষ্ঠাতা সদস্যবৃন্দ (Founding Member)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">নাম (বাংলায়) *</label>
                <input
                  type="text"
                  required
                  placeholder="উদা: জনাব আতাউর রহমান প্রধান"
                  value={fNameBn}
                  onChange={(e) => setFNameBn(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">পরিচয় / পদবি (বাংলায়) *</label>
                <input
                  type="text"
                  required
                  placeholder="উদা: সাবেক এমডি, সোনালী ব্যাংক পিএলসি"
                  value={fDesignationBn}
                  onChange={(e) => setFDesignationBn(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Name (English)</label>
                  <input
                    type="text"
                    value={fNameEn}
                    onChange={(e) => setFNameEn(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">ক্রম (Priority)</label>
                  <input
                    type="number"
                    min={1}
                    value={fPriority}
                    onChange={(e) => setFPriority(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)</label>
                <textarea
                  rows={2}
                  value={fBioBn}
                  onChange={(e) => setFBioBn(e.target.value)}
                  placeholder="সংগঠনের সূচনায় ভূমিকা বা অবদান..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">ছবির URL (ঐচ্ছিক)</label>
                <div className="flex items-center gap-3">
                  <PersonAvatar
                    photoUrl={fPhotoUrl}
                    name={fNameBn || 'প্রিভিউ'}
                    sizeClass="w-10 h-10"
                    roundedClass="rounded-xl"
                    bgClass="bg-emerald-50"
                    iconClass="text-emerald-800/75"
                    borderClass="border border-stone-300"
                  />
                  <input
                    type="url"
                    value={fPhotoUrl}
                    onChange={(e) => setFPhotoUrl(e.target.value)}
                    placeholder="https://... (খালি রাখলে ডিফল্ট মানুষের অবয়ব দেখাবে)"
                    className="flex-1 px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="founderPublish"
                  checked={fIsPublished}
                  onChange={(e) => setFIsPublished(e.target.checked)}
                  className="rounded text-emerald-800"
                />
                <label htmlFor="founderPublish" className="text-stone-700 cursor-pointer">
                  পাবলিক ওয়েবসাইটে প্রদর্শন করুন
                </label>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFounderModal(false)}
                  className="px-3 py-1.5 text-stone-600 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  {editingFounder ? 'সংশোধন সংরক্ষণ করুন' : 'যুক্ত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
