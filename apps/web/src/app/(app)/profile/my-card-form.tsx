'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  BLOOD_GROUP_LABELS,
  BloodGroup,
  linkMatchesKind,
  type OwnTeamProfile,
  TeamProfileLinkKind,
  updateOwnTeamProfileSchema,
} from '@ems/contracts';
import { ExternalLink, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormAlert } from '@/components/forms/form-alert';
import { LINKS } from '@/components/team-profile/profile-links';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes';
import { api } from '@/lib/api-client';
import { applyApiError } from '@/lib/form-errors';
import { cn } from '@/lib/utils';

const NONE = '__none__';

type Kind = (typeof TeamProfileLinkKind)[number];

const LINK_PLACEHOLDERS: Record<Kind, string> = {
  FACEBOOK: 'https://facebook.com/your.name',
  INSTAGRAM: 'https://instagram.com/yourname',
  DISCORD: 'https://discord.com/users/123456789012345678',
  GITHUB: 'https://github.com/yourname',
  LINKEDIN: 'https://linkedin.com/in/yourname',
  WEBSITE: 'https://yourname.dev',
};

/**
 * One switch per network: turn on the ones you want, fill in the address, and leave the rest off.
 * Only switched-on links are sent, and the API replaces the whole set with what it is sent, so
 * turning one off removes it from the card. A switched-off address is kept in the form, so
 * turning it back on before saving does not lose what was typed.
 */
const linkEntry = z.object({ on: z.boolean(), url: z.string() });

