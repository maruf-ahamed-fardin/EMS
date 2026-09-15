import { notFound, redirect } from 'next/navigation';
import { findTeamMember } from '@/lib/team';
import ProfileAvatar from '@/components/ProfileAvatar';
import CopyableValue from '@/components/CopyableValue';
import {
  EmailIcon, PhoneIcon, WhatsAppIcon, FacebookIcon, InstagramIcon, GitHubIcon, GlobeIcon,
} from '@/components/icons';

// ISR: each profile renders on its first visit, is served from cache after that,
// and is regenerated in the background at most every 30 seconds.
export const revalidate = 30;

export function generateStaticParams() {
  return [];
}

function decodeParam(value) {
  try { return decodeURIComponent(value); }
  catch { return value; }
}

async function getMember(params) {
  const { username } = await params;
  return findTeamMember(decodeParam(username));
}

export async function generateMetadata({ params }) {
  const member = await getMember(params);
  if (!member) return { title: 'Team Member Not Found' };

  const { user } = member;
  const role = user.designation || user.role;
  return {
    title: user.name,
    description: role ? `${user.name}, ${role} at SeloraX` : `${user.name} at SeloraX`,
  };
}

const digits = (value) => String(value ?? '').replace(/\D/g, '');

const iconBox = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors';
const indigoBox = `${iconBox} bg-indigo-100 text-indigo-600 hover:bg-indigo-200`;
const greenBox = `${iconBox} bg-green-100 text-green-600 hover:bg-green-200`;
const externalLink = { target: '_blank', rel: 'noopener noreferrer' };

function ContactRow({ href, action, icon, value, label, external, green, whatsapp }) {
  return (
    <div className="flex items-center gap-3">
      <a href={href} aria-label={action} className={green ? greenBox : indigoBox} {...(external && externalLink)}>
        {icon}
      </a>
      <CopyableValue value={String(value)} label={label} />
      {whatsapp && (
        <a href={`https://wa.me/${digits(whatsapp)}`} aria-label="Chat on WhatsApp" className={greenBox} {...externalLink}>
          <WhatsAppIcon className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

function ContactDetails({ profileData }) {
  const email = profileData?.email;
  const personal = profileData?.personalPhone || profileData?.phone;
  const business = profileData?.businessPhone;
  const whatsapp = profileData?.whatsapp;

  if (!email && !personal && !business && !whatsapp) {
    return <p className="py-1 text-center text-sm text-slate-400">No contact info added yet</p>;
  }

  // WhatsApp gets a button beside a phone number it matches, otherwise its own row
  const waDigits = digits(whatsapp);
  const waOnPersonal = whatsapp && waDigits === digits(personal);
  const waOnBusiness = whatsapp && waDigits === digits(business);

  return (
    <div className="space-y-3">
      {email && (
        <ContactRow href={`mailto:${email}`} action="Send email" icon={<EmailIcon className="h-4 w-4" />} value={email} label="Email" />
      )}
      {personal && (
        <ContactRow
          href={`tel:${personal}`} action="Call personal number" icon={<PhoneIcon className="h-4 w-4" />}
          value={personal} label="Personal" whatsapp={waOnPersonal ? personal : null}
        />
      )}
      {business && (
        <ContactRow
          href={`tel:${business}`} action="Call business number" icon={<PhoneIcon className="h-4 w-4" />}
          value={business} label="Business" whatsapp={waOnBusiness ? business : null}
        />
      )}
      {whatsapp && !waOnPersonal && !waOnBusiness && (
        <ContactRow
          href={`https://wa.me/${waDigits}`} action="Chat on WhatsApp" icon={<WhatsAppIcon className="h-4 w-4" />}
          value={whatsapp} label="WhatsApp" external green
        />
      )}
    </div>
  );
}

const SOCIALS = [
  { key: 'facebook', label: 'Facebook', Icon: FacebookIcon },
  { key: 'instagram', label: 'Instagram', Icon: InstagramIcon },
  { key: 'github', label: 'GitHub', Icon: GitHubIcon },
  { key: 'portfolio', label: 'Portfolio', Icon: GlobeIcon },
];

// Only allow http(s) links; bare domains like "github.com/me" get https:// added
function safeUrl(url) {
  if (!url) return null;
  const str = String(url);
  try {
    const parsed = new URL(/^https?:\/\//.test(str) ? str : `https://${str}`);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function SocialLinks({ socials }) {
  const links = SOCIALS
    .map(s => ({ ...s, href: safeUrl(socials?.[s.key]) }))
    .filter(s => s.href);
  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 px-6 pb-5">
      {links.map(({ key, label, Icon, href }) => (
        <a
          key={key}
          href={href}
          aria-label={label}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-400 transition-colors hover:bg-indigo-100 hover:text-indigo-600"
          {...externalLink}
        >
          <Icon className="h-5 w-5" />
        </a>
      ))}
    </div>
  );
}

const footerIcon = 'flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600';

function CompanyFooter() {
  return (
    <div className="mx-5 space-y-2 border-t border-slate-100 pt-4 pb-6">
      <p className="text-center text-xs leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-500">HQ:</span> 1286/3, Begum Rokeya Sarani, Kazi Para, Mirpur, Dhaka.
      </p>
      <div className="flex items-center justify-center gap-3 pt-1">
        <a href="tel:+8801606606204" aria-label="Call SeloraX" className={footerIcon}>
          <PhoneIcon className="h-3.5 w-3.5" />
        </a>
        <a href="https://www.facebook.com/selorax.io/" aria-label="SeloraX on Facebook" className={footerIcon} {...externalLink}>
          <FacebookIcon className="h-3.5 w-3.5" />
        </a>
        <a href="https://github.com/SeloraX-io" aria-label="SeloraX on GitHub" className={footerIcon} {...externalLink}>
          <GitHubIcon className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

export default async function TeamProfilePage({ params }) {
  const member = await getMember(params);
  if (!member) notFound();

  // Accessed by employee ID: send visitors to the canonical username URL
  if (member.redirectTo) redirect(`/${encodeURIComponent(member.redirectTo)}`);

  const { user, profilePic, profileData } = member;
  const role = user.designation || user.role;

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div className="flex justify-center pt-8 pb-4">
        <ProfileAvatar key={profilePic} src={profilePic} name={user.name} />
      </div>

      <div className="px-6 pb-5 text-center">
        <h1 className="text-xl font-bold text-slate-800 wrap-break-word sm:text-2xl">{user.name}</h1>
        {role && (
          <span className="mt-2 inline-block rounded-full bg-indigo-50 px-3 py-0.5 text-xs font-semibold text-indigo-600">
            {role}
          </span>
        )}
      </div>

      <div className="mx-4 mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:mx-5">
        <ContactDetails profileData={profileData} />
      </div>

      <SocialLinks socials={profileData?.socials} />

      <CompanyFooter />
    </div>
  );
}
