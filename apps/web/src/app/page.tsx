import { redirect } from 'next/navigation';
import { HOME_PATH } from '@/lib/auth-paths';

export default function Home() {
  redirect(HOME_PATH);
}
