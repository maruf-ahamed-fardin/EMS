/**
 * Brand marks for the card's links.
 *
 * lucide-react 1.x dropped its brand icons, so these are drawn here. They are the only logos the
 * app shows, and each is used solely to label a link to that service. Everything else on the card
 * uses lucide.
 */

type IconProps = { className?: string };

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.25-1.5 1.55-1.5H16.7V4.6A21 21 0 0 0 14.3 4.5c-2.4 0-4 1.45-4 4.1v2.3H7.6V14h2.7v8Z" />
    </svg>
  );
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function GithubIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M9 19c-4 1.3-4-2.2-6-2.7m12 5.2v-3.6a3.1 3.1 0 0 0-.9-2.4c2.9-.3 6-1.4 6-6.4a5 5 0 0 0-1.4-3.4 4.6 4.6 0 0 0-.1-3.5s-1.1-.3-3.6 1.4a12.4 12.4 0 0 0-6.6 0C5.9 1.9 4.8 2.2 4.8 2.2a4.6 4.6 0 0 0-.1 3.5A5 5 0 0 0 3.3 9.1c0 5 3 6.1 5.9 6.4a3.1 3.1 0 0 0-.9 2.4v3.6" />
    </svg>
  );
}

export function LinkedinIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 11v6M8 7.5v.1M12 17v-3.4a2.1 2.1 0 0 1 4.2 0V17" />
    </svg>
  );
}

export function DiscordIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M19.3 5.4A16.6 16.6 0 0 0 15.2 4l-.5 1a15.4 15.4 0 0 0-5.4 0l-.5-1a16.6 16.6 0 0 0-4.1 1.4C2.1 9.3 1.4 13.1 1.7 16.9a16.8 16.8 0 0 0 5.1 2.6l1.1-1.8a10.8 10.8 0 0 1-1.7-.8l.4-.3a11.9 11.9 0 0 0 10.8 0l.4.3a10.8 10.8 0 0 1-1.7.8l1.1 1.8a16.8 16.8 0 0 0 5.1-2.6c.4-4.4-.7-8.2-3-11.5ZM8.7 14.6c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
    </svg>
  );
}
