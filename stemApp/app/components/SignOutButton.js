'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@mui/material';
import { clearStoredAuth } from '@/lib/storage';

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = () => {
    clearStoredAuth();
    router.push('/login');
  };

  return (
    <Button variant="outlined" aria-label = "Log Out of Account"size="small" onClick={handleSignOut}>
      Sign Out
    </Button>
  );
}
