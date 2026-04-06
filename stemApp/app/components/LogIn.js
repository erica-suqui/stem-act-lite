'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState } from 'react';
import * as z from 'zod';
import { apiUrl } from '@/lib/api';
import {
  Box, Card, CardContent, Checkbox, Typography, TextField,
  Button, Alert, Stack, FormControlLabel
} from '@mui/material';

import Link from 'next/link';


export default function LogIn(){

    const [formData,setFormData] = useState ({
        email: '',
        password: '',
    });

    const [errors, setErrors] = useState({})
    const router = useRouter();
    const searchParams = useSearchParams();
    const justReset = searchParams.get('reset') === '1';
    const [loginError, setLoginError] = useState('');
    const LogInSchema = z.object({
        email: z.string().email().min(1,"Missing Email"),
        password: z.string().min(1,"Missing Password")
    });

    const [rememberMe, setRememberMe] = useState(false);

    const handleChange = (e) => {
        const {name,value } = e.target;
        setFormData(prev => ({...prev,[name]: value}))

        if (loginError) setLoginError('');
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    }

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const userData = LogInSchema.safeParse(formData)

        if (!userData.success){
            setErrors(userData.error.format());
            return;
        }

        try{
            const response = await fetch(apiUrl('/api/login'),{
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                const storage = rememberMe ? localStorage : sessionStorage;
                storage.setItem('userID', data.userID);
                storage.setItem('role', data.role);
                storage.setItem('orgId', data.orgId);
                const roleRoutes = {
                    partner: '/partner',
                    admin: '/superAdminDashboard',
                    super_admin: '/superAdminDashboard',
                };
                const targetRoute = roleRoutes[data.role] || '/';
                router.push(targetRoute);
            }
            else{
                setLoginError(data.error || 'Login failed');
            }
        }
        catch(error){
            console.error("Error:", error);
            setLoginError("Something went wrong");
        }

       
    };




    return (
      <Box component = "main" sx={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', bgcolor: 'background.default', px: 2,
      }}>
        <Card elevation={4} sx={{ width: '100%', maxWidth: 420, p: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
              <Button size="small" variant="text" aria-label="Exit login" onClick={() => router.push('/')}>✕ Exit</Button>
            </Box>
            <Typography variant="h5" component = "h1"align="center" fontWeight={700} color="primary.dark" gutterBottom>
              Sign In
            </Typography>
            <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
              STEM-ACT
            </Typography>
            {justReset && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Password reset successfully. Please log in.
              </Alert>
            )}
            <Box component="form" onSubmit={handleFormSubmit} noValidate>
              <Stack spacing={2}>
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  fullWidth
                  required
                  error={Boolean(errors.email)}
                  helperText={errors.email?._errors?.[0]}
                />
                <TextField
                  label="Password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  fullWidth
                  required
                  error={Boolean(errors.password)}
                  helperText={errors.password?._errors?.[0]}
                />
                {loginError && <Alert severity="error">{loginError}</Alert>}
                <FormControlLabel
                    control={
                        <Checkbox 
                            checked={rememberMe}
                            onChange={e => setRememberMe(e.target.checked)}
                        />
                    }
                    label="Remember Me"
                />

                <Button type="submit" variant="contained" fullWidth size="large">
                  Log In
                </Button>
        
                <Typography variant="body2" align="center" color="text.secondary">
                  <Link href="/forgot-password" style={{ color: 'inherit' }}>Forgot password?</Link>
                </Typography>
                <Typography variant="body2" align="center" color="text.secondary">
                  Not registered?{' '}
                  <Link href="/register" style={{ color: 'inherit' }}>Register here</Link>
                </Typography>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
}

