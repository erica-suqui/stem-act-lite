'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@mui/material';

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = () => {
    localStorage.removeItem('userID');
    localStorage.removeItem('role');
    localStorage.removeItem('orgId');
    router.push('/login');
  };

  return (
    <Button variant="outlined" size="small" onClick={handleSignOut}>
      Sign Out
    </Button>
  );
}
