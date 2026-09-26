'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type DocumentItem, type DocumentTypeItem, MAX_DOCUMENT_BYTES, uploadDocumentFields } from '@/lib/validations';
import { LoaderCircle, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { FormAlert } from '@/components/forms/form-alert';
import { SelectField } from '@/components/forms/select-field';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiUpload } from '@/lib/client/api-client';
import { ApiRequestError } from '@/lib/client/api-error';
import { checkDocumentFile, DOCUMENT_ACCEPT, formatBytes, titleFromFileName } from '@/lib/client/documents';
import { applyApiError } from '@/lib/client/form-errors';

type Input = z.input<typeof uploadDocumentFields>;
type Output = z.output<typeof uploadDocumentFields>;

/**
 * Upload one document for one employee. Types the uploader couldn't open afterwards (sensitive ones,
 * without private-details access) aren't offered; the API enforces the same rule.
 */
export function UploadDocumentDialog({
  employeeId,
  employeeName,
  types,
  canUploadSensitive,
  own = false,
}: {
  employeeId: string;
  employeeName: string;
  types: DocumentTypeItem[];
  canUploadSensitive: boolean;
  /** Wording for someone adding their own document. */
  own?: boolean;
}) {
  const router = useRouter();
  const fileId = useId();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const offered = types.filter((t) => canUploadSensitive || !t.isSensitive);
  const defaults: Input = { documentTypeId: offered[0]?.id ?? '', title: '', expiresAt: '' };

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Input, unknown, Output>({ resolver: zodResolver(uploadDocumentFields), defaultValues: defaults });
  const typeId = useWatch({ control, name: 'documentTypeId' });
  const type = offered.find((t) => t.id === typeId);

  function choose(chosen: File | null) {
    setFile(chosen);
    setFileError(chosen ? checkDocumentFile(chosen) : null);
    if (chosen && !getValues('title')) setValue('title', titleFromFileName(chosen.name), { shouldValidate: true });
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const problem = file ? checkDocumentFile(file) : 'Choose a file to upload';
    if (problem) {
      setFileError(problem);
      return;
    }
    if (type?.hasExpiry && !values.expiresAt) {
      setError('expiresAt', { message: `${type.name} documents need an expiry date` });
      return;
    }
    const form = new FormData();
    form.set('documentTypeId', values.documentTypeId);
    form.set('title', values.title);
    if (type?.hasExpiry && values.expiresAt) form.set('expiresAt', values.expiresAt);
    form.set('file', file!);
    try {
      await apiUpload<{ data: DocumentItem }>(`/employees/${employeeId}/documents`, form);
      toast.success(own ? `${values.title} added` : `${values.title} added for ${employeeName}`);
      setOpen(false);
      reset(defaults);
      setFile(null);
      router.refresh();
    } catch (error) {
      const message = applyApiError(error, setError, ['documentTypeId', 'title', 'expiresAt']);
      const fieldError = error instanceof ApiRequestError ? error.errors.file : undefined;
      if (fieldError) setFileError(fieldError);
      else setFormError(message);
    }
  });

  if (offered.length === 0) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return;
        setOpen(next);
        if (!next) {
          reset(defaults);
          setFile(null);
          setFileError(null);
          setFormError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-10">
          <Upload aria-hidden /> Upload document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>
              {own ? 'HR can see it, and so can your manager unless the type is private.' : `For ${employeeName}.`} PDF, PNG, JPEG or Word, up to {formatBytes(MAX_DOCUMENT_BYTES)}.
            </DialogDescription>
          </DialogHeader>
          {formError && <FormAlert tone="error">{formError}</FormAlert>}

          <div className="flex flex-col gap-2">
            <Label htmlFor={fileId}>
              File<span aria-hidden className="text-danger-text">*</span>
            </Label>
            <Input
              id={fileId}
              type="file"
              accept={DOCUMENT_ACCEPT}
              className="h-auto py-2"
              aria-invalid={fileError ? true : undefined}
              aria-describedby={fileError ? `${fileId}-error` : undefined}
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
            />
            {file && !fileError && <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>}
            {fileError && (
              <p id={`${fileId}-error`} className="text-sm text-danger-text">
                {fileError}
              </p>
            )}
          </div>

          <SelectField
            control={control}
            name="documentTypeId"
            label="Type"
            required
            options={offered.map((t) => ({ value: t.id, label: t.name, hint: t.isSensitive ? 'private' : undefined }))}
          />
          <TextField label="Title" required registration={register('title')} error={errors.title} />
          {type?.hasExpiry && <TextField label="Expires on" type="date" required registration={register('expiresAt')} error={errors.expiresAt} />}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || Boolean(fileError)}>
              {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
