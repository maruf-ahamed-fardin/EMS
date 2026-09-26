import { redirect } from 'next/navigation';
import { HOME_PATH } from '@/lib/client/auth-paths';

export default function Home() {
  redirect(HOME_PATH);
}
