'use client';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import Link from 'next/link';

export default function PublicAppBar() {
  return (
    <AppBar position="static" sx={{ bgcolor: 'primary.dark' }}>
      <Toolbar>
        <Typography
          variant="h6"
          component={Link}
          href="/"
          sx={{ flexGrow: 1, color: 'white', textDecoration: 'none', fontWeight: 700 }}
        >
          STEM-ACT
        </Typography>
        <Button
          component={Link}
          href="/submit"
          variant="outlined"
          sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: 'white' } }}
        >
          Submit an Event
        </Button>
      </Toolbar>
    </AppBar>
  );
}
