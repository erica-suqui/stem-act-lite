import { Box, Container, Typography, Paper, Button, Divider, Stack } from '@mui/material';
import Link from 'next/link';

export const metadata = {
  title: 'Become a Partner — STEM-ACT',
};

export default function BecomeAPartnerPage() {
  return (
    <Box component="main" sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 6, px: 2 }}>
        <Container maxWidth="sm">
          <Paper elevation={3} sx={{ p: { xs: 3, sm: 5 } }}>
            <Typography variant="h4" component="h1" fontWeight={700} color="primary.dark" gutterBottom>
              Become a Trusted Partner
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              STEM-ACT trusted partners are schools, universities, nonprofits, and organizations
              that submit STEM events to reach students, families, and educators across Connecticut.
            </Typography>

            <Divider sx={{ mb: 3 }} />

            <Typography variant="h6" fontWeight={700} color="primary.dark" gutterBottom>
              How it works
            </Typography>
            <Stack spacing={2} sx={{ mb: 4 }}>
              <Typography variant="body1">
                <strong>1.</strong> Reach out to STEM-ACT at{' '}
                <a href="mailto:admin@stemact.org" style={{ color: 'inherit' }}>admin@stemact.org</a>
                {' '}to express interest in becoming a partner.
              </Typography>
              <Typography variant="body1">
                <strong>2.</strong> STEM-ACT will review your organization and issue you a partner access code.
              </Typography>
              <Typography variant="body1">
                <strong>3.</strong> Use that code to complete your registration.
              </Typography>
              <Typography variant="body1">
                <strong>4.</strong> Once registered, your account is reviewed by an admin before going live.
              </Typography>
            </Stack>

            <Divider sx={{ mb: 3 }} />

            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              Already have an access code?
            </Typography>
            <Link href="/register" style={{ textDecoration: 'none' }}>
              <Button variant="contained" size="large" fullWidth>
                Complete your registration →
              </Button>
            </Link>
          </Paper>
        </Container>
    </Box>
  );
}
