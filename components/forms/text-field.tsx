'use client';

import { useId } from 'react';
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/client/utils';

/**
 * Label, input and inline error, wired for screen readers: the error is linked with
 * aria-describedby and the input is marked aria-invalid (plan §11, forms).
 */
export function TextField({
  label,
  registration,
  error,
  hint,
  required,
  className,
  ...inputProps
}: {
  label: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
  hint?: string;
  required?: boolean;
  className?: string;
} & Omit<React.ComponentProps<'input'>, 'name' | 'onChange' | 'onBlur' | 'ref'>) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden className="text-danger-text">
            *
          </span>
        )}
      </Label>
      <Input
        id={id}
        className="h-11"
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...inputProps}
        {...registration}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error?.message && (
        <p id={errorId} className="text-sm text-danger-text">
          {error.message}
        </p>
      )}
    </div>
  );
}
