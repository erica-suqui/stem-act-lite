'use client';

import { Grid, Card, CardActionArea, CardContent, Typography } from '@mui/material';

const CARDS = [
  { key: 'total',    filterValue: 'all',      label: 'Total',    color: 'primary.dark' },
  { key: 'pending',  filterValue: 'pending',  label: 'Pending',  color: 'warning.dark' },
  { key: 'approved', filterValue: 'approved', label: 'Approved', color: 'success.dark' },
  { key: 'denied',   filterValue: 'denied',   label: 'Denied',   color: 'error.dark' },
];

export default function StatsCards({ stats, onFilter, activeFilter }) {
  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {CARDS.map(({ key, filterValue, label, color }) => {
        const isActive = activeFilter === filterValue;
        return (
          <Grid item xs={6} sm={3} key={key}>
            <Card
              elevation={isActive ? 4 : 1}
              sx={{ border: isActive ? 2 : 1, borderColor: isActive ? color : 'divider' }}
            >
              <CardActionArea
                onClick={() => onFilter(filterValue)}
                aria-pressed={isActive}
                aria-label={`Filter by ${label} — ${stats[key]} ${label.toLowerCase()} event${stats[key] !== 1 ? 's' : ''}`}
                sx={{ p: 2, textAlign: 'center' }}
              >
                <CardContent sx={{ p: 0 }}>
                  <Typography variant="h4" fontWeight={700} color={color}>
                    {stats[key]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {label}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}
