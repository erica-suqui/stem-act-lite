'use client';
import { AppBar, Toolbar, Typography } from '@mui/material';
import Link from 'next/link';

export default function PublicAppBar() {
  return (
    <AppBar position="static" aria-label = "Public navigation" sx={{ bgcolor: 'primary.dark' }}>
      <Toolbar>
        <Typography
          variant="h6"
          component={Link}
          href="/"
          sx={{ flexGrow: 1, color: 'white', textDecoration: 'none', fontWeight: 700 }}
        >
          STEM-ACT
        </Typography>
      </Toolbar>
    </AppBar>
  );
}
