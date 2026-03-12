'use client';

import { useState } from 'react';
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
} from '@mui/material';
import { apiUrl } from '@/lib/api';

const CT_COUNTIES = [
  'Fairfield',
  'Hartford',
  'Litchfield',
  'Middlesex',
  'New Haven',
  'New London',
  'Tolland',
  'Windham',
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
  hyperlink: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  event_contact: z.string().email('Must be a valid email').optional().or(z.literal('')),
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
    event_contact: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

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

    const result = publicSchema.safeParse(formData);
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
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!data.success) {
        setServerError(data.message || 'An error occurred. Please try again.');
      } else {
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
    <Box sx={{ maxWidth: 700, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>Submit a STEM Event</Typography>
      <Typography variant="body1" sx={{ mb: 3 }}>
        Fill out the form below to submit your event for review. All submissions are reviewed before being published.
      </Typography>

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2}>
          <Typography variant="h6" gutterBottom>Your Contact Information</Typography>

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

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Event Details</Typography>

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

          <TextField
            label="Audience"
            name="audience"
            value={formData.audience}
            onChange={handleChange}
            fullWidth
            error={Boolean(errors.audience)}
            helperText={errors.audience}
          />

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
    </Box>
  );
}
