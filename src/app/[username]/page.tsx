import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  findTeamMember,
  type ProfileData,
  type Socials,
} from '@/lib/team';
import ProfileAvatar from '@/components/ProfileAvatar';
import EmployeeIdBadge from '@/components/EmployeeIdBadge';
import LocalTimeStatus from '@/components/LocalTimeStatus';
import CopyableValue from '@/components/CopyableValue';
import ProfileActions from '@/components/ProfileActions';
import {
  Mail,
  Phone,
  MessageCircle,
  MapPin,
  ArrowLeft,
  ArrowUpRight,
} from 'lucide-react';
import {
  GitHubIcon,
  LinkedInIcon,
  GlobeIcon,
  FacebookIcon,
  TwitterIcon,
} from '@/components/icons';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return [];
}

interface PageParams {
  params: Promise<{ username: string }>;
}

function decodeParam(value: string) {
  try { return decodeURIComponent(value); }
  catch { return value; }
}

async function getMember(params: PageParams['params']) {
  const { username } = await params;
  return findTeamMember(decodeParam(username));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const member = await getMember(params);
  if (!member) return { title: 'Team Member Not Found' };

  const { user } = member;
  const role = user.designation || user.role;
  return {
    title: `${user.name} - ${role || 'Team'}`,
    description: role ? `${user.name}, ${role} at SeloraX.` : `${user.name} at SeloraX.`,
  };
}

const digits = (value: unknown) => String(value ?? '').replace(/\D/g, '');

interface ContactRowProps {
  href: string;
  action: string;
  icon: React.ReactNode;
  value: string;
  label: string;
  isMono?: boolean;
  external?: boolean;
}

function ContactRow({ href, action, icon, value, label, isMono, external }: ContactRowProps) {
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors hover:bg-white dark:hover:bg-white/[0.08]">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/12 text-orange-600 dark:bg-orange-400/15 dark:text-orange-400">
          {icon}
        </div>
        <CopyableValue value={value} label={label} isMono={isMono} />
      </div>

      <a
        href={href}
        aria-label={action}
        title={action}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-white text-zinc-500 hover:text-orange-500 dark:border-white/10 dark:bg-white/10 dark:text-zinc-300 dark:hover:text-orange-400 shadow-2xs transition active:scale-95"
      >
        <ArrowUpRight className="h-3 w-3" />
      </a>
    </div>
  );
}

function ContactDetails({ profileData }: { profileData: ProfileData | null }) {
  const email = profileData?.email;
  const personal = profileData?.personalPhone || profileData?.phone;
  const business = profileData?.businessPhone;
  const whatsapp = profileData?.whatsapp;

  if (!email && !personal && !business && !whatsapp) {
    return <p className="py-1 text-center text-xs text-zinc-400">No contact information provided yet</p>;
  }

  const waDigits = digits(whatsapp);

  return (
    <div className="divide-y divide-slate-200/60 rounded-xl border border-slate-200/80 bg-white/70 p-0.5 shadow-2xs dark:divide-white/[0.06] dark:border-white/[0.08] dark:bg-black/25">
      {email && (
        <ContactRow
          href={`mailto:${email}`}
          action={`Email ${email}`}
          icon={<Mail className="h-3.5 w-3.5" />}
          value={email}
          label="Email"
        />
      )}

      {personal && (
        <ContactRow
          href={`tel:${personal}`}
          action={`Call personal number ${personal}`}
          icon={<Phone className="h-3.5 w-3.5" />}
          value={personal}
          label="Direct Mobile"
          isMono
        />
      )}

      {business && business !== personal && (
        <ContactRow
          href={`tel:${business}`}
          action={`Call business number ${business}`}
          icon={<Phone className="h-3.5 w-3.5 text-blue-500" />}
          value={business}
          label="Business Desk"
          isMono
        />
      )}

      {whatsapp && (
        <ContactRow
          href={`https://wa.me/${waDigits}`}
          action="Chat on WhatsApp"
          icon={<MessageCircle className="h-3.5 w-3.5 text-emerald-500" />}
          value={whatsapp}
          label="WhatsApp"
          isMono
          external
        />
      )}
    </div>
  );
}

