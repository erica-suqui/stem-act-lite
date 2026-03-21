import { Suspense } from 'react';
import VerifiedEmail from '../components/VerifyEmail';

export default function VerifyEmailPage() {
    return (
        <Suspense>
            <VerifiedEmail />
        </Suspense>
    );
    }