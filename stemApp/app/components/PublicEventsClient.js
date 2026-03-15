'use client';
import { useState, useMemo } from 'react';
import {
  Box, Grid, Card, CardContent, CardActions,Typography,
  Button, Select, MenuItem, FormControl, InputLabel, Chip, Stack,
  Tabs, Tab, TextField, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';

import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const EventsMap = dynamic(() => import('./EventsMap'), { ssr: false });

const CT_COUNTIES = [
  'Fairfield','Hartford','Litchfield','Middlesex',
  'New Haven','New London','Tolland','Windham',
];

export default function PublicEventsClient({ events }) {
  const [county, setCounty] = useState('');
  const [audience, setAudience] = useState('');
  const [tab, setTab] = useState(0); // 0 = Cards, 1 = Map
  const [cost, setCost] = useState ('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(dayjs());
  const [endDate, setEndDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);


  const audiences = useMemo(() => {
    const vals = events.map(e => e.audience).filter(Boolean);
    return [...new Set(vals)].sort();
  }, [events]);

  const filtered = useMemo(() => events.filter(e => {

    if (county && e.county !== county) return false;
    if (audience && e.audience !== audience) return false;

    if (search && !e.title?.toLowerCase().includes(search)
      && !e.description?.toLowerCase().includes(search) 
      && !e.city?.toLowerCase().includes(search) ) return false;

    if (startDate && dayjs(e.start_datetime).isBefore(startDate, 'day')) return false;
    if (endDate && dayjs(e.start_datetime).isAfter(endDate, 'day')) return false; 
    
    if (cost === 'Free' && e.cost !== 'Free') return false;
    if (cost === 'Paid' && e.cost === 'Free') return false;
    return true;
  }), [events, county, audience, search, cost, startDate, endDate ]);

  const clearFilters = () => { setCounty(''); setAudience(''); setSearch(''); setCost(''); setStartDate(dayjs()); setEndDate(null)};
  const hasFilters = county || audience || search || cost || startDate || endDate;


  console.log('selected event:', selectedEvent);

  return (
    <Box sx={{ position: 'relative' }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Cards" />
        <Tab label="Map" />
      </Tabs>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
      
      <DatePicker
        label="From"
        value={startDate}
        onChange={(newValue) => setStartDate(newValue)}
        disablePast
        slotProps={{ textField: { size: 'small' }, popper: { sx: { zIndex: 9999 } }}}
      />
      <DatePicker
        label="To"
        value={endDate}
        onChange={(newValue) => setEndDate(newValue)}
        minDate={startDate || dayjs()}
        slotProps={{ textField: { size: 'small' }, popper: { sx: { zIndex: 9999 }}}}
      />
    </LocalizationProvider>
    </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} 
        spacing={2} 
        alignItems="center" 
        mb={3}
        sx={{ position: 'relative', zIndex: 10 }}>
        <Box sx={{ width: 500, maxWidth: '100%' }}>
        <TextField fullWidth 
          label="Search" 
          id="fullWidth"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        </Box>
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
          <InputLabel id="cost-label">Cost</InputLabel>
          <Select
            labelId="cost-label"
            value={cost}
            label="Cost"
            onChange={e => setCost(e.target.value)}
          >
            <MenuItem value="">Any</MenuItem>
            <MenuItem value = "Free">Free</MenuItem>
            <MenuItem value = "Paid">Paid</MenuItem>
        
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

      {tab === 0 && (
        filtered.length === 0 ? (
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
                      aria-label={`More Info: ${event.title}`}
                      onClick={() => setSelectedEvent(event)}
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
          <Typography variant="body1" color="text.secondary" gutterBottom>
          <strong>Date: </strong>
            {selectedEvent?.start_datetime
              ? new Date(selectedEvent.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric'})
              : 'Date TBD'
            } 
          
          </Typography>
          <Typography variant="body2" paragraph>{selectedEvent?.description}</Typography>
          <Typography variant="body2">
                <strong>Time: </strong>
                {selectedEvent?.start_datetime 
                    ? new Date(selectedEvent.start_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                    : 'TBD'
                }
                {selectedEvent?.end_datetime && 
                    ` – ${new Date(selectedEvent.end_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                }
            </Typography>
          {selectedEvent?.audience && <Typography variant="body2"><strong>Audience:</strong> {selectedEvent.audience}</Typography>}
          {selectedEvent?.address && <Typography variant="body2"><strong>Address:</strong> {selectedEvent.address}, {selectedEvent?.city}, CT</Typography>}
          {selectedEvent?.contact_email && <Typography variant="body2"><strong>Contact:</strong> {selectedEvent.contact_email}</Typography>}
        </DialogContent>
        <DialogActions>
          {selectedEvent?.hyperlink && (
            <Button component={Link} href={selectedEvent.hyperlink} target="_blank" rel="noopener noreferrer" variant="contained">
              Event Link
            </Button>
          )}
          <Button onClick={() => setSelectedEvent(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {tab === 1 && (
        <EventsMap events={filtered} />
      )}
    </Box>
  );
}