function SocialLinks({ socials }: { socials?: Socials }) {
  if (!socials) return null;

  const links = [
    { key: 'github', label: 'GitHub', icon: GitHubIcon, href: socials.github },
    { key: 'linkedin', label: 'LinkedIn', icon: LinkedInIcon, href: socials.linkedin },
    { key: 'portfolio', label: 'Portfolio', icon: GlobeIcon, href: socials.portfolio },
    { key: 'facebook', label: 'Facebook', icon: FacebookIcon, href: socials.facebook },
    { key: 'twitter', label: 'Twitter / X', icon: TwitterIcon, href: socials.twitter },
  ].filter((l) => Boolean(l.href));

  if (links.length === 0) return null;

  return (
    <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 px-2">
      {links.map(({ key, label, icon: IconComponent, href }) => (
        <a
          key={key}
          href={href!}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200/80 bg-white text-zinc-600 hover:text-orange-500 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-orange-400 dark:hover:border-zinc-700 shadow-2xs transition active:scale-95"
        >
          <IconComponent className="h-3.5 w-3.5" />
        </a>
      ))}
    </div>
  );
}

function CompanyFooter() {
  return (
    <div className="mt-2.5 border-t border-zinc-100/80 pt-2 text-center dark:border-zinc-800/70">
      <a
        href="https://maps.google.com/?q=1286/3,+Begum+Rokeya+Sarani,+Mirpur,+Dhaka"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-orange-500 dark:text-zinc-400 dark:hover:text-orange-400 transition"
      >
        <MapPin className="h-3 w-3 text-orange-500" />
        <span className="font-semibold text-zinc-600 dark:text-zinc-300">HQ:</span> Mirpur, Dhaka ↗
      </a>
    </div>
  );
}

export default async function TeamProfilePage({ params }: PageParams) {
  const member = await getMember(params);
  if (!member) notFound();

  if (member.redirectTo) {
    redirect(`/${encodeURIComponent(member.redirectTo)}`);
  }

  const { user, profilePic, profileData } = member;
  const role = user.designation || user.role;
  const department = (user.department as string) || 'Engineering';
  const skills = user.skills || [];

  return (
    <div className="w-full max-w-sm sm:max-w-md my-auto animate-in fade-in zoom-in-95 duration-200">
      {/* Back to Directory Link */}
      <div className="mb-2 flex items-center justify-between px-1">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition"
        >
          <ArrowLeft className="h-3 w-3" />
          Directory
        </Link>
        <span className="text-[10px] font-mono-numbers text-zinc-400 dark:text-zinc-500">
          Profile Card
        </span>
      </div>

      {/* Main Profile Tactile Card: Compact & Viewport-fitting */}
      <div className="tactile-card rounded-2xl sm:rounded-3xl p-4 sm:p-5">
        
        {/* Header: High-res Avatar with Verified Badge */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-2">
            <ProfileAvatar
              src={profilePic}
              name={user.name}
              verified={user.verified ?? true}
            />
          </div>

          {/* Full Name & Role */}
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 break-words">
            {user.name}
          </h1>
          {role && (
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {role}
            </p>
          )}

          {/* Monospace Employee ID Badge + Department Badge */}
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
            <EmployeeIdBadge employeeId={user.employeeId} />

            <span className="rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-400">
              {department}
            </span>
          </div>

          {/* Live Local Time & Status Indicator */}
          <div className="mt-2">
            <LocalTimeStatus
              timezone={user.timezone || 'Asia/Dhaka'}
              status={user.status}
            />
          </div>
        </div>

        {/* Contact Rows */}
        <div className="mt-3">
          <ContactDetails profileData={profileData} />
        </div>

        {/* Primary Action Buttons */}
        <div className="mt-3">
          <ProfileActions user={user} profileData={profileData} />
        </div>

        {/* Core Tech Stack / Skills Micro-chips */}
        {skills.length > 0 && (
          <div className="mt-3 border-t border-zinc-100/80 pt-2.5 dark:border-zinc-800/70">
            <div className="mb-1 text-center text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Tech Stack
            </div>
            <div className="flex flex-wrap justify-center gap-1">
              {skills.map((skill: string) => (
                <span
                  key={skill}
                  className="rounded-md border border-zinc-200/80 bg-zinc-100/80 px-2 py-0.5 text-[10px] font-medium text-zinc-700 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:border-zinc-700"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Social Links */}
        <SocialLinks socials={profileData?.socials} />

        {/* Company HQ Footer */}
        <CompanyFooter />
      </div>
    </div>
  );
}
