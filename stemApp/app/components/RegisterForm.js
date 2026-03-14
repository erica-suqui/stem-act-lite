'use client';

import React, { useState, useEffect, useCallback } from 'react';
import * as z from "zod";
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { apiUrl } from '@/lib/api';
import EventSubmissionForm from '@/app/components/EventSubmissionForm';
import {
  Box, Card, CardContent, Typography, TextField,
  Button, Alert, Stack, CircularProgress
} from '@mui/material';

export default function RegisterForm(){
    const [formData,setFormData] = useState ({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        orgName: '',
        phone: '',
        partnerCode: '',
    });

    const [errors, setErrors] = useState({})

    const searchParams = useSearchParams();
    const inviteToken = searchParams.get('token');

    const [tokenValid, setTokenValid] = useState(inviteToken ? null : true);
    const [tokenError, setTokenError] = useState('');

    const [registered, setRegistered] = useState(false);
    const [registeredUser, setRegisteredUser] = useState(null);
    const [addingEvents, setAddingEvents] = useState(false);
    const [eventsAdded, setEventsAdded] = useState(0);
    const [formKey, setFormKey] = useState(0);
    const [submitError, setSubmitError] = useState('');
    const [codeStatus, setCodeStatus] = useState(null); // null | 'valid' | 'invalid'
    const [codeMessage, setCodeMessage] = useState('');
    const [codeOrgName, setCodeOrgName] = useState(null); // org name from code, if any

    const registerSchema = z.object({
        firstName: z.string().min(1, "First name required"),
        lastName: z.string().min(1, "Last name required"),
        orgName : z.string().min(1, "Organization Name Required"),
        email: z.string().email("Invalid email address"),
        phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits (no dashes or spaces)"),
        password : z.string().min(8,"Please ensure your password has at least 8 characters").refine((value)=>/[A-Z]/.test(value), {
            message: "Your Password must have a Capital Letter"}).refine((value)=>/[a-z]/.test(value),{
            message:"You must have at least a lowercase letter"}).refine((value)=>/[0-9]/.test(value),{
            message: "You must have at least 1 numerical number"
            }),
        confirmPassword : z.string()
    }).refine(formData => formData.password == formData.confirmPassword, {
        message: "Passwords do not match",
        path: ['confirmPassword']
    });

    useEffect(() => {
        if (!inviteToken) return;
        const controller = new AbortController();
        fetch(apiUrl(`/api/invitations/validate?token=${encodeURIComponent(inviteToken)}`), { signal: controller.signal })
            .then(r => r.json())
            .then(data => {
                if (data.valid) setTokenValid(true);
                else { setTokenValid(false); setTokenError(data.message || 'Invalid invitation link'); }
            })
            .catch(err => {
                if (err.name === 'AbortError') return;
                setTokenValid(false);
                setTokenError('Could not verify invitation. Please try again.');
            });
        return () => controller.abort();
    }, [inviteToken]);

    const navigate = useRouter();

    const handleEventSubmit = useCallback(async (formData) => {
        if (!registeredUser) return { success: false, message: 'Session error' };
        const res = await fetch(apiUrl('/api/events'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...formData,
                org_id: registeredUser.org_id,
                submitted_by_user_id: registeredUser.user_id,
            }),
        });
        const data = await res.json();
        if (data.success) {
            setEventsAdded(prev => prev + 1);
            setFormKey(prev => prev + 1);
        }
        return data;
    }, [registeredUser]);

    const handleCodeBlur = async () => {
        const code = formData.partnerCode.trim();
        if (!code) { setCodeStatus(null); return; }
        try {
            const res = await fetch(apiUrl(`/api/partner-codes/validate?code=${encodeURIComponent(code)}`));
            const data = await res.json();
            if (data.valid) {
                setCodeStatus('valid');
                setCodeMessage('');
                setCodeOrgName(data.org_name || null);
                if (data.org_name) {
                    setFormData(prev => ({ ...prev, orgName: data.org_name }));
                }
            } else {
                setCodeStatus('invalid');
                setCodeMessage(data.message || 'Invalid code');
                setCodeOrgName(null);
            }
        } catch {
            setCodeStatus('invalid');
            setCodeMessage('Could not verify code');
            setCodeOrgName(null);
        }
    };

    const handleChange = (e) => {
        const {name, value} = e.target;
        setFormData(prev => ({...prev, [name]: value}));
        if (name === 'partnerCode' && !value.trim()) {
            setCodeStatus(null);
            setCodeOrgName(null);
            setFormData(prev => ({ ...prev, partnerCode: value, orgName: '' }));
        }
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    }

    const handleFormSubmit = async(e) => {
        e.preventDefault();
        setSubmitError('');
        const userData = registerSchema.safeParse(formData)
        if (!userData.success){
                setErrors(userData.error.format());
                return;
        }

        try {
            const response = await fetch(apiUrl('/api/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    inviteToken: inviteToken || null,
                    partnerCode: formData.partnerCode.trim() || null,
                })
            });
           const data = await response.json();

            if (data.success) {
                setRegisteredUser({ org_id: data.org_id, user_id: data.user_id });
                setRegistered(true);
            } else {
                setSubmitError(data.error || 'Registration failed');
            }
        }
        catch (error) {
            console.error("Error:", error);
            setSubmitError('Something went wrong. Please try again.');
        }
    };

    if (inviteToken && tokenValid === null) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (inviteToken && tokenValid === false) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
                <Card elevation={4} sx={{ maxWidth: 420, width: '100%', p: 2 }}>
                    <CardContent>
                        <Typography variant="h6" color="error" gutterBottom>Invitation Error</Typography>
                        <Alert severity="error">{tokenError}</Alert>
                    </CardContent>
                </Card>
            </Box>
        );
    }

    if (registered && !addingEvents) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
                <Card elevation={4} sx={{ maxWidth: 420, width: '100%', p: 2 }}>
                    <CardContent>
                        <Typography variant="h5" fontWeight={700} color="primary.dark" gutterBottom>
                            Registration Successful!
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 3 }}>
                            Would you like to submit an event now?
                        </Typography>
                        <Stack direction="row" spacing={2}>
                            <Button variant="contained" onClick={() => setAddingEvents(true)}>
                                Yes, submit an event
                            </Button>
                            <Button variant="outlined" onClick={() => navigate.push('/partner')}>
                                No, go to dashboard
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
            </Box>
        );
    }

    if (addingEvents) {
        return (
            <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: 2, py: 4 }}>
                <Box sx={{ maxWidth: 700, mx: 'auto' }}>
                    <Typography variant="h5" fontWeight={700} color="primary.dark" gutterBottom>
                        Submit Event(s)
                    </Typography>
                    {eventsAdded > 0 && (
                        <Alert severity="success" sx={{ mb: 2 }}>{eventsAdded} event(s) added.</Alert>
                    )}
                    <EventSubmissionForm key={formKey} onSubmit={handleEventSubmit} submitLabel="Add Event" />
                    {eventsAdded > 0 && (
                        <Button
                            variant="contained"
                            onClick={() => navigate.push('/partner')}
                            sx={{ mt: 2 }}
                        >
                            Done — Go to Dashboard
                        </Button>
                    )}
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', bgcolor: 'background.default', px: 2, py: 4,
        }}>
            <Card elevation={4} sx={{ width: '100%', maxWidth: 480, p: 2 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                        <Button size="small" variant="text" onClick={() => navigate.push('/')}>✕ Exit</Button>
                    </Box>
                    <Typography variant="h5" align="center" fontWeight={700} color="primary.dark" gutterBottom>
                        Partner Registration
                    </Typography>
                    <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
                        Create your organization account
                    </Typography>
                    <Box component="form" onSubmit={handleFormSubmit} noValidate>
                        <Stack spacing={2}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    label="First Name"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    fullWidth
                                    required
                                    error={Boolean(errors.firstName)}
                                    helperText={errors.firstName?._errors?.[0]}
                                />
                                <TextField
                                    label="Last Name"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    fullWidth
                                    required
                                    error={Boolean(errors.lastName)}
                                    helperText={errors.lastName?._errors?.[0]}
                                />
                            </Stack>
                            <TextField
                                label="Organization Name"
                                name="orgName"
                                value={formData.orgName}
                                onChange={handleChange}
                                fullWidth
                                required={!codeOrgName}
                                error={Boolean(errors.orgName)}
                                helperText={
                                    codeOrgName
                                        ? `Joining: ${codeOrgName} — your account will be activated immediately`
                                        : errors.orgName?._errors?.[0]
                                }
                                inputProps={{ readOnly: Boolean(codeOrgName) }}
                                color={codeOrgName ? 'success' : undefined}
                                focused={codeOrgName ? true : undefined}
                            />
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
                                label="Phone (10 digits)"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                fullWidth
                                required
                                error={Boolean(errors.phone)}
                                helperText={errors.phone?._errors?.[0]}
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
                                helperText={errors.password?._errors?.[0] || 'Min 8 chars, 1 uppercase, 1 lowercase, 1 number'}
                            />
                            <TextField
                                label="Confirm Password"
                                name="confirmPassword"
                                type="password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                fullWidth
                                required
                                error={Boolean(errors.confirmPassword)}
                                helperText={errors.confirmPassword?._errors?.[0]}
                            />
                            <TextField
                                label="Partner Access Code (optional)"
                                name="partnerCode"
                                value={formData.partnerCode}
                                onChange={handleChange}
                                onBlur={handleCodeBlur}
                                fullWidth
                                helperText={
                                    codeStatus === 'valid'
                                        ? codeOrgName
                                            ? `✓ Valid code — you will join ${codeOrgName}`
                                            : '✓ Valid code — your account will be activated immediately'
                                        : codeStatus === 'invalid' ? codeMessage
                                        : 'If you have an access code, enter it here'
                                }
                                error={codeStatus === 'invalid'}
                                color={codeStatus === 'valid' ? 'success' : undefined}
                                focused={codeStatus === 'valid' ? true : undefined}
                                inputProps={{ style: { textTransform: 'uppercase' } }}
                            />
                            {submitError && <Alert severity="error">{submitError}</Alert>}
                            <Button type="submit" variant="contained" fullWidth size="large">
                                Register
                            </Button>
                        </Stack>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}
