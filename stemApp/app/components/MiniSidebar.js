'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Tooltip, Divider, Box
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import { clearStoredAuth } from '@/lib/storage';

const COLLAPSED_WIDTH = 65;
const EXPANDED_WIDTH = 240;

const NAV_ITEMS = [
  { label: 'Event Submissions', icon: <DashboardIcon />, href: '/superAdminDashboard' },
  { label: 'Partners',          icon: <BusinessIcon />,  href: '/partners' },
  { label: 'Users',             icon: <PeopleIcon />,    href: '/users' },
];

export default function MiniSidebar({ children }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    clearStoredAuth();
    router.push('/login');
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="permanent"
        aria-label="Main navigation"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        sx={{
          width: open ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          transition: 'width 0.2s ease',
          '& .MuiDrawer-paper': {
            width: open ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
            transition: 'width 0.2s ease',
            overflowX: 'hidden',
            bgcolor: 'primary.dark',
            color: 'white',
            border: 'none',
          },
        }}
      >
        <Toolbar />
        <List sx={{ pt: 1 }}>
          {NAV_ITEMS.map(({ label, icon, href }) => {
            const active = pathname === href;
            return (
              <Tooltip key={href} title={open ? '' : label} placement="right">
                <ListItemButton
                  onClick={() => router.push(href)}
                  selected={active}
                  sx={{
                    minHeight: 48,
                    justifyContent: open ? 'initial' : 'center',
                    px: 2.5,
                    color: 'white',
                    '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.15)' },
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  <ListItemIcon sx={{ color: 'white', minWidth: 0, mr: open ? 2 : 'auto', justifyContent: 'center' }}>
                    {icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={label}
                    sx={{ opacity: open ? 1 : 0, transition: 'opacity 0.2s', color: 'white' }}
                  />
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', mt: 'auto' }} />
        <Tooltip title={open ? '' : 'Logout'} placement="right">
          <ListItemButton
            onClick={handleLogout}
            aria-label="Logout"
            sx={{
              minHeight: 48,
              justifyContent: open ? 'initial' : 'center',
              px: 2.5,
              color: 'white',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <ListItemIcon sx={{ color: 'white', minWidth: 0, mr: open ? 2 : 'auto', justifyContent: 'center' }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText
              primary="Logout"
              sx={{ opacity: open ? 1 : 0, transition: 'opacity 0.2s', color: 'white' }}
            />
          </ListItemButton>
        </Tooltip>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
