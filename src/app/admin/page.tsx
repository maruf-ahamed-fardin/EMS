'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import seloraxLogo from '@/assets/SeloraX logo.png';
import seloraxLogoDark from '@/assets/SeloraX-logo-dark.png';
import { ThemeToggle } from '@/components/ThemeProvider';
import {
  ShieldCheck,
  Lock,
  LogOut,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  Upload,
  X,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Mail,
  Phone,
  MessageCircle,
  Sparkles,
  ArrowLeft,
  BadgeCheck,
} from 'lucide-react';
import type { Department, PublicUser, ProfileData, Socials } from '@/lib/team';

interface FullAdminMember {
  user: PublicUser;
  profilePic?: string | null;
  profileData?: ProfileData | null;
}

const DEPARTMENTS: (Department | 'All')[] = [
  'All',
  'Engineering',
  'Design',
  'Operations',
  'Executive',
];

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Members state
  const [members, setMembers] = useState<FullAdminMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDept, setActiveDept] = useState<Department | 'All'>('All');

  // Modal state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    username: string;
    employeeId: string;
    designation: string;
    role: string;
    department: Department | string;
    skills: string[];
    skillInput: string;
    verified: boolean;
    available: boolean;
    statusText: string;
    calendlyUrl: string;
    // Contact
    email: string;
    personalPhone: string;
    businessPhone: string;
    whatsapp: string;
    location: string;
    // Socials
    github: string;
    linkedin: string;
    portfolio: string;
    facebook: string;
    twitter: string;
    // Picture
    profilePic: string;
  }>({
    name: '',
    username: '',
    employeeId: '',
    designation: '',
    role: '',
    department: 'Engineering',
    skills: [],
    skillInput: '',
    verified: true,
    available: true,
    statusText: 'Available',
    calendlyUrl: '',
    email: '',
    personalPhone: '',
    businessPhone: '',
    whatsapp: '',
    location: 'Dhaka, Bangladesh',
    github: '',
    linkedin: '',
    portfolio: '',
    facebook: '',
    twitter: '',
    profilePic: '',
  });

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check auth status on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/auth');
        const data = await res.json();
        setIsAuthenticated(data.authenticated);
        if (data.authenticated) {
          loadMembers();
        }
      } catch {
        setIsAuthenticated(false);
      }
    }
    checkAuth();
  }, []);

  async function loadMembers() {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/admin/members?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsAuthenticated(true);
        setPasswordInput('');
        loadMembers();
      } else {
        setAuthError(data.error || 'Invalid admin password');
      }
    } catch {
      setAuthError('Connection error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
    } finally {
      setIsAuthenticated(false);
    }
  }

  // Auto-slugify name into username if creating new member
  function handleNameChange(name: string) {
    setFormData((prev) => {
      const updates: typeof prev = { ...prev, name };
      if (modalMode === 'create' && !prev.username) {
        updates.username = name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 20);
      }
      return updates;
    });
  }

  // Handle image upload and compression to base64 WebP
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new (window as unknown as { Image: new () => HTMLImageElement }).Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 256;
        let w = img.width;
        let h = img.height;

        if (w > h) {
          if (w > maxSize) {
            h = Math.round((h * maxSize) / w);
            w = maxSize;
          }
        } else {
          if (h > maxSize) {
            w = Math.round((w * maxSize) / h);
            h = maxSize;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL('image/webp', 0.85);
        setFormData((prev) => ({ ...prev, profilePic: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function openCreateModal() {
    const nextNum = members.length + 1;
    const suggestedId = `SX-${String(nextNum).padStart(3, '0')}`;

    setFormData({
      name: '',
      username: '',
      employeeId: suggestedId,
      designation: '',
      role: 'Engineer',
      department: 'Engineering',
      skills: [],
      skillInput: '',
      verified: true,
      available: true,
      statusText: 'Available',
      calendlyUrl: '',
      email: '',
      personalPhone: '',
      businessPhone: '',
      whatsapp: '',
      location: 'Dhaka, Bangladesh',
      github: '',
      linkedin: '',
      portfolio: '',
      facebook: '',
      twitter: '',
      profilePic: '',
    });
    setFormError('');
    setEditingUsername(null);
    setModalMode('create');
  }

  function openEditModal(m: FullAdminMember) {
    const u = m.user;
    const p = m.profileData;
    const s = p?.socials;

    setFormData({
      name: u.name || '',
      username: u.username || '',
      employeeId: u.employeeId || '',
      designation: u.designation || '',
      role: u.role || '',
      department: u.department || 'Engineering',
      skills: u.skills || [],
      skillInput: '',
      verified: u.verified ?? true,
      available: u.status?.available ?? true,
      statusText: u.status?.text || 'Available',
      calendlyUrl: u.calendlyUrl || p?.calendlyUrl || '',
      email: p?.email || '',
      personalPhone: p?.personalPhone || p?.phone || '',
      businessPhone: p?.businessPhone || '',
      whatsapp: p?.whatsapp || '',
      location: p?.location || 'Dhaka, Bangladesh',
      github: s?.github || '',
      linkedin: s?.linkedin || '',
      portfolio: s?.portfolio || '',
      facebook: s?.facebook || '',
      twitter: s?.twitter || '',
      profilePic: m.profilePic || '',
    });
    setFormError('');
    setEditingUsername(u.username || null);
    setModalMode('edit');
  }

  function addSkill() {
    const raw = formData.skillInput.trim();
    if (!raw) return;
    if (!formData.skills.includes(raw)) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, raw],
        skillInput: '',
      }));
    } else {
      setFormData((prev) => ({ ...prev, skillInput: '' }));
    }
  }

  function removeSkill(skill: string) {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  }

  async function handleSaveMember(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    const username = formData.username.trim().toLowerCase();
    if (!formData.name.trim()) {
      setFormError('Full Name is required');
      setSaving(false);
      return;
    }
    if (!username) {
      setFormError('Username is required');
      setSaving(false);
      return;
    }

    const payload = {
      user: {
        name: formData.name.trim(),
        username,
        employeeId: formData.employeeId.trim(),
        designation: formData.designation.trim() || formData.role.trim(),
        role: formData.role.trim() || formData.designation.trim(),
        department: formData.department,
        skills: formData.skills,
        verified: formData.verified,
        status: {
          available: formData.available,
          text: formData.statusText.trim() || (formData.available ? 'Available' : 'Busy'),
        },
        calendlyUrl: formData.calendlyUrl.trim() || undefined,
      },
      profilePic: formData.profilePic || null,
      profileData: {
        email: formData.email.trim() || undefined,
        personalPhone: formData.personalPhone.trim() || undefined,
        businessPhone: formData.businessPhone.trim() || undefined,
        phone: formData.personalPhone.trim() || undefined,
        whatsapp: formData.whatsapp.trim() || undefined,
        location: formData.location.trim() || undefined,
        calendlyUrl: formData.calendlyUrl.trim() || undefined,
        socials: {
          github: formData.github.trim() || undefined,
          linkedin: formData.linkedin.trim() || undefined,
          portfolio: formData.portfolio.trim() || undefined,
          facebook: formData.facebook.trim() || undefined,
          twitter: formData.twitter.trim() || undefined,
        } as Socials,
      },
    };

    try {
      if (modalMode === 'create') {
        const res = await fetch('/api/admin/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create member');
      } else if (modalMode === 'edit' && editingUsername) {
        const res = await fetch(`/api/admin/members/${encodeURIComponent(editingUsername)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update member');
      }

      setModalMode(null);
      await loadMembers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMember(username: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/members/${encodeURIComponent(username)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDeleteConfirmUser(null);
        await loadMembers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete member');
      }
    } catch {
      alert('Delete request failed.');
    } finally {
      setDeleting(false);
    }
  }

  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return members.filter((m) => {
      const u = m.user;
      if (activeDept !== 'All' && u.department !== activeDept) return false;
      if (!q) return true;

      const name = (u.name || '').toLowerCase();
      const uname = (u.username || '').toLowerCase();
      const eid = (u.employeeId || '').toLowerCase();
      const des = (u.designation || u.role || '').toLowerCase();
      const skills = (u.skills || []).map((s) => s.toLowerCase());

      return (
        name.includes(q) ||
        uname.includes(q) ||
        eid.includes(q) ||
        des.includes(q) ||
        skills.some((s) => s.includes(q))
      );
    });
  }, [members, searchQuery, activeDept]);

  // Loading initial authentication state
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 dark:bg-[#090B0E] text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2.5 text-sm font-medium">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          Verifying authorization…
        </div>
      </div>
    );
  }

  // ── 1. LOGIN SCREEN ──
  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 dark:bg-[#090B0E] p-4 text-zinc-900 dark:text-white transition-colors">
        {/* Top-Right Floating Actions: Back Link & Theme Toggle */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-20">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs backdrop-blur-md transition-all hover:bg-slate-100 hover:text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Public Directory</span>
          </Link>
          <ThemeToggle />
        </div>

        {/* Central Login Card */}
        <div className="w-full max-w-sm sm:max-w-md rounded-3xl border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-white/10 dark:bg-[#12151D]/95 dark:shadow-2xl dark:shadow-black/80 transition-colors">
          {/* Logo & Header */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="relative mb-3 flex items-center justify-center rounded-2xl bg-white/90 dark:bg-zinc-900/80 px-3.5 py-1.5 border border-zinc-200/90 dark:border-zinc-800/90 shadow-2xs backdrop-blur-md">
              <Image
                src={seloraxLogo}
                alt="SeloraX Logo"
                height={26}
                width={104}
                priority
                className="h-6 w-auto object-contain block dark:hidden"
              />
              <Image
                src={seloraxLogoDark}
                alt="SeloraX Logo"
                height={26}
                width={104}
                priority
                className="h-6 w-auto object-contain hidden dark:block"
              />
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              Admin Console
            </h1>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Enter admin security password to manage team data.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Security Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter admin password"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 pr-10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-zinc-500 dark:focus:bg-white/10 dark:focus:border-orange-500 dark:focus:ring-orange-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-400 hover:to-amber-500 active:scale-98 disabled:opacity-50"
            >
              {authLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  Access Admin Console
                </>
              )}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 dark:border-white/5 pt-4 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition"
            >
              <ArrowLeft className="h-3 w-3" />
              Return to Public Directory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. ADMIN DASHBOARD SCREEN (Full Screen & Dual Themed) ──
  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#090B0E] text-zinc-900 dark:text-white transition-colors">
      {/* Top Navbar: Edge-to-Edge Full Screen Responsive Header */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#0E1118]/90 backdrop-blur-xl">
        <div className="w-full max-w-[1600px] mx-auto flex items-center justify-between px-3 sm:px-6 lg:px-8 py-3">
          {/* Logo & Admin Status */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link href="/" className="group flex items-center gap-2">
              <div className="relative flex items-center justify-center rounded-xl bg-white/90 dark:bg-zinc-900/80 px-2.5 py-1 border border-zinc-200/90 dark:border-zinc-800/90 shadow-2xs backdrop-blur-md transition-all group-hover:border-zinc-300 dark:group-hover:border-zinc-700">
                <Image
                  src={seloraxLogo}
                  alt="SeloraX Logo"
                  height={22}
                  width={88}
                  priority
                  className="h-5 sm:h-5.5 w-auto object-contain block dark:hidden"
                />
                <Image
                  src={seloraxLogoDark}
                  alt="SeloraX Logo"
                  height={22}
                  width={88}
                  priority
                  className="h-5 sm:h-5.5 w-auto object-contain hidden dark:block"
                />
              </div>
            </Link>

            <div className="flex items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-xs font-bold text-orange-600 dark:text-orange-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Admin Console</span>
            </div>

            <span className="hidden sm:inline-flex text-[11px] font-mono-numbers px-2 py-0.5 rounded-md bg-slate-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-400 border border-slate-200/70 dark:border-white/5">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </span>
          </div>

          {/* Actions: Directory Link, Add Member, Theme Toggle, Logout */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/80 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs backdrop-blur-md transition-all hover:bg-slate-100 hover:text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Directory</span>
            </Link>

            {/* Direct Theme Toggle for Admin */}
            <ThemeToggle />

            <button
              onClick={openCreateModal}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-orange-500/20 hover:from-orange-400 hover:to-amber-500 active:scale-95 transition"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Add Member</span>
            </button>

            <button
              onClick={handleLogout}
              title="Logout"
              className="cursor-pointer rounded-xl border border-slate-200/90 bg-white/80 p-2 text-zinc-500 hover:bg-rose-50 hover:text-rose-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-rose-500/15 dark:hover:text-rose-400 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body: Full-Bleed Edge-to-Edge Container */}
      <main className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6">
        {/* Controls Bar: Search & Department Tabs */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search Box */}
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members by name, SX-ID, designation, skills…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-xs text-zinc-900 placeholder-zinc-400 shadow-2xs transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-white/10 dark:bg-[#12151D] dark:text-white dark:placeholder-zinc-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Department Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {DEPARTMENTS.map((dept) => {
              const active = activeDept === dept;
              return (
                <button
                  key={dept}
                  onClick={() => setActiveDept(dept)}
                  className={`cursor-pointer whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
                      : 'border border-slate-200 bg-white text-zinc-600 hover:bg-slate-100 hover:text-zinc-900 dark:border-white/10 dark:bg-[#12151D] dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200'
                  }`}
                >
                  {dept}
                </button>
              );
            })}
          </div>
        </div>

        {/* Member Cards Grid */}
        {loadingMembers ? (
          <div className="flex h-64 items-center justify-center text-xs text-zinc-500 dark:text-zinc-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent mr-2" />
            Loading team members…
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 dark:border-white/10 bg-white/50 dark:bg-[#12151D]/50 p-12 text-center">
            <Sparkles className="h-8 w-8 text-zinc-400 dark:text-zinc-500 mb-2" />
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No members match your search</p>
            <p className="mt-1 text-xs text-zinc-500">Try searching for something else or add a new member.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4">
            {filteredMembers.map((m) => {
              const u = m.user;
              const p = m.profileData;
              const pic = m.profilePic;

              return (
                <div
                  key={u.username}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-sm transition-all hover:border-orange-500/40 hover:shadow-md dark:border-white/10 dark:bg-[#12151D] dark:shadow-md dark:hover:border-orange-500/40 dark:hover:shadow-orange-500/5"
                >
                  <div>
                    {/* Top Row: Avatar & Badges */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {pic ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={pic}
                            alt={u.name || ''}
                            className="h-11 w-11 shrink-0 rounded-2xl object-cover ring-2 ring-slate-100 dark:ring-white/10"
                          />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-amber-500 font-bold text-sm text-white shadow-sm">
                            {(u.name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                              {u.name}
                            </h3>
                            {u.verified && <BadgeCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                          </div>
                          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
                            {u.designation || u.role}
                          </p>
                        </div>
                      </div>

                      <span className="font-mono text-[10px] font-bold text-zinc-600 dark:text-zinc-300 bg-slate-100 dark:bg-black/40 px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/10 shrink-0">
                        {u.employeeId || 'SX-EMP'}
                      </span>
                    </div>

                    {/* Department & Status */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400">
                        {u.department}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          u.status?.available
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                            : 'bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-white/5'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            u.status?.available ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-zinc-400 dark:bg-zinc-500'
                          }`}
                        />
                        {u.status?.text || 'Available'}
                      </span>
                    </div>

                    {/* Skills Chips */}
                    {u.skills && u.skills.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {u.skills.slice(0, 4).map((skill) => (
                          <span
                            key={skill}
                            className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-zinc-700 border border-slate-200/80 dark:bg-black/40 dark:text-zinc-300 dark:border-white/5"
                          >
                            {skill}
                          </span>
                        ))}
                        {u.skills.length > 4 && (
                          <span className="text-[9px] font-medium text-zinc-400 self-center">
                            +{u.skills.length - 4} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Contact Info Pills */}
                    <div className="mt-3 flex items-center gap-2 text-zinc-400 text-xs">
                      {p?.email && <span title={p.email}><Mail className="h-3 w-3 text-orange-500" /></span>}
                      {p?.phone && <span title={p.phone}><Phone className="h-3 w-3 text-blue-500" /></span>}
                      {p?.whatsapp && <span title={p.whatsapp}><MessageCircle className="h-3 w-3 text-emerald-500" /></span>}
                      <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 ml-auto">
                        /@{u.username}
                      </span>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-3">
                    <Link
                      href={`/${encodeURIComponent(u.username || '')}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 hover:text-orange-600 dark:text-zinc-400 dark:hover:text-white transition"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Card
                    </Link>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditModal(m)}
                        className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-slate-100 hover:text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white transition"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </button>

                      <button
                        onClick={() => setDeleteConfirmUser(u.username || null)}
                        className="flex cursor-pointer items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 transition"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── 3. ADD / EDIT MEMBER MODAL ── */}
      {modalMode && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150"
        >
          <div className="w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-200/90 dark:border-white/15 bg-white dark:bg-[#12151D] shadow-2xl text-zinc-900 dark:text-white my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-5 sm:px-6 py-4 shrink-0 bg-slate-50/50 dark:bg-white/[0.02]">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
                  {modalMode === 'create' ? 'Add New Team Member' : `Edit Member: ${formData.name}`}
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Update personal details, skills, contact and profile photo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="cursor-pointer rounded-full p-1.5 text-zinc-400 hover:bg-slate-100 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveMember} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Photo Upload & Preview Row */}
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 p-4 flex items-center gap-4">
                {formData.profilePic ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={formData.profilePic}
                    alt="Preview"
                    className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-2 ring-orange-500/50"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-amber-500 font-bold text-lg text-white">
                    {(formData.name || '?').charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-zinc-900 dark:text-white">
                    Profile Picture
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2 truncate">
                    Upload image from device (auto-compressed to high-res WebP).
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-slate-100 hover:text-zinc-900 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 transition"
                    >
                      <Upload className="h-3.5 w-3.5 text-orange-500" />
                      Upload Photo
                    </button>
                    {formData.profilePic && (
                      <button
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, profilePic: '' }))}
                        className="cursor-pointer text-xs text-rose-600 hover:text-rose-500 dark:text-rose-400 dark:hover:text-rose-300 transition"
                      >
                        Remove
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Basic Fields: Name, Username, SX-ID */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                    placeholder="e.g. Ashek Rabbani"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder-zinc-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Username (Slug) *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    disabled={modalMode === 'edit'}
                    placeholder="e.g. ashekrabbani"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:bg-white focus:outline-none disabled:opacity-50 dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder-zinc-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    placeholder="e.g. SX-001"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder-zinc-500"
                  />
                </div>
              </div>

              {/* Designation & Department */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Lead Full Stack Engineer"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder-zinc-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Department
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-zinc-900 focus:border-orange-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#1A1E29] dark:text-white"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Design">Design</option>
                    <option value="Operations">Operations</option>
                    <option value="Executive">Executive</option>
                  </select>
                </div>
              </div>

              {/* Skills Tag Management */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Skills & Tech Stack (Press Enter to add)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={formData.skillInput}
                    onChange={(e) => setFormData({ ...formData, skillInput: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                    placeholder="e.g. Next.js, React, Docker…"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={addSkill}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 transition"
                  >
                    Add
                  </button>
                </div>

                {formData.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formData.skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 rounded-lg bg-orange-500/10 border border-orange-500/25 px-2 py-0.5 text-xs text-orange-700 dark:text-orange-300"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeSkill(skill)}
                          className="hover:text-rose-600 dark:hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact Fields */}
              <div className="border-t border-slate-200 dark:border-white/10 pt-3">
                <span className="mb-2 block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Contact Information
                </span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Official Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. ashekrabbani@selorax.io"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Direct Mobile Phone</label>
                    <input
                      type="text"
                      value={formData.personalPhone}
                      onChange={(e) => setFormData({ ...formData, personalPhone: e.target.value })}
                      placeholder="+8801700000000"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">WhatsApp Number</label>
                    <input
                      type="text"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      placeholder="+8801600000000"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Meeting Link (Cal.com / Calendly)</label>
                    <input
                      type="url"
                      value={formData.calendlyUrl}
                      onChange={(e) => setFormData({ ...formData, calendlyUrl: e.target.value })}
                      placeholder="https://cal.com/username"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder-zinc-500"
                    />
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="border-t border-slate-200 dark:border-white/10 pt-3">
                <span className="mb-2 block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Social Profiles
                </span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">GitHub Profile URL</label>
                    <input
                      type="url"
                      value={formData.github}
                      onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                      placeholder="https://github.com/username"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">LinkedIn Profile URL</label>
                    <input
                      type="url"
                      value={formData.linkedin}
                      onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                      placeholder="https://linkedin.com/in/username"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder-zinc-500"
                    />
                  </div>
                </div>
              </div>

              {/* Status & Verification Toggles */}
              <div className="border-t border-slate-200 dark:border-white/10 pt-3 flex flex-wrap items-center justify-between gap-4">
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.available}
                    onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-orange-500 focus:ring-0"
                  />
                  Available for new projects
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.verified}
                    onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-orange-500 focus:ring-0"
                  />
                  Verified badge
                </label>
              </div>

              {/* Form Buttons */}
              <div className="border-t border-slate-200 dark:border-white/10 pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-slate-100 hover:text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-500/25 hover:from-orange-400 hover:to-amber-500 disabled:opacity-50 transition"
                >
                  {saving ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Save Member
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 4. DELETE CONFIRMATION MODAL ── */}
      {deleteConfirmUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-3xl border border-rose-300 dark:border-rose-500/30 bg-white dark:bg-[#12151D] p-5 shadow-2xl text-zinc-900 dark:text-white">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Delete Member?
            </h3>
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Are you sure you want to delete member <strong>@{deleteConfirmUser}</strong>? This will permanently remove their profile and public QR card.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-slate-100 hover:text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteMember(deleteConfirmUser)}
                disabled={deleting}
                className="cursor-pointer rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50 transition"
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
