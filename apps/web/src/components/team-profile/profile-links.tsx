import type { TeamProfileLink, TeamProfileLinkKind } from '@ems/contracts';
import { Globe } from 'lucide-react';
import { FacebookIcon, GithubIcon, InstagramIcon, LinkedinIcon } from './brand-icons';
import { cn } from '@/lib/utils';

/**
 * Only these five kinds exist, so every link renders as a known icon and nothing unrecognised can
 * appear. `noreferrer` because these point off our origin, and they are people's own accounts.
 */
/** Both lucide icons and the hand-drawn brand marks take a className and nothing else here. */
type Icon = React.ComponentType<{ className?: string }>;

const LINKS: Record<TeamProfileLinkKind, { icon: Icon; label: string; className: string }> = {
  FACEBOOK: { icon: FacebookIcon, label: 'Facebook', className: 'bg-[#eef0fb] text-[#1b5fc1] dark:bg-[#1b5fc1]/15 dark:text-[#8ab4f8]' },
  INSTAGRAM: { icon: InstagramIcon, label: 'Instagram', className: 'bg-[#fdeef3] text-[#bf2d63] dark:bg-[#bf2d63]/15 dark:text-[#f491b5]' },
  GITHUB: { icon: GithubIcon, label: 'GitHub', className: 'bg-secondary text-foreground' },
  LINKEDIN: { icon: LinkedinIcon, label: 'LinkedIn', className: 'bg-[#e9f2fa] text-[#0a5c9c] dark:bg-[#0a5c9c]/15 dark:text-[#7fc0f0]' },
  WEBSITE: { icon: Globe, label: 'Website', className: 'bg-accent text-accent-foreground' },
};

export function ProfileLinks({
  links,
  size = 'md',
  className,
}: {
  links: TeamProfileLink[];
  /** `sm` for the grid tile, `md` for the full card. */
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <ul className={cn('flex list-none flex-wrap justify-center p-0', size === 'sm' ? 'gap-1.5' : 'gap-2.5', className)}>
      {links.map((link) => {
        const { icon: Icon, label, className: tone } = LINKS[link.kind];
        return (
          <li key={link.kind}>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={label}
              title={label}
              className={cn(
                'grid place-items-center rounded-full transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                size === 'sm' ? 'size-8' : 'size-11',
                tone,
              )}
            >
              <Icon className={size === 'sm' ? 'size-[15px]' : 'size-[19px]'} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
