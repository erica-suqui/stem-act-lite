'use client';
import { usePathname } from 'next/navigation';
import { AppBar, Toolbar, Typography, Box } from '@mui/material';
import RouteGuard from './RouteGuard';
import PublicAppBar from './PublicAppBar';
import MiniSidebar from './MiniSidebar';
import PartnerAppBar from './PartnerAppBar';

// No nav at all
const NO_NAV_ROUTES = new Set(['/submit', '/']);

// Public layout (PublicAppBar, no auth)
const PUBLIC_ROUTES = new Set(['/login', '/register', '/verify-email', '/become-a-partner']);

// Partner layout (PartnerAppBar, RouteGuard)
const PARTNER_ROUTES = new Set(['/partner']);

// Everything else = admin layout (AppBar + MiniSidebar, RouteGuard)

export default function AdminNav({ children }) {
  const pathname = usePathname();

  if (NO_NAV_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  if (PUBLIC_ROUTES.has(pathname)) {
    return (
      <>
        <PublicAppBar />
        {children}
      </>
    );
  }

  if (PARTNER_ROUTES.has(pathname)) {
    return (
      <RouteGuard>
        <PartnerAppBar />
        <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
          {children}
        </Box>
      </RouteGuard>
    );
  }

  // Admin layout
  return (
    <RouteGuard>
      <AppBar position="fixed" component="header" aria-label="Admin navigation" sx={{ bgcolor: 'primary.dark', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6"  component="h1"  sx={{ color: 'white', fontWeight: 700 }}>
            STEM-ACT
          </Typography>
        </Toolbar>
      </AppBar>
      <MiniSidebar>{children}</MiniSidebar>
    </RouteGuard>
  );
}
