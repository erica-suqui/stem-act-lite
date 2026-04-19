'use client';

import { useState, useEffect } from 'react';
import * as z from 'zod';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  FormHelperText,
  Button,
  Alert,
  CircularProgress,
  Stack,
  Container,
  Paper,
} from '@mui/material';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';
import FlyerUpload from '@/app/components/FlyerUpload';

const AUDIENCE_OPTIONS = [
  'Students K-12',
  'Students K-5',
  'Students 6-8',
  'Students 9-12',
  'Professionals',
  'Families',
];

const EVENT_TYPES = [
  'Workshop', 'Field Trip', 'Conference', 'Camp',
  'Competition', 'Lecture', 'Community Event', 'Other',
];

const CT_COUNTIES = [
  'Fairfield','Hartford','Litchfield','Middlesex',
  'New Haven','New London','Tolland','Windham',
];

const publicSchema = z.object({
  submitter_name: z.string().min(1, 'Your name is required'),
  submitter_email: z.string().email('A valid email is required'),
  submitter_phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits (no dashes)'),
  title: z.string().min(1, 'Event title is required'),
  description: z.string().min(1, 'Description is required'),
  start_datetime: z.string().min(1, 'Start date/time is required'),
  end_datetime: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  county: z.string().min(1, 'County is required'),
  audience: z.string().optional(),
  cost: z.string().optional(),
  hyperlink: z.union([z.literal(''), z.string().url('Must be a valid URL')]).optional(),
  event_type: z.string().optional(),
  event_contact: z.union([z.literal(''), z.string().email('Must be a valid email')]).optional(),
  tag_ids: z.array(z.number())
    .min(1, 'At least one tag is required')
    .max(3, 'Maximum 3 tags allowed'),
});

