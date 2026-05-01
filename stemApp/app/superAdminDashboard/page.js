import EventsTable from '../components/EventsTable';
import { Box } from '@mui/material';
import { apiUrl } from '@/lib/api';

export const dynamic = 'force-dynamic';

async function getEvents() {
        const res = await fetch(apiUrl('/api/events'), { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        return data.success ? data.events : [];
}

async function getOrganizations() {
        const res = await fetch(apiUrl('/api/organizations'), { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        return data.success ? data.organizations : [];
}

export default async function Dashboard() {
        const events = await getEvents();
        const organizations = await getOrganizations();

        return (
                <Box sx={{ p: 3 }}>
                        <EventsTable
                                events={JSON.parse(JSON.stringify(events))}
                                organizations={JSON.parse(JSON.stringify(organizations))}
                        />
                </Box>
        );
}
