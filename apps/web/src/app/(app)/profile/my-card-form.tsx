'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  BLOOD_GROUP_LABELS,
  BloodGroup,
  type OwnTeamProfile,
  TeamProfileLinkKind,
  updateOwnTeamProfileSchema,
} from '@ems/contracts';
import { ExternalLink, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormAlert } from '@/components/forms/form-alert';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes';
import { api } from '@/lib/api-client';
import { applyApiError } from '@/lib/form-errors';

const NONE = '__none__';

const LINK_LABELS: Record<(typeof TeamProfileLinkKind)[number], string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  GITHUB: 'GitHub',
  LINKEDIN: 'LinkedIn',
  WEBSITE: 'Website',
};

/**
 * The form sends one link per kind, so it is a fixed set of boxes rather than a list to add to.
 * Empty boxes are dropped before the request; the API replaces the whole set with what it is sent.
 */
const schema = updateOwnTeamProfileSchema
  .omit({ links: true })
  .extend({ links: z.record(z.enum(TeamProfileLinkKind), z.string()) });
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
      links: Object.fromEntries(TeamProfileLinkKind.map((kind) => [kind, card.links.find((l) => l.kind === kind)?.url ?? ''])),
    },
  });
  useUnsavedChangesWarning(isDirty);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const links = Object.entries(values.links ?? {})
      .filter(([, url]) => url.trim() !== '')
      .map(([kind, url]) => ({ kind: kind as (typeof TeamProfileLinkKind)[number], url: url.trim() }));

    try {
      await api('/team-profile/me', {
        method: 'PATCH',
        body: {
          // Empty boxes clear the field rather than leaving the old value behind
          businessPhone: values.businessPhone?.trim() ? values.businessPhone.trim() : null,
          headline: values.headline?.trim() ? values.headline.trim() : null,
          bloodGroup: values.bloodGroup ?? null,
          showPersonalPhone: values.showPersonalPhone,
          links,
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
          ...TeamProfileLinkKind.map((kind) => `links.${kind}` as const),
        ]),
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border bg-card p-5 shadow-panel md:p-6">
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

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <div className="sm:col-span-2">
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
        <legend className="text-sm font-medium">Links</legend>
        <p className="mt-0.5 mb-3 text-xs text-muted-foreground">Full https addresses. Leave a box empty to remove it.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TeamProfileLinkKind.map((kind) => (
            <TextField
              key={kind}
              label={LINK_LABELS[kind]}
              type="url"
              placeholder={`https://${kind.toLowerCase()}.com/you`}
              registration={register(`links.${kind}`)}
              error={errors.links?.[kind]}
            />
          ))}
        </div>
      </fieldset>

      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={!isDirty || isSubmitting}>
          {isSubmitting && <LoaderCircle aria-hidden className="animate-spin" />}
          Save my card
        </Button>
      </div>
    </form>
  );
}
