'use client';

import React, { useState, useRef } from 'react';
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
  IconButton,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloseIcon from '@mui/icons-material/Close';

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

function FlyerUpload({ flyerFile, setFlyerFile }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setFlyerFile(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Flyer <Typography component="span" variant="caption" color="text.disabled">(PDF, JPG, or PNG — max 10MB)</Typography>
      </Typography>

      {flyerFile ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            border: '1px solid',
            borderColor: 'primary.main',
            borderRadius: 2,
            bgcolor: 'primary.50',
          }}
        >
          <InsertDriveFileIcon color="primary" fontSize="small" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={500} noWrap>{flyerFile.name}</Typography>
            <Typography variant="caption" color="text.secondary">{formatSize(flyerFile.size)}</Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setFlyerFile(null)}
            aria-label="Remove flyer"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ) : (
        <Box
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          sx={{
            border: '2px dashed',
            borderColor: dragging ? 'primary.main' : 'grey.300',
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: dragging ? 'primary.50' : 'grey.50',
            transition: 'all 0.15s ease',
            '&:hover': { borderColor: 'primary.light', bgcolor: 'primary.50' },
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 32, color: dragging ? 'primary.main' : 'grey.400', mb: 0.5 }} />
          <Typography variant="body2" color={dragging ? 'primary.main' : 'text.secondary'}>
            {dragging ? 'Drop it here' : 'Drag & drop or click to browse'}
          </Typography>
          <Typography variant="caption" color="text.disabled">PDF, JPG, PNG up to 10 MB</Typography>
        </Box>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={(e) => setFlyerFile(e.target.files?.[0] || null)}
      />
    </Box>
  );
}

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
      const response = await onSubmit(result.data, flyerFile);
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
