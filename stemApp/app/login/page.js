import { Suspense } from 'react';
import LogIn from '../components/LogIn';

export default function LogInPage() {
  return (
    <Suspense>
      <LogIn />
    </Suspense>
  );
}
