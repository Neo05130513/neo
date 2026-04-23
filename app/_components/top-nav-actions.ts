'use server';

import { logoutCurrentUser } from '@/lib/auth';

export async function logoutAction() {
  await logoutCurrentUser();
}

