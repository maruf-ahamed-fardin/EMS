import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-header';
import { ChangePasswordCard, SignOutOthersCard } from './security-forms';

export const metadata: Metadata = { title: 'Password & sign-in' };

export default function SecurityPage() {
  return (
    <>
      <PageHeader title="Password & sign-in" description="Change your password and manage where you're signed in." />
      <div className="grid grid-cols-1 max-w-2xl gap-6">
        <ChangePasswordCard />
        <SignOutOthersCard />
      </div>
    </>
  );
}
