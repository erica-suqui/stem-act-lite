import PartnersTable from './PartnersTable';
import { Box, Typography } from '@mui/material';
import { apiUrl } from '@/lib/api';

export const metadata = {
        title: 'Partner Organizations — STEM-ACT Admin',
};

export const dynamic = 'force-dynamic';

async function getOrganizations() {
        const res = await fetch(apiUrl('/api/organizations'), { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        if (!data.success) return [];
        return data.organizations.map(org => ({
                ...org,
                contact_name: [org.contact_first_name, org.contact_last_name].filter(Boolean).join(' ').trim(),
                event_count: Number(org.event_count || 0),
                pending_count: Number(org.pending_count || 0),
                approved_count: Number(org.approved_count || 0),
                denied_count: Number(org.denied_count || 0),
        }));
}

export default async function PartnersPage() {
        const organizations = await getOrganizations();

        return (
                <Box sx={{ p: 3 }}>
                        <Typography variant="h5" fontWeight={700} color="primary.dark" gutterBottom>
                                Partner Organizations
                        </Typography>
                        <PartnersTable organizations={organizations} />
                </Box>
        );
}
