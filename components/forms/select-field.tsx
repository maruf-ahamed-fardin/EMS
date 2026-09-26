'use client';

import { useId } from 'react';
import { type Control, Controller, type FieldPath, type FieldValues } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/client/utils';

/** Radix Select can't hold an empty value, so "none" stands in for null in optional selects. */
export const NONE = '__none__';

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder = 'Choose…',
  required,
  optionalLabel,
  hint,
  disabled,
  className,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: readonly SelectOption[];
  placeholder?: string;
  required?: boolean;
  /** When set, the select offers this label for "no value" and stores null. */
  optionalLabel?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const errorId = fieldState.error ? `${id}-error` : undefined;
        const hintId = hint && !fieldState.error ? `${id}-hint` : undefined;
        const value = field.value === null || field.value === undefined || field.value === '' ? (optionalLabel ? NONE : '') : String(field.value);
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
            <Select
              value={value}
              disabled={disabled}
              onValueChange={(next) => field.onChange(next === NONE ? null : next)}
            >
              <SelectTrigger
                id={id}
                ref={field.ref}
                onBlur={field.onBlur}
                className="h-11 w-full"
                aria-invalid={fieldState.error ? true : undefined}
                aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {optionalLabel && <SelectItem value={NONE}>{optionalLabel}</SelectItem>}
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                    {option.hint && <span className="text-muted-foreground"> · {option.hint}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hintId && (
              <p id={hintId} className="text-xs text-muted-foreground">
                {hint}
              </p>
            )}
            {fieldState.error?.message && (
              <p id={errorId} className="text-sm text-danger-text">
                {fieldState.error.message}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
