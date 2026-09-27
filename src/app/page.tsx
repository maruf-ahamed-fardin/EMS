import { getAllTeamMembers } from '@/lib/team';
import MemberDirectory from '@/components/MemberDirectory';

export default async function HomePage() {
  const members = await getAllTeamMembers();

  return <MemberDirectory initialMembers={members} />;
}
