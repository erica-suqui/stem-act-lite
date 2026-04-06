'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Box, Grid, Card, CardContent, CardActions, CardMedia, Typography,
  Button, Select, MenuItem, FormControl, InputLabel, Chip, Stack,
  Tabs, Tab, TextField, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const EventsMap = dynamic(() => import('./EventsMap'), { ssr: false });

const CT_COUNTIES = [
  'Fairfield','Hartford','Litchfield','Middlesex',
  'New Haven','New London','Tolland','Windham',
];

function isImageUrl(url) {
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
}

export default function PublicEventsClient({ events }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [liveEvents, setLiveEvents] = useState(events);
  const [county, setCounty] = useState('');
  const [audience, setAudience] = useState('');
  const [tab, setTab] = useState(0);
  const [cost, setCost] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(dayjs());
  const [endDate, setEndDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setLiveEvents(events); }, [events]);

  useEffect(() => {
    function refreshPageData() { router.refresh(); }
    const intervalId = window.setInterval(refreshPageData, 15000);
    window.addEventListener('focus', refreshPageData);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshPageData);
    };
  }, [router]);

  const audiences = useMemo(() => {
    const vals = liveEvents.map(e => e.audience).filter(Boolean);
    return [...new Set(vals)].sort();
  }, [liveEvents]);

  const filtered = useMemo(() => liveEvents.filter(e => {
    if (county && e.county !== county) return false;
    if (audience && e.audience !== audience) return false;
    if (search && !e.title?.toLowerCase().includes(search)
      && !e.description?.toLowerCase().includes(search)
      && !e.city?.toLowerCase().includes(search)) return false;
    if (startDate && dayjs(e.start_datetime).isBefore(startDate, 'day')) return false;
    if (endDate && dayjs(e.start_datetime).isAfter(endDate, 'day')) return false;
    if (cost === 'Free' && e.cost !== 'Free') return false;
    if (cost === 'Paid' && e.cost === 'Free') return false;
    return true;
  }), [liveEvents, county, audience, search, cost, startDate, endDate]);

  const clearFilters = () => {
    setCounty(''); setAudience(''); setSearch('');
    setCost(''); setStartDate(dayjs()); setEndDate(null);
  };
  const hasFilters = county || audience || search || cost || endDate;

  return (
    <Box sx={{ position: 'relative' }}>
      <Tabs value={tab} aria-label="Event display options" onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Cards" />
        <Tab label="Map" />
      </Tabs>

      {mounted && (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            mb={3}
            sx={{ position: 'relative', zIndex: 10 }}
          >
            <TextField
              label="Search"
              size="small"
              value={search}
              onChange={e => setSearch(e.target.value)}
              sx={{ minWidth: 180, flexGrow: 1 }}
            />
            <DatePicker
              label="From"
              value={startDate}
              onChange={(newValue) => setStartDate(newValue)}
              disablePast
              slotProps={{
                textField: { size: 'small', sx: { width: 160 } },
                popper: { sx: { zIndex: 9999 } }
              }}
            />
            <DatePicker
              label="To"
              value={endDate}
              onChange={(newValue) => setEndDate(newValue)}
              minDate={startDate || dayjs()}
              slotProps={{
                textField: { size: 'small', sx: { width: 160 } },
                popper: { sx: { zIndex: 9999 } }
              }}
            />
            <FormControl size="small" sx={{ width: 150 }}>
              <InputLabel id="county-label">County</InputLabel>
              <Select labelId="county-label" value={county} label="County"onChange={e => {
                    setCounty(e.target.value);
                    if (e.target.value) setTab(1);
                  }}>
                <MenuItem value="">All Counties</MenuItem>
                {CT_COUNTIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ width: 120 }}>
              <InputLabel id="cost-label">Cost</InputLabel>
              <Select labelId="cost-label" value={cost} label="Cost" onChange={e => setCost(e.target.value)}>
                <MenuItem value="">Any</MenuItem>
                <MenuItem value="Free">Free</MenuItem>
                <MenuItem value="Paid">Paid</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ width: 150 }}>
              <InputLabel id="audience-label">Audience</InputLabel>
              <Select labelId="audience-label" value={audience} label="Audience" onChange={e => setAudience(e.target.value)}>
                <MenuItem value="">All Audiences</MenuItem>
                {audiences.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
              </Select>
            </FormControl>
            {hasFilters && (
              <Button variant="text" aria-label="Clear all filters" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
            <Typography
              variant="body2"
              color="text.secondary"
              aria-live="polite"
              aria-atomic="true"
              sx={{ whiteSpace: 'nowrap' }}
            >
              {filtered.length} {filtered.length === 1 ? 'event' : 'events'} found
            </Typography>
          </Stack>
        </LocalizationProvider>
      )}

      {tab === 0 && (
        filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography color="text.secondary">No events found. Try clearing the filters.</Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {filtered.map(event => (
              <Grid item xs={12} sm={6} md={4} key={event.event_id}>
                <Card
                  elevation={2}
                  sx={{
                    height: '100%', display: 'flex', flexDirection: 'column',
                    cursor: 'pointer',
                    '&:hover': { boxShadow: 6 },
                    transition: 'box-shadow 0.2s',
                  }}
                  onClick={() => setSelectedEvent(event)}
                >
                  {event.flyer_url && (
                    isImageUrl(event.flyer_url) ? (
                      <CardMedia
                        component="img"
                        height="160"
                        image={event.flyer_url}
                        alt={`Flyer for ${event.title}`}
                        sx={{ objectFit: 'cover' }}
                      />
                    ) : (
                      // TODO: When backend thumbnail generation is available, replace this placeholder
                      // with an <img> from a server-side endpoint e.g. GET /api/events/:id/flyer-thumbnail
                      // that renders the first page of the PDF as an image (e.g. using pdf2pic or Puppeteer).
                      <Box
                        sx={{
                          height: 160,
                          bgcolor: 'grey.100',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 1,
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <PictureAsPdfIcon sx={{ fontSize: 40, color: 'grey.400' }} />
                        <Typography variant="caption" color="text.secondary">PDF Flyer</Typography>
                      </Box>
                    )
                  )}
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="h2" gutterBottom sx={{ lineHeight: 1.3 }}>
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
                    {event.event_type && (
                      <Chip label={event.event_type} size="small" variant="outlined" sx={{ mb: 1, ml: event.cost ? 1 : 0 }} />
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
                      aria-label={`More Info: ${event.title}`}
                      onClick={e => { e.stopPropagation(); setSelectedEvent(event); }}
                    >
                      More Info
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )
      )}

      <Dialog
        open={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        scroll="paper"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{selectedEvent?.title}</DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" flexWrap="wrap" spacing={1} sx={{ mb: 2 }}>
            <Chip
              label={selectedEvent?.start_datetime
                ? new Date(selectedEvent.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Date TBD'}
              color="primary"
              size="small"
            />
            <Chip
              label={selectedEvent?.start_datetime
                ? `${new Date(selectedEvent.start_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}${selectedEvent?.end_datetime ? ` – ${new Date(selectedEvent.end_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : ''}`
                : 'Time TBD'}
              color="secondary"
              size="small"
            />
            {selectedEvent?.audience && <Chip label={selectedEvent.audience} color="info" size="small" />}
            {selectedEvent?.cost && <Chip label={selectedEvent.cost} color="success" size="small" />}
          </Stack>

          <Typography variant="body2" paragraph>{selectedEvent?.description}</Typography>

          {selectedEvent?.address && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Address:</strong> {selectedEvent.address}, {selectedEvent?.city}, CT
            </Typography>
          )}
          {selectedEvent?.event_type && (
            <Typography variant="body2"><strong>Type:</strong> {selectedEvent.event_type}</Typography>
          )}
          {selectedEvent?.flyer_url && (
            <Typography variant="body2">
              <strong>Flyer:</strong>{' '}
              <a href={selectedEvent.flyer_url} target="_blank" rel="noopener noreferrer">
                View Flyer
              </a>
            </Typography>
          )}
          {selectedEvent?.event_contact && (
            <Typography variant="body2">
              <strong>Contact:</strong>{' '}
              <Link href={`mailto:${selectedEvent.event_contact}`}>
                {selectedEvent.event_contact}
              </Link>
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          {selectedEvent?.hyperlink && (
            <Button
              component={Link}
              aria-label={`Visit event page for ${selectedEvent?.title} (opens in new tab)`}
              href={selectedEvent.hyperlink}
              target="_blank"
              rel="noopener noreferrer"
              variant="contained"
            >
              Event Link
            </Button>
          )}
          <Button onClick={() => setSelectedEvent(null)} aria-label="Close event details">Close</Button>
        </DialogActions>
      </Dialog>

      {tab === 1 && <EventsMap events={filtered} county={county} setCounty={setCounty} onSelectEvent={setSelectedEvent}/>}
    </Box>
  );
}