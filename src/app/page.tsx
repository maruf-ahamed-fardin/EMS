import { getAllTeamMembers } from '@/lib/team';
import MemberDirectory from '@/components/MemberDirectory';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const members = await getAllTeamMembers();

  return <MemberDirectory initialMembers={members} />;
}
