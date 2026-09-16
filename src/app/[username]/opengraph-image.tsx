import { ImageResponse } from 'next/og';
import { findTeamMember } from '@/lib/team';

// The preview card people see when a profile link is pasted into WhatsApp, Slack or LinkedIn.
// Name and role only: contact details must not be baked into an image that chat apps cache.
export const alt = 'SeloraX team member';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function ProfileOpengraphImage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  let member = null;
  try {
    member = await findTeamMember(decodeURIComponent(username));
  } catch {
    // A database hiccup should still produce a branded card, not a broken preview
  }

  const name = member?.user.name ?? member?.user.username ?? 'SeloraX';
  const role = member?.user.designation || member?.user.role || 'SeloraX team';
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 56,
          padding: '0 96px',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #f97316 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            width: 260,
            height: 260,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            border: '6px solid rgba(255,255,255,0.35)',
            fontSize: 104,
            fontWeight: 700,
          }}
        >
          {initials}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: -2 }}>{name}</div>
          <div style={{ fontSize: 38, marginTop: 16, color: '#c7d2fe' }}>{role}</div>
          <div style={{ fontSize: 26, marginTop: 40, color: '#e0e7ff', letterSpacing: 3 }}>SELORAX</div>
        </div>
      </div>
    ),
    size,
  );
}
