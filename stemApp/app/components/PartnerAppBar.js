'use client';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useRouter } from 'next/navigation';

export default function PartnerAppBar() {
  const router = useRouter();
  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  return (
    <AppBar position="static" sx={{ bgcolor: 'primary.dark' }}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1, color: 'white', fontWeight: 700 }}>
          STEM-ACT
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)' }}>
            My Events
          </Typography>
          <Button
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
            sx={{ color: 'white' }}
          >
            Logout
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
