'use client';
import { useState, useMemo } from 'react';
import {
  Box, Grid, Card, CardContent, CardActions, Typography,
  Button, Select, MenuItem, FormControl, InputLabel, Chip, Stack
} from '@mui/material';
import Link from 'next/link';

const CT_COUNTIES = ['Fairfield','Hartford','Litchfield','Middlesex','New Haven','New London','Tolland','Windham'];

export default function PublicEventsClient({ events }) {
  const [county, setCounty] = useState('');
  const [audience, setAudience] = useState('');

  const audiences = useMemo(() => {
    const vals = events.map(e => e.audience).filter(Boolean);
    return [...new Set(vals)].sort();
  }, [events]);

  const filtered = useMemo(() => events.filter(e => {
    if (county && e.county !== county) return false;
    if (audience && e.audience !== audience) return false;
    return true;
  }), [events, county, audience]);

  const clearFilters = () => { setCounty(''); setAudience(''); };
  const hasFilters = county || audience;

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" mb={3}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="county-label">County</InputLabel>
          <Select
            labelId="county-label"
            value={county}
            label="County"
            onChange={e => setCounty(e.target.value)}
          >
            <MenuItem value="">All Counties</MenuItem>
            {CT_COUNTIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="audience-label">Audience</InputLabel>
          <Select
            labelId="audience-label"
            value={audience}
            label="Audience"
            onChange={e => setAudience(e.target.value)}
          >
            <MenuItem value="">All Audiences</MenuItem>
            {audiences.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
          </Select>
        </FormControl>

        {hasFilters && (
          <Button variant="text" onClick={clearFilters}>Clear Filters</Button>
        )}

        <Typography
          variant="body2"
          color="text.secondary"
          aria-live="polite"
          aria-atomic="true"
          sx={{ ml: 'auto' }}
        >
          {filtered.length} {filtered.length === 1 ? 'event' : 'events'} found
        </Typography>
      </Stack>

      {filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary">
            No events found. Try clearing the filters.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filtered.map(event => (
            <Grid item xs={12} sm={6} md={4} key={event.event_id}>
              <Card elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom sx={{ lineHeight: 1.3 }}>
                    {event.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {event.start_datetime
                      ? new Date(event.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Date TBD'
                    } · {event.city}, {event.county}
                  </Typography>
                  {event.cost && (
                    <Chip label={event.cost} size="small" sx={{ mb: 1 }} />
                  )}
                  <Typography variant="body2" sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {event.description}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={!event.hyperlink}
                    component={event.hyperlink ? Link : 'button'}
                    href={event.hyperlink || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`More Info: ${event.title}`}
                  >
                    More Info
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </>
  );
}
