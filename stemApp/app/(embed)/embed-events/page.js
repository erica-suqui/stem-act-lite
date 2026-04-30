import { Box, Container } from '@mui/material';
import PublicEventsClient from '../../components/PublicEventsClient';
import { apiUrl } from '@/lib/api';

async function getApprovedEvents() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(apiUrl('/api/events?status=approved'), {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.success ? data.events : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export default async function HomePage() {
  const events = await getApprovedEvents();
  return (
    <Box component="main">

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <PublicEventsClient events={events} />
      </Container>
    </Box>
  );
}
