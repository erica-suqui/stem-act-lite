'use client';

import React, { useState, useEffect } from 'react';
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
  Chip,
} from '@mui/material';
import { apiUrl } from '@/lib/api';
import FlyerUpload from './FlyerUpload';

const CT_COUNTIES = [
  'Fairfield','Hartford','Litchfield','Middlesex',
  'New Haven','New London','Tolland','Windham',
];

const EVENT_TYPES = [
  'Workshop',
  'Field Trip',
  'Conference',
  'Camp',
  'Competition',
  'Lecture',
  'Community Event',
  'Other',
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
  event_type: z.string().optional(),
  tag_ids: z.array(z.number())
    .min(1, 'At least one tag is required')
    .max(3, 'Maximum 3 tags allowed'),
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
  event_type: '',
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
  const [flyerFile, setFlyerFile] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState(
    Array.isArray(initialData.tag_ids) ? initialData.tag_ids : []
  );

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

  const handleTagToggle = (tagId) => {
    setSelectedTagIds(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, tagId];
    });
    if (errors.tag_ids) {
      setErrors(prev => { const n = { ...prev }; delete n.tag_ids; return n; });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const result = eventSchema.safeParse({ ...formData, tag_ids: selectedTagIds });
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
      const response = await onSubmit({ ...result.data, tag_ids: selectedTagIds }, flyerFile);
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
        <Typography variant="h6" component="h2">
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

        {/* Event Type — chip grid */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Event Type
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {EVENT_TYPES.map((type) => {
              const selected = formData.event_type === type;
              return (
                <Chip
                  key={type}
                  label={type}
                  clickable
                  onClick={() => setFormData((prev) => ({
                    ...prev,
                    event_type: selected ? '' : type,
                  }))}
                  variant={selected ? 'filled' : 'outlined'}
                  color={selected ? 'primary' : 'default'}
                  sx={{
                    fontWeight: selected ? 600 : 400,
                    transition: 'all 0.15s ease',
                  }}
                />
              );
            })}
          </Box>
        </Box>

        {/* Tags — required, pick 1–3 */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Tags{' '}
            <Typography component="span" variant="caption" color="error.main">*</Typography>
            <Typography component="span" variant="caption" color="text.disabled">
              {' '}(select 1–3)
            </Typography>
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {availableTags.map((tag) => {
              const selected = selectedTagIds.includes(tag.tag_id);
              const atMax = selectedTagIds.length >= 3 && !selected;
              return (
                <Chip
                  key={tag.tag_id}
                  label={tag.name}
                  clickable={!atMax}
                  onClick={() => !atMax && handleTagToggle(tag.tag_id)}
                  variant={selected ? 'filled' : 'outlined'}
                  color={selected ? 'primary' : 'default'}
                  sx={{
                    fontWeight: selected ? 600 : 400,
                    opacity: atMax ? 0.4 : 1,
                    transition: 'all 0.15s ease',
                  }}
                />
              );
            })}
            {availableTags.length === 0 && (
              <Typography variant="caption" color="text.disabled">
                No tags available yet.
              </Typography>
            )}
          </Box>
          {errors.tag_ids && (
            <Typography variant="caption" color="error.main" sx={{ mt: 0.5, display: 'block' }}>
              {errors.tag_ids}
            </Typography>
          )}
        </Box>

        {/* Flyer Upload — drag-and-drop zone */}
        <FlyerUpload flyerFile={flyerFile} setFlyerFile={setFlyerFile} />

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
