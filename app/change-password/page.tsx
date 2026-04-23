import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ChangePasswordForm } from './change-password-form';

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.mustChangePassword) redirect('/');

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at top left, rgba(56,189,248,0.14) 0%, transparent 24%), linear-gradient(180deg, #050816 0%, #0b1120 100%)', color: '#f8fafc', padding: 24 }}>
      <ChangePasswordForm />
    </main>
  );
}
