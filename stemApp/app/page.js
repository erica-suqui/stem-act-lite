import { Box, Button, Stack, Typography, Container } from '@mui/material';
import Link from 'next/link';
import PublicEventsClient from './components/PublicEventsClient';
import { apiUrl } from '../lib/api';

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
      <Box sx={{ bgcolor: 'primary.dark', color: 'white', pt: '8px', pb: 2, px: 3, textAlign: 'center', position: 'relative' }}>
        <Stack direction="row" sx={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 16 }} spacing={1}>
          <Link href="/submit" style={{ textDecoration: 'none' }}>
            <Button variant="outlined" size="small"
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: 'white' } }}>
              Submit an Event
            </Button>
          </Link>
          <Link href="/register" style={{ textDecoration: 'none' }}>
            <Button variant="outlined" size="small"
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: 'white' } }}>
              Become a Partner
            </Button>
          </Link>
        </Stack>
        <Stack direction="row" sx={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 16 }} spacing={1}>
          <Link href="/login" style={{ textDecoration: 'none' }}>
            <Button variant="outlined" size="small"
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: 'white' } }}>
              Sign In
            </Button>
          </Link>
          <Link href="/become-a-partner" style={{ textDecoration: 'none' }}>
            <Button variant="contained" size="small"
              sx={{ bgcolor: 'white', color: 'primary.dark', '&:hover': { bgcolor: 'grey.100' } }}>
              Become a Partner
            </Button>
          </Link>
        </Stack>
        <Typography variant="h4" component="h1" fontWeight={700}>
          STEM Events in Connecticut
        </Typography>
      </Box>
      <Typography variant="body1" sx={{ color: 'primary.dark', textAlign: 'center', py: 1.5, px: 3 }}>
        Discover approved STEM events near you — for students, families, and educators across Connecticut.
      </Typography>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <PublicEventsClient events={events} />
      </Container>
    </Box>
  );
}
