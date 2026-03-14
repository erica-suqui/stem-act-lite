'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LogoutPage() {
    const router = useRouter();

    useEffect(() => {
        fetch('/api/logout', { method: 'POST' })
            .then(() => {
                setTimeout(() => {
                    router.push('/login');
                }, 2000);
            });
    }, []);

    return (
        <div style={{ textAlign: 'center', marginTop: '4rem' }}>
            <h2>Successfully Logged Out</h2>
            <p>Redirecting to login...</p>
        </div>
    );
}