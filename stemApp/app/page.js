import { Box, Button, Stack, Typography, Container } from '@mui/material';
import Link from 'next/link';
import PublicEventsClient from './components/PublicEventsClient';

async function getApprovedEvents() {
  try {
    const res = await fetch('http://localhost:8000/api/events?status=approved', {
      cache: 'no-store',
    });
    const data = await res.json();
    return data.success ? data.events : [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const events = await getApprovedEvents();
  return (
    <Box>
      <Box sx={{ bgcolor: 'primary.dark', color: 'white', py: 5, px: 3, textAlign: 'center', position: 'relative' }}>
        <Stack direction="row" justifyContent="flex-end" sx={{ position: 'absolute', top: 16, right: 16 }}>
          <Button component={Link} href="/login" variant="outlined" size="small"
            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)', mr: 1, '&:hover': { borderColor: 'white' } }}>
            Sign In
          </Button>
          <Button component={Link} href="/register" variant="contained" size="small"
            sx={{ bgcolor: 'white', color: 'primary.dark', '&:hover': { bgcolor: 'grey.100' } }}>
            Sign Up
          </Button>
        </Stack>
        <Typography variant="h4" component="h1" gutterBottom fontWeight={700}>
          STEM Events in Connecticut
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9 }}>
          Discover approved STEM events near you — for students, families, and educators across Connecticut.
        </Typography>
      </Box>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <PublicEventsClient events={events} />
      </Container>
    </Box>
  );
}
