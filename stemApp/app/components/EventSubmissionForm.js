'use client';

import React, { useState } from 'react';
import * as z from 'zod';
import {
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  FormHelperText,
  Button,
  Alert,
  CircularProgress,
  Box,
  Stack,
  Typography,
} from '@mui/material';

const SC_COUNTIES = [
  'Abbeville','Aiken','Allendale','Anderson','Bamberg','Barnwell','Beaufort',
  'Berkeley','Calhoun','Charleston','Cherokee','Chester','Chesterfield',
  'Clarendon','Colleton','Darlington','Dillon','Dorchester','Edgefield',
  'Fairfield','Florence','Georgetown','Greenville','Greenwood','Hampton',
  'Horry','Jasper','Kershaw','Lancaster','Laurens','Lee','Lexington',
  'Marion','Marlboro','McCormick','Newberry','Oconee','Orangeburg',
  'Pickens','Richland','Saluda','Spartanburg','Sumter','Union',
  'Williamsburg','York',
];

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
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

const EMPTY_FORM = {
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
};

export default function EventSubmissionForm({
  initialData = {},
  onSubmit,
  submitLabel = 'Submit Event',
  onCancel,
}) {
  const [formData, setFormData] = useState({ ...EMPTY_FORM, ...initialData });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    const result = eventSchema.safeParse(formData);
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

    setIsSubmitting(true);
    try {
      const response = await onSubmit(result.data);
      if (response && !response.success) {
        setServerError(response.message || 'An error occurred. Please try again.');
      }
    } catch (err) {
      setServerError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Stack spacing={2}>
        <Typography variant="h6" component="div">
          Event Details
        </Typography>

        {serverError && (
          <Alert severity="error">{serverError}</Alert>
        )}

        <TextField
          label="Title"
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
            {SC_COUNTIES.map((county) => (
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
          placeholder="Free or $10"
          error={Boolean(errors.cost)}
          helperText={errors.cost}
        />

        <TextField
          label="Event Link"
          name="hyperlink"
          type="text"
          value={formData.hyperlink}
          onChange={handleChange}
          fullWidth
          error={Boolean(errors.hyperlink)}
          helperText={errors.hyperlink}
        />

        <TextField
          label="Event Contact Email"
          name="event_contact"
          type="text"
          value={formData.event_contact}
          onChange={handleChange}
          fullWidth
          error={Boolean(errors.event_contact)}
          helperText={errors.event_contact}
        />

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          {onCancel && (
            <Button
              variant="outlined"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {submitLabel}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
