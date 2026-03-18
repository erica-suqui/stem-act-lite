'use client'
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiUrl } from '@/lib/api';

import { CardContent, Card, Box, Button,Typography,
        CircularProgress, Alert}  
    from '@mui/material'


export default function VerifiedEmail(){
    const [ verified, setVerified ] = useState (false);
    const [ loading, setLoading ] = useState(true);
    const [error,setError ] = useState('');

    const searchParams = useSearchParams();;
    const verificationToken = searchParams.get('token');

    const router = useRouter();

    useEffect(() => {
    if(!verificationToken){
        setError('Invalid Vertification Link');
        setLoading(false);
        return;
    }

    fetch(apiUrl(`/api/verify-email?token=${encodeURIComponent(verificationToken)}`))
    .then(res => res.json())
    .then(data => {
        if (data.valid) {
            setVerified(true);
        } else {
            setError(data.message || 'Verification failed');
        }
    })
    .catch(() => setError('Something went wrong'))
    .finally(() => setLoading(false));
    }, [verificationToken]);

    if (loading) return < CircularProgress size="3rem"/>;

    return (
        <Box sx={{
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', bgcolor: 'background.default', px: 2, py: 4,
        }}>
            <Card elevation={4} sx={{ width: '100%', maxWidth: 420, p: 2 }}>
            <CardContent>
                { verified ?(
                    <>
                    <Typography variant="h5" fontWeight={700} color="primary.dark" gutterBottom>
                    Your email has been verified!
                   </Typography>
                   <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Your account is pending admin approval.
                    </Typography>
                    <Button variant="contained" fullWidth onClick={() => router.push('/login')}>
                        Go to Login
                    </Button>
                    </>
                ) :(
                    <Alert severity="error">
                        {error ||  'Vertification failed'}
                    </Alert>

                ) }

                </CardContent>
            </Card>
        </Box>
    );
}