const schema = updateOwnTeamProfileSchema
  .omit({ links: true })
  .extend({ links: z.record(z.enum(TeamProfileLinkKind), linkEntry) })
  .superRefine((values, ctx) => {
    for (const kind of TeamProfileLinkKind) {
      const entry = values.links[kind];
      if (!entry?.on) continue;
      const url = entry.url.trim();
      const path = ['links', kind, 'url'];
      if (!url) ctx.addIssue({ code: 'custom', path, message: 'Add the address, or switch this off' });
      else if (!/^https:\/\//i.test(url)) ctx.addIssue({ code: 'custom', path, message: 'Use a full https:// address' });
      else if (!linkMatchesKind(kind, url)) ctx.addIssue({ code: 'custom', path, message: `That is not a ${LINKS[kind].label} address` });
    }
  });
type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;

export function MyCardForm({ card, employeeId }: { card: OwnTeamProfile; employeeId: string | null }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Input, unknown, Output>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      businessPhone: card.businessPhone ?? '',
      bloodGroup: card.bloodGroup,
      headline: card.headline ?? '',
      showPersonalPhone: card.showPersonalPhone,
      links: Object.fromEntries(
        TeamProfileLinkKind.map((kind) => {
          const url = card.links.find((link) => link.kind === kind)?.url ?? '';
          return [kind, { on: url !== '', url }];
        }),
      ),
    },
  });
  useUnsavedChangesWarning(isDirty);
  const links = useWatch({ control, name: 'links' });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const chosen = TeamProfileLinkKind.filter((kind) => values.links[kind]?.on && values.links[kind].url.trim()).map(
      (kind) => ({ kind, url: values.links[kind]!.url.trim() }),
    );

    try {
      await api('/team-profile/me', {
        method: 'PATCH',
        body: {
          // Empty boxes clear the field rather than leaving the old value behind
          businessPhone: values.businessPhone?.trim() ? values.businessPhone.trim() : null,
          headline: values.headline?.trim() ? values.headline.trim() : null,
          bloodGroup: values.bloodGroup ?? null,
          showPersonalPhone: values.showPersonalPhone,
          links: chosen,
        },
      });
      reset(values);
      toast.success('Your card was saved');
      router.refresh();
    } catch (error) {
      setFormError(
        applyApiError(error, setError, [
          'businessPhone',
          'bloodGroup',
          'headline',
          ...TeamProfileLinkKind.map((kind) => `links.${kind}.url` as const),
        ]),
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="@container rounded-2xl border bg-card p-4 shadow-panel sm:p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">My Team Profile card</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What colleagues see in Team Profile. Everything here is optional.
          </p>
        </div>
        {employeeId && (
          <Button asChild variant="outline" className="h-9">
            <Link href={`/team-profile/${employeeId}`}>
              <ExternalLink aria-hidden /> View my card
            </Link>
          </Button>
        )}
      </div>

      {formError && (
        <div className="mt-4">
          <FormAlert tone="error">{formError}</FormAlert>
        </div>
      )}

      {/* Container queries: the form sits beside the preview on wide screens, so its own width decides */}
      <div className="mt-5 grid grid-cols-1 gap-4 @xl:grid-cols-2">
        <TextField
          label="Business phone"
          placeholder="+8801811234567"
          hint="A number you are happy to publish. Leave it blank to show none."
          registration={register('businessPhone')}
          error={errors.businessPhone}
        />

        <Controller
          control={control}
          name="bloodGroup"
          render={({ field }) => (
            <div>
              <Label htmlFor="bloodGroup">Blood group</Label>
              <Select
                value={field.value ?? NONE}
                onValueChange={(value) => field.onChange(value === NONE ? null : value)}
              >
                <SelectTrigger id="bloodGroup" className="mt-1.5 w-full">
                  <SelectValue placeholder="Not shown" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not shown</SelectItem>
                  {BloodGroup.map((group) => (
                    <SelectItem key={group} value={group}>
                      {BLOOD_GROUP_LABELS[group]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-muted-foreground">Useful in an emergency. Nobody has to publish it.</p>
            </div>
          )}
        />

        <div className="@xl:col-span-2">
          <TextField
            label="Headline"
            placeholder="Happy to pair on anything React."
            hint="One line under your job title, at most 120 characters."
            maxLength={120}
            registration={register('headline')}
            error={errors.headline}
          />
        </div>
      </div>

      <Controller
        control={control}
        name="showPersonalPhone"
        render={({ field }) => (
          <div className="mt-5 flex items-start gap-3 rounded-xl border bg-secondary/40 p-4">
            <Switch id="showPersonalPhone" checked={field.value ?? true} onCheckedChange={field.onChange} />
            <div>
              <Label htmlFor="showPersonalPhone" className="font-medium">
                Show my personal number ({card.personalPhone})
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Turning this off hides it from your card. HR still holds it on your employee record.
              </p>
            </div>
          </div>
        )}
      />

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">Social links</legend>
        <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
          Switch on the ones you want on your card — one, two or all of them — and leave the rest off.
        </p>
        <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
          {TeamProfileLinkKind.map((kind) => {
            const { icon: Icon, label, className: tone } = LINKS[kind];
            const on = links[kind]?.on ?? false;
            const error = errors.links?.[kind]?.url;
            return (
              <div
                key={kind}
                className={cn('rounded-xl border p-3 transition-colors', on ? 'bg-card' : 'bg-secondary/40')}
              >
                <div className="flex items-center gap-3">
                  <span aria-hidden className={cn('grid size-9 shrink-0 place-items-center rounded-full', tone, !on && 'opacity-50')}>
                    <Icon className="size-[17px]" />
                  </span>
                  <Label htmlFor={`link-${kind}-on`} className="flex-1 font-medium">
                    {label}
                  </Label>
                  <Controller
                    control={control}
                    name={`links.${kind}.on`}
                    render={({ field }) => (
                      <Switch
                        id={`link-${kind}-on`}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label={`Show ${label} on my card`}
                      />
                    )}
                  />
                </div>
                {on && (
                  <div className="mt-2.5">
                    <Input
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      placeholder={LINK_PLACEHOLDERS[kind]}
                      aria-label={`${label} address`}
                      aria-invalid={error ? true : undefined}
                      {...register(`links.${kind}.url`)}
                      className="h-10"
                    />
                    {error?.message && <p className="mt-1 text-xs text-danger-text">{error.message}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={!isDirty || isSubmitting} className="h-11 w-full @md:h-9 @md:w-auto">
          {isSubmitting && <LoaderCircle aria-hidden className="animate-spin" />}
          Save my card
        </Button>
      </div>
    </form>
  );
}