export default function SubmitPage() {
  const [formData, setFormData] = useState({
    submitter_name: '',
    submitter_email: '',
    submitter_phone: '',
    title: '',
    description: '',
    start_datetime: '',
    end_datetime: '',
    address: '',
    city: '',
    county: '',
    audience: '',
    cost: '',
    hyperlink: '',
    event_type: '',
    event_contact: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [flyerFile, setFlyerFile] = useState(null);

  useEffect(() => {
    fetch(apiUrl('/api/tags'))
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setAvailableTags(data.tags.filter(t => t.is_active));
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const result = publicSchema.safeParse({ ...formData, tag_ids: selectedTagIds });
    if (!result.success) {
      const fieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/events'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, tag_ids: selectedTagIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setServerError(data.message || 'An error occurred. Please try again.');
      } else {
        const data = await res.json();
        if (flyerFile && data.event_id) {
          const form = new FormData();
          form.append('file', flyerFile);
          await fetch(apiUrl(`/api/events/${data.event_id}/flyer`), {
            method: 'POST',
            body: form,
          });
        }
        setSubmitted(true);
      }
    } catch (err) {
      setServerError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Box sx={{ maxWidth: 700, mx: 'auto', p: 3 }}>
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h5" gutterBottom>Thank you!</Typography>
          <Typography>
            Your event has been submitted and is pending review. You will be contacted at{' '}
            <strong>{formData.submitter_email}</strong> once a decision has been made.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box component="main" sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 6, px: 2 }}>
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ p: { xs: 3, sm: 5 } }}>
          <Typography variant="h4" component="h1" fontWeight={700} color="primary.dark" gutterBottom>
            Submit a STEM Event
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Fill out the form below to submit your event for review. All submissions are reviewed before being published.
          </Typography>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2}>
          <Typography variant="h6"  gutterBottom component="h2">Your Contact Information</Typography>

          <TextField
            label="Your Name"
            name="submitter_name"
            value={formData.submitter_name}
            onChange={handleChange}
            required
            fullWidth
            error={Boolean(errors.submitter_name)}
            helperText={errors.submitter_name}
          />

          <TextField
            label="Your Email"
            name="submitter_email"
            value={formData.submitter_email}
            onChange={handleChange}
            required
            fullWidth
            error={Boolean(errors.submitter_email)}
            helperText={errors.submitter_email}
          />

          <TextField
            label="Your Phone"
            name="submitter_phone"
            value={formData.submitter_phone}
            onChange={handleChange}
            required
            fullWidth
            error={Boolean(errors.submitter_phone)}
            helperText={errors.submitter_phone || '10 digits, no dashes'}
          />

          <Typography variant="h6" component="h2" gutterBottom sx={{ mt: 3 }}>Event Details</Typography>

          {serverError && (
            <Alert severity="error">{serverError}</Alert>
          )}

          <TextField
            label="Event Title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            fullWidth
            error={Boolean(errors.title)}
            helperText={errors.title}
          />

          <FormControl fullWidth>
            <InputLabel id="event-type-label">Event Type</InputLabel>
            <Select
              labelId="event-type-label"
              id="event-type-select"
              name="event_type"
              value={formData.event_type}
              label="Event Type"
              onChange={handleChange}
            >
              {EVENT_TYPES.map((type) => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            fullWidth
            multiline
            rows={4}
            error={Boolean(errors.description)}
            helperText={errors.description}
          />

          <TextField
            label="Start Date & Time"
            name="start_datetime"
            type="datetime-local"
            value={formData.start_datetime}
            onChange={handleChange}
            required
            fullWidth
            InputLabelProps={{ shrink: true }}
            error={Boolean(errors.start_datetime)}
            helperText={errors.start_datetime}
          />

          <TextField
            label="End Date & Time"
            name="end_datetime"
            type="datetime-local"
            value={formData.end_datetime}
            onChange={handleChange}
            fullWidth
            InputLabelProps={{ shrink: true }}
            error={Boolean(errors.end_datetime)}
            helperText={errors.end_datetime}
          />

          <TextField
            label="Address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            fullWidth
            error={Boolean(errors.address)}
            helperText={errors.address}
          />

          <TextField
            label="City"
            name="city"
            value={formData.city}
            onChange={handleChange}
            required
            fullWidth
            error={Boolean(errors.city)}
            helperText={errors.city}
          />

          <FormControl fullWidth required error={Boolean(errors.county)}>
            <InputLabel id="county-label">County</InputLabel>
            <Select
              labelId="county-label"
              id="county-select"
              name="county"
              value={formData.county}
              label="County"
              onChange={handleChange}
            >
              {CT_COUNTIES.map((county) => (
                <MenuItem key={county} value={county}>
                  {county}
                </MenuItem>
              ))}
            </Select>
            {errors.county && (
              <FormHelperText>{errors.county}</FormHelperText>
            )}
          </FormControl>

          <FormControl fullWidth error={Boolean(errors.audience)}>
            <InputLabel id="audience-label">Audience</InputLabel>
            <Select
              labelId="audience-label"
              id="audience-select"
              name="audience"
              value={formData.audience}
              label="Audience"
              onChange={handleChange}
            >
              {AUDIENCE_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
            {errors.audience && (
              <FormHelperText>{errors.audience}</FormHelperText>
            )}
          </FormControl>

          <FormControl fullWidth required error={Boolean(errors.tag_ids)}>
            <InputLabel id="tags-label">Tags (select 1–3)</InputLabel>
            <Select
              labelId="tags-label"
              id="tags-select"
              multiple
              value={selectedTagIds}
              label="Tags (select 1–3)"
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= 3) {
                  setSelectedTagIds(value);
                  if (errors.tag_ids) {
                    setErrors(prev => { const n = { ...prev }; delete n.tag_ids; return n; });
                  }
                }
              }}
              renderValue={(selected) =>
                availableTags
                  .filter(t => selected.includes(t.tag_id))
                  .map(t => t.name)
                  .join(', ')
              }
            >
              {[...availableTags]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((tag) => (
                  <MenuItem key={tag.tag_id} value={tag.tag_id}>
                    {tag.name}
                  </MenuItem>
                ))}
            </Select>
            {errors.tag_ids && (
              <FormHelperText>{errors.tag_ids}</FormHelperText>
            )}
          </FormControl>

          <TextField
            label="Cost"
            name="cost"
            value={formData.cost}
            onChange={handleChange}
            fullWidth
            error={Boolean(errors.cost)}
            helperText={errors.cost}
          />

          <TextField
            label="Event Link"
            name="hyperlink"
            value={formData.hyperlink}
            onChange={handleChange}
            fullWidth
            error={Boolean(errors.hyperlink)}
            helperText={errors.hyperlink}
          />

          <TextField
            label="Event Contact Email"
            name="event_contact"
            value={formData.event_contact}
            onChange={handleChange}
            fullWidth
            error={Boolean(errors.event_contact)}
            helperText={errors.event_contact}
          />

          <FlyerUpload flyerFile={flyerFile} setFlyerFile={setFlyerFile} />

          <Box>
            <Button
              variant="contained"
              type="submit"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
            >
              Submit Event
            </Button>
          </Box>
          </Stack>
        </Box>
        </Paper>
      </Container>
    </Box>
  );
}
