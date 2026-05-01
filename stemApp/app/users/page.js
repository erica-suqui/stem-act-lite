import UsersTable from './UsersTable';
import PartnerCodesAdmin from '../components/PartnerCodesAdmin';
import { Box, Typography, Divider } from '@mui/material';
import { apiUrl } from '@/lib/api';

export const metadata = {
        title: 'User Management — STEM-ACT Admin',
};

export const dynamic = 'force-dynamic';

async function getUsers() {
        const res = await fetch(apiUrl('/api/users'), { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        return data.success ? data.users : [];
}

export default async function UsersPage() {
        const users = await getUsers();

        return (
                <Box sx={{ p: 3 }}>
                        <Typography variant="h5" fontWeight={700} color="primary.dark" gutterBottom>
                                User Management
                        </Typography>
                        <UsersTable users={users} />
                        <Divider sx={{ my: 4 }} />
                        <PartnerCodesAdmin />
                </Box>
        );
}
