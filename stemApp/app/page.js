import { Box, Typography, Container } from '@mui/material';
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
      <Box sx={{ bgcolor: 'primary.dark', color: 'white', py: 5, px: 3, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight={700}>
          STEM Events in Connecticut
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9 }}>
          Discover approved STEM events near you — for students, families, and educators.
        </Typography>
      </Box>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <PublicEventsClient events={events} />
      </Container>
    </Box>
  );
}
