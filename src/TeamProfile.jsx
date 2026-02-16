import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import seloraxLogo from './assets/SeloraX logo.png';

const CopyableNumber = ({ number, label }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [number]);
  return (
    <div className="flex flex-col min-w-0 flex-1">
      <button type="button" onClick={handleCopy} className="text-sm text-slate-700 hover:text-indigo-600 text-left cursor-pointer transition-colors">
        {copied ? 'Copied!' : number}
      </button>
      <span className="text-[10px] text-slate-400 font-medium">{label}</span>
    </div>
  );
};

const SocialIcon = ({ type, url }) => {
  if (!url) return null;
  const href = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
  const icons = {
    facebook: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    instagram: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
    github: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
    portfolio: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    )
  };
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
    >
      {icons[type]}
    </a>
  );
};

export default function TeamProfile() {
  const { username: urlParam } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilePic, setProfilePic] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Single API call — returns user + profilePic + profileData for one person
        // CDN cached for 60s, so repeat/shared visits are instant
        const res = await fetch(`/api/team-profile?id=${encodeURIComponent(urlParam)}`);
        if (!active) return;
        const data = await res.json();

        if (!data.found) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        // If accessed by employeeId, redirect to username URL
        if (data.redirectTo) {
          navigate(`/${data.redirectTo}`, { replace: true });
          return;
        }

        setUser(data.user);
        setProfilePic(data.profilePic);
        setProfileData(data.profileData);
        setLoading(false);
      } catch {
        if (!active) return;
        setNotFound(true);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [urlParam, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-950 via-indigo-900 to-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-400/30 border-t-orange-400" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-950 via-indigo-900 to-slate-900 px-4 text-center">
        <a href="https://selorax.io" target="_blank" rel="noopener noreferrer"><img src={seloraxLogo} alt="SeloraX" className="h-12 mb-6 brightness-0 invert" /></a>
        <h1 className="text-2xl font-bold text-white mb-2">Team Member Not Found</h1>
        <p className="text-indigo-200">The team member you are looking for does not exist.</p>
      </div>
    );
  }

  const socials = profileData?.socials || {};
  const hasSocials = socials.facebook || socials.instagram || socials.github || socials.portfolio;

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-indigo-950 via-indigo-900 to-slate-900">
      {/* Branded Header */}
      <div className="w-full bg-gradient-to-r from-indigo-950 via-indigo-800 to-orange-500 pt-10 pb-24 px-4 flex flex-col items-center">
        <a href="https://selorax.io" target="_blank" rel="noopener noreferrer"><img src={seloraxLogo} alt="SeloraX" className="h-10 brightness-0 invert" /></a>
      </div>

      {/* Card — pulled up over the header gradient */}
      <div className="w-full max-w-sm px-4 -mt-16 pb-10">
        <div className="rounded-3xl bg-white shadow-2xl overflow-hidden">
          {/* Profile Picture */}
          <div className="flex flex-col items-center pt-8 pb-4">
            <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-indigo-200 shadow-lg ring-4 ring-white">
              {profilePic ? (
                <img src={profilePic} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-indigo-600 to-orange-500 flex items-center justify-center text-white text-4xl font-bold">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Name & Role */}
          <div className="text-center px-6 pb-5">
            <h1 className="text-2xl font-bold text-slate-800">{user.name}</h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="inline-block rounded-full bg-indigo-50 px-3 py-0.5 text-xs font-semibold text-indigo-600">{user.designation || user.role}</span>
            </div>
          </div>

          {/* Contact Info */}
          <div className="mx-5 rounded-2xl bg-slate-50 border border-slate-100 p-4 mb-5">
            <div className="space-y-3">
              {profileData?.email && (
                <div className="flex items-center gap-3">
                  <a href={`mailto:${profileData.email}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" /></svg>
                  </a>
                  <CopyableNumber number={profileData.email} label="Email" />
                </div>
              )}
              {(profileData?.personalPhone || profileData?.phone) && (() => {
                const num = profileData.personalPhone || profileData.phone;
                const waMatch = profileData?.whatsapp && profileData.whatsapp.replace(/[^0-9]/g, '') === num.replace(/[^0-9]/g, '');
                return (
                  <div className="flex items-center gap-3">
                    <a href={`tel:${num}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
                    </a>
                    <CopyableNumber number={num} label="Personal" />
                    {waMatch && (
                      <a href={`https://wa.me/${num.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors">
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                      </a>
                    )}
                  </div>
                );
              })()}
              {profileData?.businessPhone && (() => {
                const waMatch = profileData?.whatsapp && profileData.whatsapp.replace(/[^0-9]/g, '') === profileData.businessPhone.replace(/[^0-9]/g, '');
                return (
                  <div className="flex items-center gap-3">
                    <a href={`tel:${profileData.businessPhone}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
                    </a>
                    <CopyableNumber number={profileData.businessPhone} label="Business" />
                    {waMatch && (
                      <a href={`https://wa.me/${profileData.businessPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors">
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                      </a>
                    )}
                  </div>
                );
              })()}
              {profileData?.whatsapp && (() => {
                const waDigits = profileData.whatsapp.replace(/[^0-9]/g, '');
                const personalDigits = (profileData.personalPhone || profileData.phone || '').replace(/[^0-9]/g, '');
                const businessDigits = (profileData.businessPhone || '').replace(/[^0-9]/g, '');
                if (waDigits === personalDigits || waDigits === businessDigits) return null;
                return (
                  <div className="flex items-center gap-3">
                    <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                    </a>
                    <CopyableNumber number={profileData.whatsapp} label="WhatsApp" />
                  </div>
                );
              })()}
              {!profileData?.email && !(profileData?.personalPhone || profileData?.phone) && !profileData?.businessPhone && !profileData?.whatsapp && (
                <p className="text-sm text-slate-400 text-center py-1">No contact info added yet</p>
              )}
            </div>
          </div>

          {/* Social Links */}
          {hasSocials && (
            <div className="flex items-center justify-center gap-3 px-6 pb-5">
              <SocialIcon type="facebook" url={socials.facebook} />
              <SocialIcon type="instagram" url={socials.instagram} />
              <SocialIcon type="github" url={socials.github} />
              <SocialIcon type="portfolio" url={socials.portfolio} />
            </div>
          )}

          {/* Divider + Company Info */}
          <div className="border-t border-slate-100 mx-5 pt-4 pb-6 space-y-2">
            <p className="text-center text-xs text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-500">HQ:</span> 1286/3, Begum Rokeya Sarani, Kazi Para, Mirpur, Dhaka.
            </p>
            <div className="flex items-center justify-center gap-3 pt-1">
              <a href="tel:+8801606606204" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
              </a>
              <a href="https://www.facebook.com/selorax.io/" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
              </a>
              <a href="https://github.com/SeloraX-io" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
