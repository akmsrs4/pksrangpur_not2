/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../db/store.ts';
import {
  Users,
  Search,
  CheckCircle,
  XCircle,
  Eye,
  Printer,
  CreditCard,
  Lock,
  FileDown,
  Phone,
  MapPin,
  UserPlus,
  Trash2,
  Edit3,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Member, MemberStatus } from '../../types.ts';
import { PersonAvatar } from '../PersonAvatar.tsx';

export const AdminMembersView: React.FC = () => {
  const store = useAppStore();
  const permissions = store.getEffectivePermissions();

  const canManageGeneral = store.canManageMemberType('general');
  const canManageStudent =
    store.canManageMemberType('student') &&
    (store.settings.enableStudentWing || store.currentRole === 'student_admin');
  const canManageBoth = canManageGeneral && canManageStudent;

  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'general' | 'student'>(
    canManageBoth ? 'all' : canManageGeneral ? 'general' : 'student'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showIdCardModal, setShowIdCardModal] = useState<Member | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Inline Serial edit & Delete confirm inside Detail Modal
  const [editingSerial, setEditingSerial] = useState('');
  const [confirmDeleteMemberId, setConfirmDeleteMemberId] = useState<string | null>(null);

  // Direct Admin Add Member Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'general' | 'student'>(canManageGeneral ? 'general' : 'student');
  const [addMembershipId, setAddMembershipId] = useState('');
  const [addFullNameBn, setAddFullNameBn] = useState('');
  const [addFullNameEn, setAddFullNameEn] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addBloodGroup, setAddBloodGroup] = useState('A+');
  const [addPatgramVillage, setAddPatgramVillage] = useState('');
  const [addPatgramUnion, setAddPatgramUnion] = useState('পাটগ্রাম সদর');
  const [addPatgramWard, setAddPatgramWard] = useState('');
  const [addRangpurArea, setAddRangpurArea] = useState('');
  const [addRangpurThana, setAddRangpurThana] = useState('কোতোয়ালী');
  const [addProfession, setAddProfession] = useState('');
  const [addInstitution, setAddInstitution] = useState('');
  const [addDepartment, setAddDepartment] = useState('');
  const [addAcademicYear, setAddAcademicYear] = useState('');
  const [addStatus, setAddStatus] = useState<MemberStatus>('active');

  useEffect(() => {
    if (!canManageBoth) {
      if (canManageGeneral && (activeFilter === 'all' || activeFilter === 'student')) {
        setActiveFilter('general');
      } else if (canManageStudent && (activeFilter === 'all' || activeFilter === 'general')) {
        setActiveFilter('student');
      }
    }
  }, [canManageBoth, canManageGeneral, canManageStudent, activeFilter]);

  if (!canManageGeneral && !canManageStudent) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
        <Lock className="w-12 h-12 text-stone-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-stone-900">সদস্য প্রশাসন সুরক্ষিত</h3>
        <p className="text-xs text-stone-500">আপনার বর্তমান রোলের জন্য সদস্য ব্যবস্থাপনার অনুমতি নেই।</p>
      </div>
    );
  }

  const permittedMembers = store.members.filter((m) =>
    store.canManageMemberType(m.type === 'student' ? 'student' : 'general')
  );
  const visibleMembers = permittedMembers.filter((m) => m.status !== 'rejected');

  const filteredMembers = visibleMembers.filter((m) => {
    const matchesFilter =
      activeFilter === 'all'
        ? true
        : activeFilter === 'pending'
          ? m.status === 'pending'
          : m.type === activeFilter;

    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      m.fullNameBn.toLowerCase().includes(q) ||
      m.fullNameEn.toLowerCase().includes(q) ||
      m.membershipId.toLowerCase().includes(q) ||
      m.phone.includes(searchQuery.trim()) ||
      m.patgramAddress.village.toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  const filterLabel =
    activeFilter === 'all'
      ? 'সকল সদস্য'
      : activeFilter === 'pending'
        ? 'পেন্ডিং আবেদন'
        : activeFilter === 'general'
          ? 'সাধারণ সদস্য'
          : 'ছাত্র সদস্য';

  const handleDownloadMembersPDF = () => {
    window.print();
  };

  const handleExportMembersCSV = () => {
    const headers = [
      'Membership ID',
      'Type',
      'Name (BN)',
      'Name (EN)',
      'Phone',
      'Email',
      'Blood Group',
      'Patgram Address',
      'Rangpur Address',
      'Profession/Institution',
      'Status',
      'Joined Date',
    ];

    const escapeCsv = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;

    const rows = filteredMembers.map((m) => [
      escapeCsv(m.membershipId),
      escapeCsv(m.type === 'student' ? 'ছাত্র সদস্য' : 'সাধারণ সদস্য'),
      escapeCsv(m.fullNameBn),
      escapeCsv(m.fullNameEn),
      escapeCsv(m.phone),
      escapeCsv(m.email || ''),
      escapeCsv(m.bloodGroup || ''),
      escapeCsv(`${m.patgramAddress.village}, ${m.patgramAddress.union}`),
      escapeCsv(`${m.rangpurAddress.area}, ${m.rangpurAddress.thana}`),
      escapeCsv(m.type === 'student' ? `${m.institution || ''} (${m.department || ''})` : m.professionOrDesignation || ''),
      escapeCsv(m.status),
      escapeCsv(m.joinedDate),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `patgram_members_${activeFilter}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openAddModalForType = (targetType: 'general' | 'student') => {
    setFeedback(null);
    setAddType(targetType);
    setAddMembershipId('');
    setAddFullNameBn('');
    setAddFullNameEn('');
    setAddPhone('');
    setAddEmail('');
    setAddProfession('');
    setAddInstitution('');
    setAddDepartment('');
    setAddAcademicYear('');
    setAddStatus('active');
    setShowAddModal(true);
  };

  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = store.addMemberByAdmin({
      type: addType,
      membershipId: addMembershipId.trim() || undefined,
      status: addStatus,
      fullNameBn: addFullNameBn,
      fullNameEn: addFullNameEn,
      phone: addPhone,
      email: addEmail,
      bloodGroup: addBloodGroup,
      patgramAddress: {
        village: addPatgramVillage,
        union: addPatgramUnion,
        ward: addPatgramWard,
      },
      rangpurAddress: {
        area: addRangpurArea,
        thana: addRangpurThana,
      },
      professionOrDesignation: addType === 'general' ? addProfession : undefined,
      institution: addType === 'student' ? addInstitution : undefined,
      department: addType === 'student' ? addDepartment : undefined,
      academicYear: addType === 'student' ? addAcademicYear : undefined,
    });
    if (res.success) {
      setShowAddModal(false);
      setFeedback({
        type: 'success',
        text: `নতুন ${addType === 'student' ? 'ছাত্র' : 'সাধারণ'} সদস্য সফলভাবে যুক্ত হয়েছে! সিরিয়াল নম্বর: ${res.membershipId}`,
      });
    } else {
      setFeedback({ type: 'error', text: res.error || 'সদস্য যুক্ত করতে ত্রুটি হয়েছে।' });
    }
  };

  const handleSaveSerial = () => {
    if (!selectedMember) return;
    const res = store.updateMemberSerial(selectedMember.id, editingSerial);
    if (res.success) {
      setSelectedMember({ ...selectedMember, membershipId: editingSerial.trim() });
      setFeedback({ type: 'success', text: `সদস্য সিরিয়াল নম্বর "${editingSerial.trim()}" হালনাগাদ হয়েছে।` });
    } else {
      setFeedback({ type: 'error', text: res.error || 'সিরিয়াল নম্বর আপডেট করা যায়নি।' });
    }
  };

  const handleDeleteMember = (memberId: string) => {
    const res = store.deleteMember(memberId);
    setConfirmDeleteMemberId(null);
    if (res.success) {
      setSelectedMember(null);
      setFeedback({ type: 'success', text: 'সদস্যের রেকর্ড তালিকা থেকে স্থায়ীভাবে মুছে ফেলা হয়েছে।' });
    } else {
      setFeedback({ type: 'error', text: res.error || 'সদস্য মুছে ফেলা যায়নি।' });
    }
  };

  const handleApproveMember = (member: Member) => {
    setFeedback(null);
    const res = store.updateMemberStatus(member.id, 'active');
    if (res.success) {
      setFeedback({
        type: 'success',
        text: `${member.fullNameBn}-এর আবেদন অনুমোদিত হয়েছে! নতুন সদস্য সিরিয়াল: ${res.membershipId || member.membershipId}`,
      });
    } else {
      setFeedback({ type: 'error', text: res.error || 'আবেদন অনুমোদন করা যায়নি।' });
    }
  };

  const handleRejectMember = (member: Member) => {
    setFeedback(null);
    const res = store.updateMemberStatus(member.id, 'rejected');
    if (res.success) {
      if (selectedMember?.id === member.id) {
        setSelectedMember(null);
      }
      setFeedback({
        type: 'success',
        text: `${member.fullNameBn}-এর আবেদনটি বাতিল/প্রত্যাখ্যান করা হয়েছে এবং পেন্ডিং তালিকা থেকে সরানো হয়েছে।`,
      });
    } else {
      setFeedback({ type: 'error', text: res.error || 'আবেদন বাতিল করা যায়নি।' });
    }
  };

  const handleToggleMemberStatus = (member: Member) => {
    setFeedback(null);
    const nextStatus: MemberStatus = member.status === 'active' ? 'inactive' : 'active';
    const res = store.updateMemberStatus(member.id, nextStatus);
    if (res.success) {
      setFeedback({
        type: 'success',
        text: `${member.fullNameBn} (${res.membershipId || member.membershipId}) এখন "${nextStatus === 'active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}" অবস্থায় রয়েছেন।`,
      });
    } else {
      setFeedback({ type: 'error', text: res.error || 'সদস্যের অবস্থা পরিবর্তন করা যায়নি।' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Official Print-Only Report Header (Appears when saving directory as PDF) */}
      {!showIdCardModal && !selectedMember && (
        <div className="print-only border-b-2 border-stone-800 pb-4 mb-4 text-center">
          <h1 className="text-xl font-bold text-stone-900">{store.settings.organizationNameBn}</h1>
          <p className="text-xs text-stone-600">{store.settings.officeAddress}</p>
          <div className="mt-2 text-xs font-bold text-stone-800">
            সদস্য তালিকা প্রতিবেদন ({filterLabel}) — মোট: {filteredMembers.length} জন | তারিখ:{' '}
            {new Date().toISOString().substring(0, 10)}
          </div>
        </div>
      )}

      {/* Top Banner */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-700" />
            <span>সদস্যপদ ব্যবস্থাপনা ও আবেদনপত্র প্রশাসন</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            সাধারণ ও ছাত্র সদস্যদের নাম, মোবাইল নম্বর, ঠিকানা যাচাই এবং তালিকা PDF / CSV আকারে ডাউনলোড করুন।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold">
            মোট সদস্য: {visibleMembers.length} জন
          </span>
          {canManageGeneral && (
            <button
              type="button"
              onClick={() => openAddModalForType('general')}
              className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UserPlus className="w-4 h-4 text-amber-300" />
              <span>+ নতুন সাধারণ সদস্য</span>
            </button>
          )}
          {canManageStudent && (
            <button
              type="button"
              onClick={() => openAddModalForType('student')}
              className="px-3.5 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UserPlus className="w-4 h-4 text-amber-300" />
              <span>+ নতুন ছাত্র সদস্য</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleDownloadMembersPDF}
            disabled={filteredMembers.length === 0 || Boolean(showIdCardModal)}
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="ব্রাউজারে Save as PDF নির্বাচন করে পিডিএফ সেভ করুন"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>সদস্য তালিকা PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExportMembersCSV}
            disabled={filteredMembers.length === 0}
            className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 border border-stone-300 font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-emerald-700" />
            <span>CSV এক্সেল</span>
          </button>
        </div>
      </div>

      {/* Inline Feedback Banner */}
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
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
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

      {/* Filter and Search */}
      <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-stone-200">
        <div className="flex flex-wrap items-center gap-1">
          {canManageBoth && (
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                activeFilter === 'all' ? 'bg-emerald-800 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              সকল সদস্য ({visibleMembers.length})
            </button>
          )}
          <button
            onClick={() => setActiveFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              activeFilter === 'pending'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            পেন্ডিং আবেদন ({visibleMembers.filter((m) => m.status === 'pending').length})
          </button>
          {canManageGeneral && (
            <button
              onClick={() => setActiveFilter('general')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                activeFilter === 'general' ? 'bg-emerald-800 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              সাধারণ সদস্য ({visibleMembers.filter((m) => m.type === 'general').length})
            </button>
          )}
          {canManageStudent && (
            <button
              onClick={() => setActiveFilter('student')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                activeFilter === 'student' ? 'bg-emerald-800 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              ছাত্র সদস্য ({visibleMembers.filter((m) => m.type === 'student').length})
            </button>
          )}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="নাম, আইডি বা ফোন দিয়ে খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-emerald-600"
          />
        </div>
      </div>

      {/* Members Table (Hide when modal is open during print so only the modal or the table prints cleanly) */}
      <div className={`${showIdCardModal || selectedMember ? 'no-print' : ''} bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-3 px-4">আইডি ও ধরন</th>
                <th className="py-3 px-4">নাম ও রক্তের গ্রুপ</th>
                <th className="py-3 px-4">মোবাইল ও ইমেইল</th>
                <th className="py-3 px-4">পাটগ্রাম ও রংপুরের ঠিকানা</th>
                <th className="py-3 px-4">পেশা / শিক্ষা প্রতিষ্ঠান</th>
                <th className="py-3 px-4 text-center">অবস্থা</th>
                <th className="py-3 px-4 text-center no-print">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center text-stone-500">
                    কোনো সদস্যের তথ্য পাওয়া যায়নি। পাবলিক ওয়েবসাইটের “অনলাইনে সদস্যপদ আবেদন” ফরম থেকে আবেদন জমা হলে তা এখানে দেখাবে।
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-stone-900">{member.membershipId}</div>
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                          member.type === 'student'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {member.type === 'student' ? 'ছাত্র সদস্য' : 'সাধারণ সদস্য'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-stone-900">{member.fullNameBn}</div>
                      <div className="text-[11px] text-stone-400 font-sans">{member.fullNameEn}</div>
                      {member.bloodGroup && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-red-50 text-red-700 text-[10px] font-bold rounded">
                          {member.bloodGroup}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-stone-900">{member.phone}</div>
                      <div className="text-[11px] text-stone-400">{member.email || '—'}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="text-stone-800">
                        <strong>পাটগ্রাম:</strong> {member.patgramAddress.village}, {member.patgramAddress.union}
                      </div>
                      <div className="text-stone-500 text-[11px]">
                        <strong>রংপুর:</strong> {member.rangpurAddress.area}, {member.rangpurAddress.thana}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {member.type === 'student' ? (
                        <div>
                          <div className="font-medium text-stone-900">{member.institution}</div>
                          <div className="text-[11px] text-stone-400">
                            {member.department} · {member.academicYear}
                          </div>
                        </div>
                      ) : (
                        <div className="text-stone-700">{member.professionOrDesignation || 'ব্যক্তিগত'}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          member.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : member.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {member.status === 'active'
                          ? 'সক্রিয়'
                          : member.status === 'pending'
                            ? 'পেন্ডিং'
                            : member.status === 'rejected'
                              ? 'বাতিল'
                              : 'নিষ্ক্রিয়'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center no-print">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedMember(member);
                            setEditingSerial(member.membershipId);
                            setConfirmDeleteMemberId(null);
                          }}
                          title="বিস্তারিত তথ্য, সিরিয়াল সংশোধন / PDF"
                          className="p-1 text-stone-600 hover:bg-stone-100 rounded cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {member.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApproveMember(member)}
                              title="অনুমোদন করুন"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>অনুমোদন</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectMember(member)}
                              title="বাতিল / প্রত্যাখ্যান করুন"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>বাতিল</span>
                            </button>
                          </>
                        ) : (member.status === 'active' || member.status === 'inactive') ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setShowIdCardModal(member)}
                              title="ডিজিটাল আইডি কার্ড / PDF"
                              className="p-1 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleMemberStatus(member)}
                              title={member.status === 'active' ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                              className="text-[10px] px-2 py-0.5 rounded border border-stone-200 hover:bg-stone-100 cursor-pointer"
                            >
                              {member.status === 'active' ? 'নিষ্ক্রিয়' : 'সক্রিয়'}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Member Detail Profile & PDF Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative border border-stone-200 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1 text-lg font-bold no-print cursor-pointer"
            >
              ×
            </button>

            <div className="border-b border-stone-200 pb-3 mb-4 space-y-2">
              <div className="text-[11px] font-bold text-emerald-700">{store.settings.organizationNameBn}</div>
              <h3 className="text-lg font-bold text-stone-900">সদস্যের পূর্ণাঙ্গ তথ্য ফরম</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-stone-600">
                <span>সদস্য আইডি (সিরিয়াল):</span>
                <input
                  type="text"
                  value={editingSerial}
                  onChange={(e) => setEditingSerial(e.target.value)}
                  className="no-print px-2 py-1 border border-stone-300 rounded-md font-mono font-bold text-stone-900 bg-stone-50 w-40"
                />
                <span className="print-only font-bold text-stone-900">{selectedMember.membershipId}</span>
                {editingSerial.trim() !== selectedMember.membershipId && (
                  <button
                    type="button"
                    onClick={handleSaveSerial}
                    className="no-print inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-800 hover:bg-emerald-700 text-white text-[11px] font-sans font-bold cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>সিরিয়াল সংরক্ষণ</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200">
                <div>
                  <span className="text-stone-500 block">নাম (বাংলা):</span>
                  <span className="font-bold text-stone-900">{selectedMember.fullNameBn}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">নাম (ইংরেজি):</span>
                  <span className="font-semibold text-stone-800">{selectedMember.fullNameEn}</span>
                </div>
                <div>
                  <span className="text-stone-500 block flex items-center gap-1">
                    <Phone className="w-3 h-3" /> মোবাইল নম্বর:
                  </span>
                  <span className="font-mono font-bold text-stone-900">{selectedMember.phone}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">রক্তের গ্রুপ:</span>
                  <span className="font-bold text-red-700">{selectedMember.bloodGroup || '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-stone-500 block">ইমেইল:</span>
                  <span className="text-stone-800">{selectedMember.email || 'প্রদান করা হয়নি'}</span>
                </div>
              </div>

              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-stone-800">পাটগ্রামের স্থায়ী ঠিকানা: </span>
                    <span className="text-stone-700">
                      {selectedMember.patgramAddress.village}, {selectedMember.patgramAddress.union}
                      {selectedMember.patgramAddress.ward ? `, ওয়ার্ড-${selectedMember.patgramAddress.ward}` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-stone-800">রংপুরের বর্তমান ঠিকানা: </span>
                    <span className="text-stone-700">
                      {selectedMember.rangpurAddress.area}, {selectedMember.rangpurAddress.thana}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                {selectedMember.type === 'student' ? (
                  <div>
                    <span className="font-bold text-stone-800">শিক্ষা প্রতিষ্ঠান ও বিভাগ: </span>
                    <span>
                      {selectedMember.institution} ({selectedMember.department}, {selectedMember.academicYear})
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="font-bold text-stone-800">পেশা / পদবি: </span>
                    <span>{selectedMember.professionOrDesignation || 'উল্লেখ নেই'}</span>
                  </div>
                )}
                <div className="text-[11px] text-stone-500 mt-1">আবেদনের তারিখ: {selectedMember.joinedDate}</div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 no-print pt-3 border-t border-stone-100">
              {confirmDeleteMemberId === selectedMember.id ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteMember(selectedMember.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold cursor-pointer"
                  >
                    হ্যাঁ, সদস্য মুছে ফেলুন
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteMemberId(null)}
                    className="px-3 py-1.5 rounded-lg bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
                  >
                    বাতিল
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteMemberId(selectedMember.id)}
                  className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>সদস্য মুছুন</span>
                </button>
              )}

              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>PDF সেভ / প্রিন্ট করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Digital ID Card Preview / Print Modal */}
      {showIdCardModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <button
              onClick={() => setShowIdCardModal(null)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1 no-print cursor-pointer"
            >
              ×
            </button>

            {/* ID Card Box */}
            <div className="rounded-2xl border-2 border-emerald-900 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 text-white p-6 shadow-xl relative overflow-hidden">
              <div className="text-center pb-3 border-b border-emerald-800/80 mb-4">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  {store.settings.organizationNameBn}
                </div>
                <div className="text-[10px] text-emerald-200">
                  {showIdCardModal.type === 'student'
                    ? store.settings.studentWingNameBn || 'পাটগ্রাম ছাত্র কল্যাণ সমিতি, রংপুর'
                    : 'ডিজিটাল সদস্য পরিচয়পত্র'}
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <PersonAvatar
                  photoUrl={showIdCardModal.photoUrl}
                  name={showIdCardModal.fullNameBn}
                  sizeClass="w-16 h-16"
                  roundedClass="rounded-xl"
                  bgClass="bg-white"
                  iconClass="text-emerald-900/80"
                  borderClass="border border-amber-400"
                  className="shadow"
                />
                <div>
                  <h4 className="text-base font-bold text-white">{showIdCardModal.fullNameBn}</h4>
                  <div className="text-xs text-emerald-200">{showIdCardModal.fullNameEn}</div>
                  <div className="text-xs font-mono font-bold text-amber-300 mt-1">
                    আইডি: {showIdCardModal.membershipId}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-100 bg-emerald-900/60 p-3 rounded-xl border border-emerald-800 mb-4">
                <div>
                  <span className="text-emerald-400 block">রক্তের গ্রুপ:</span>
                  <span className="font-bold text-white">{showIdCardModal.bloodGroup}</span>
                </div>
                <div>
                  <span className="text-emerald-400 block">মোবাইল:</span>
                  <span className="font-mono text-white">{showIdCardModal.phone}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-emerald-400 block">স্থায়ী ঠিকানা (পাটগ্রাম):</span>
                  <span className="text-white">
                    {showIdCardModal.patgramAddress.village}, {showIdCardModal.patgramAddress.union}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-emerald-300 pt-2 border-t border-emerald-800">
                <span>যোগদান: {showIdCardModal.joinedDate}</span>
                <span className="font-bold text-amber-400">অনুমোদিত ও যাচাইকৃত</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 no-print">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>আইডি কার্ড PDF / প্রিন্ট করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Direct Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="flex items-start justify-between pb-3 border-b border-stone-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-700" />
                  <span>নতুন {addType === 'student' ? 'ছাত্র সদস্য' : 'সাধারণ সদস্য'} সরাসরি যুক্ত করুন</span>
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  ঐচ্ছিক সিরিয়াল নম্বর ফাঁকা রাখলে স্বয়ংক্রিয়ভাবে পরবর্তী ক্রমিক নম্বর বরাদ্দ হবে।
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">সিরিয়াল / সদস্য আইডি (ঐচ্ছিক)</label>
                  <input
                    type="text"
                    placeholder={addType === 'student' ? 'PKS-STU-2026-001' : 'PKS-GEN-2026-001'}
                    value={addMembershipId}
                    onChange={(e) => setAddMembershipId(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">প্রাথমিক অবস্থা</label>
                  <select
                    value={addStatus}
                    onChange={(e) => setAddStatus(e.target.value as MemberStatus)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="active">সরাসরি সক্রিয় (Active)</option>
                    <option value="pending">পেন্ডিং (Pending)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">পূর্ণ নাম (বাংলা) *</label>
                  <input
                    type="text"
                    required
                    value={addFullNameBn}
                    onChange={(e) => setAddFullNameBn(e.target.value)}
                    placeholder="উদা: মো. রফিকুল ইসলাম"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Full Name (English)</label>
                  <input
                    type="text"
                    value={addFullNameEn}
                    onChange={(e) => setAddFullNameEn(e.target.value)}
                    placeholder="e.g. Md. Rofiqul Islam"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">মোবাইল নম্বর *</label>
                  <input
                    type="tel"
                    required
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="017..."
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">ইমেইল</label>
                  <input
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">রক্তের গ্রুপ</label>
                  <select
                    value={addBloodGroup}
                    onChange={(e) => setAddBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {addType === 'general' ? (
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">পেশা ও পদবি</label>
                  <input
                    type="text"
                    value={addProfession}
                    onChange={(e) => setAddProfession(e.target.value)}
                    placeholder="উদা: শিক্ষক / ব্যবসায়ী"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-200">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">শিক্ষা প্রতিষ্ঠান *</label>
                    <input
                      type="text"
                      required
                      value={addInstitution}
                      onChange={(e) => setAddInstitution(e.target.value)}
                      placeholder="বেরোবি / কারমাইকেল"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">বিভাগ / বিষয়</label>
                    <input
                      type="text"
                      value={addDepartment}
                      onChange={(e) => setAddDepartment(e.target.value)}
                      placeholder="বাংলা / সিএসই"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">বর্ষ / সেমিস্টার</label>
                    <input
                      type="text"
                      value={addAcademicYear}
                      onChange={(e) => setAddAcademicYear(e.target.value)}
                      placeholder="৩য় বর্ষ"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">পাটগ্রাম (গ্রাম) *</label>
                  <input
                    type="text"
                    required
                    value={addPatgramVillage}
                    onChange={(e) => setAddPatgramVillage(e.target.value)}
                    placeholder="গ্রামের নাম"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">ইউনিয়ন / পৌরসভা</label>
                  <input
                    type="text"
                    value={addPatgramUnion}
                    onChange={(e) => setAddPatgramUnion(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">ওয়ার্ড</label>
                  <input
                    type="text"
                    value={addPatgramWard}
                    onChange={(e) => setAddPatgramWard(e.target.value)}
                    placeholder="ঐচ্ছিক"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">রংপুরের এলাকা / মহল্লা *</label>
                  <input
                    type="text"
                    required
                    value={addRangpurArea}
                    onChange={(e) => setAddRangpurArea(e.target.value)}
                    placeholder="উদা: ধাপ / লালবাগ"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">থানা</label>
                  <input
                    type="text"
                    value={addRangpurThana}
                    onChange={(e) => setAddRangpurThana(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg font-semibold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  সদস্য সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
