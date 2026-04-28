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
  Chip,
} from '@mui/material';
import FlyerUpload from './FlyerUpload';

const CT_CITY_TO_COUNTY = {
  andover: 'Tolland',
  ansonia: 'New Haven',
  ashford: 'Windham',
  avon: 'Hartford',
  barkhamsted: 'Litchfield',
  'beacon falls': 'New Haven',
  berlin: 'Hartford',
  bethany: 'New Haven',
  bethel: 'Fairfield',
  bethlehem: 'Litchfield',
  bloomfield: 'Hartford',
  bolton: 'Tolland',
  bozrah: 'New London',
  branford: 'New Haven',
  bridgeport: 'Fairfield',
  bridgewater: 'Litchfield',
  bristol: 'Hartford',
  brookfield: 'Fairfield',
  brooklyn: 'Windham',
  burlington: 'Hartford',
  canaan: 'Litchfield',
  canterbury: 'Windham',
  canton: 'Hartford',
  chaplin: 'Windham',
  cheshire: 'New Haven',
  chester: 'Middlesex',
  clinton: 'Middlesex',
  colchester: 'New London',
  colebrook: 'Litchfield',
  columbia: 'Tolland',
  cornwall: 'Litchfield',
  coventry: 'Tolland',
  cromwell: 'Middlesex',
  danbury: 'Fairfield',
  darien: 'Fairfield',
  'deep river': 'Middlesex',
  derby: 'New Haven',
  durham: 'Middlesex',
  eastford: 'Windham',
  'east granby': 'Hartford',
  'east haddam': 'Middlesex',
  'east hampton': 'Middlesex',
  'east hartford': 'Hartford',
  'east haven': 'New Haven',
  'east lyme': 'New London',
  easton: 'Fairfield',
  'east windsor': 'Hartford',
  ellington: 'Tolland',
  enfield: 'Hartford',
  essex: 'Middlesex',
  fairfield: 'Fairfield',
  farmington: 'Hartford',
  franklin: 'New London',
  glastonbury: 'Hartford',
  goshen: 'Litchfield',
  granby: 'Hartford',
  greenwich: 'Fairfield',
  griswold: 'New London',
  groton: 'New London',
  guilford: 'New Haven',
  haddam: 'Middlesex',
  hamden: 'New Haven',
  hampton: 'Windham',
  hartford: 'Hartford',
  hartland: 'Hartford',
  harwinton: 'Litchfield',
  hebron: 'Tolland',
  kent: 'Litchfield',
  killingly: 'Windham',
  killingworth: 'Middlesex',
  lebanon: 'New London',
  ledyard: 'New London',
  lisbon: 'New London',
  litchfield: 'Litchfield',
  lyme: 'New London',
  madison: 'New Haven',
  manchester: 'Hartford',
  mansfield: 'Tolland',
  marlborough: 'Hartford',
  meriden: 'New Haven',
  middlebury: 'New Haven',
  middlefield: 'Middlesex',
  middletown: 'Middlesex',
  milford: 'New Haven',
  monroe: 'Fairfield',
  montville: 'New London',
  morris: 'Litchfield',
  naugatuck: 'New Haven',
  'new britain': 'Hartford',
  'new canaan': 'Fairfield',
  'new fairfield': 'Fairfield',
  'new hartford': 'Litchfield',
  'new haven': 'New Haven',
  'new london': 'New London',
  'new milford': 'Litchfield',
  newington: 'Hartford',
  newtown: 'Fairfield',
  norfolk: 'Litchfield',
  'north branford': 'New Haven',
  'north canaan': 'Litchfield',
  'north haven': 'New Haven',
  'north stonington': 'New London',
  norwalk: 'Fairfield',
  norwich: 'New London',
  'old lyme': 'New London',
  'old saybrook': 'Middlesex',
  orange: 'New Haven',
  oxford: 'New Haven',
  plainfield: 'Windham',
  plainville: 'Hartford',
  plymouth: 'Litchfield',
  pomfret: 'Windham',
  portland: 'Middlesex',
  preston: 'New London',
  prospect: 'New Haven',
  putnam: 'Windham',
  redding: 'Fairfield',
  ridgefield: 'Fairfield',
  'rocky hill': 'Hartford',
  roxbury: 'Litchfield',
  salem: 'New London',
  salisbury: 'Litchfield',
  scotland: 'Windham',
  seymour: 'New Haven',
  sharon: 'Litchfield',
  shelton: 'Fairfield',
  sherman: 'Fairfield',
  simsbury: 'Hartford',
  somers: 'Tolland',
  southbury: 'New Haven',
  southington: 'Hartford',
  'south windsor': 'Hartford',
  sprague: 'New London',
  stafford: 'Tolland',
  stamford: 'Fairfield',
  sterling: 'Windham',
  stonington: 'New London',
  stratford: 'Fairfield',
  suffield: 'Hartford',
  thomaston: 'Litchfield',
  thompson: 'Windham',
  tolland: 'Tolland',
  torrington: 'Litchfield',
  trumbull: 'Fairfield',
  union: 'Tolland',
  vernon: 'Tolland',
  voluntown: 'New London',
  wallingford: 'New Haven',
  warren: 'Litchfield',
  washington: 'Litchfield',
  waterbury: 'New Haven',
  waterford: 'New London',
  watertown: 'Litchfield',
  westbrook: 'Middlesex',
  'west hartford': 'Hartford',
  'west haven': 'New Haven',
  weston: 'Fairfield',
  westport: 'Fairfield',
  wethersfield: 'Hartford',
  willington: 'Tolland',
  wilton: 'Fairfield',
  winchester: 'Litchfield',
  windham: 'Windham',
  windsor: 'Hartford',
  'windsor locks': 'Hartford',
  wolcott: 'New Haven',
  woodbridge: 'New Haven',
  woodbury: 'Litchfield',
  woodstock: 'Windham',
};

const AUDIENCE_OPTIONS = [
  'Students K-12',
  'Students K-5',
  'Students 6-8',
  'Students 9-12',
  'Professionals',
  'Families',
];

const EVENT_TYPES = [
  'Mathematics Instruction',
  'Science Instruction',
  'Technology Instruction',
  'Engineering Instruction',
  'Computer Science Instruction',
  'Multi-disciplinary',
  'Play-based learning',
  'Community Building',
  'Other',
];

const TIME_HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const TIME_MINUTE_OPTIONS = ['00', '10', '20', '30', '40', '50'];
const TIME_PERIOD_OPTIONS = ['AM', 'PM'];

const splitDateTimeValue = (value) => {
  if (!value) return { date: '', hour: '', minute: '00', period: 'AM' };

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: '', hour: '', minute: '00', period: 'AM' };
  }

  const hourNumber = parsed.getHours();
  const minuteValue = String(parsed.getMinutes()).padStart(2, '0');
  const period = hourNumber >= 12 ? 'PM' : 'AM';
  const normalizedHour = hourNumber % 12 || 12;

  return {
    date: `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`,
    hour: String(normalizedHour),
    minute: TIME_MINUTE_OPTIONS.includes(minuteValue) ? minuteValue : '00',
    period,
  };
};

const getLocalTimezoneOffset = () => {
  const offsetMinutes = -new Date().getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0');
  const minutes = String(absoluteMinutes % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
};

const combineDateTimeValue = (date, hour, minute, period) => {
  if (!date || !hour || !minute || !period) return '';

  let normalizedHour = Number(hour);
  if (!Number.isFinite(normalizedHour) || normalizedHour < 1 || normalizedHour > 12) {
    return '';
  }

  if (period === 'AM') {
    if (normalizedHour === 12) normalizedHour = 0;
  } else if (period === 'PM' && normalizedHour !== 12) {
    normalizedHour += 12;
  }

  return `${date}T${String(normalizedHour).padStart(2, '0')}:${minute}:00${getLocalTimezoneOffset()}`;
};

const normalizeMunicipalityName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  start_datetime: z.string().min(1, 'Start date/time is required'),
  end_datetime: z.string().min(1, 'End date/time is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  county: z.string().optional(),
  audience: z.string().min(1, 'Audience is required'),
  cost: z.string().optional(),
  hyperlink: z.string().min(1, 'Event link is required').url('Must be a valid URL'),
  event_contact: z.string().min(1, 'Event contact email is required').email('Must be a valid email'),
  event_type: z.string().min(1, 'Event type is required'),
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
  const initialStart = splitDateTimeValue(initialData.start_datetime);
  const initialEnd = splitDateTimeValue(initialData.end_datetime);
  const [formData, setFormData] = useState({
    ...EMPTY_FORM,
    ...initialData,
    start_datetime: combineDateTimeValue(initialStart.date, initialStart.hour, initialStart.minute, initialStart.period),
    end_datetime: combineDateTimeValue(initialEnd.date, initialEnd.hour, initialEnd.minute, initialEnd.period),
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flyerFile, setFlyerFile] = useState(null);
  const [startDate, setStartDate] = useState(initialStart.date);
  const [startHour, setStartHour] = useState(initialStart.hour);
  const [startMinute, setStartMinute] = useState(initialStart.minute);
  const [startPeriod, setStartPeriod] = useState(initialStart.period);
  const [endDate, setEndDate] = useState(initialEnd.date);
  const [endHour, setEndHour] = useState(initialEnd.hour);
  const [endMinute, setEndMinute] = useState(initialEnd.minute);
  const [endPeriod, setEndPeriod] = useState(initialEnd.period);

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

  const handleDateChange = (field, value) => {
    if (field === 'start_datetime') {
      setStartDate(value);
      setFormData((prev) => ({
        ...prev,
        start_datetime: combineDateTimeValue(value, startHour, startMinute, startPeriod),
      }));
    } else {
      setEndDate(value);
      setFormData((prev) => ({
        ...prev,
        end_datetime: combineDateTimeValue(value, endHour, endMinute, endPeriod),
      }));
    }

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleTimePartChange = (field, part, value) => {
    if (field === 'start_datetime') {
      const nextHour = part === 'hour' ? value : startHour;
      const nextMinute = part === 'minute' ? value : startMinute;
      const nextPeriod = part === 'period' ? value : startPeriod;

      if (part === 'hour') setStartHour(value);
      if (part === 'minute') setStartMinute(value);
      if (part === 'period') setStartPeriod(value);

      setFormData((prev) => ({
        ...prev,
        start_datetime: combineDateTimeValue(startDate, nextHour, nextMinute, nextPeriod),
      }));
    } else {
      const nextHour = part === 'hour' ? value : endHour;
      const nextMinute = part === 'minute' ? value : endMinute;
      const nextPeriod = part === 'period' ? value : endPeriod;

      if (part === 'hour') setEndHour(value);
      if (part === 'minute') setEndMinute(value);
      if (part === 'period') setEndPeriod(value);

      setFormData((prev) => ({
        ...prev,
        end_datetime: combineDateTimeValue(endDate, nextHour, nextMinute, nextPeriod),
      }));
    }

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const payloadWithCounty = {
      ...formData,
      county: CT_CITY_TO_COUNTY[normalizeMunicipalityName(formData.city)] || '',
    };

    const result = eventSchema.safeParse(payloadWithCounty);
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

        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Start Date & Time
            <Typography component="span" variant="caption" color="error.main"> *</Typography>
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => handleDateChange('start_datetime', e.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
              error={Boolean(errors.start_datetime)}
            />
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'minmax(88px, 1fr) minmax(88px, 1fr) minmax(88px, 1fr)' }}>
              <FormControl fullWidth required error={Boolean(errors.start_datetime)}>
                <InputLabel id="start-hour-label">Hour</InputLabel>
                <Select
                  labelId="start-hour-label"
                  value={startHour}
                  label="Hour"
                  displayEmpty
                  renderValue={(value) => value || '00'}
                  onChange={(e) => handleTimePartChange('start_datetime', 'hour', e.target.value)}
                >
                  <MenuItem value="">
                    <em>00</em>
                  </MenuItem>
                  {TIME_HOUR_OPTIONS.map((hour) => (
                    <MenuItem key={hour} value={hour}>
                      {hour.padStart(2, '0')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required error={Boolean(errors.start_datetime)}>
                <InputLabel id="start-minute-label">Minute</InputLabel>
                <Select
                  labelId="start-minute-label"
                  value={startMinute}
                  label="Minute"
                  onChange={(e) => handleTimePartChange('start_datetime', 'minute', e.target.value)}
                >
                  {TIME_MINUTE_OPTIONS.map((minute) => (
                    <MenuItem key={minute} value={minute}>
                      {minute}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required error={Boolean(errors.start_datetime)}>
                <InputLabel id="start-period-label">AM/PM</InputLabel>
                <Select
                  labelId="start-period-label"
                  value={startPeriod}
                  label="AM/PM"
                  onChange={(e) => handleTimePartChange('start_datetime', 'period', e.target.value)}
                >
                  {TIME_PERIOD_OPTIONS.map((period) => (
                    <MenuItem key={period} value={period}>
                      {period}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
          {errors.start_datetime && (
            <FormHelperText error>{errors.start_datetime}</FormHelperText>
          )}
        </Box>

        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            End Date & Time
            <Typography component="span" variant="caption" color="error.main"> *</Typography>
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => handleDateChange('end_datetime', e.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
              error={Boolean(errors.end_datetime)}
            />
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'minmax(88px, 1fr) minmax(88px, 1fr) minmax(88px, 1fr)' }}>
              <FormControl fullWidth required error={Boolean(errors.end_datetime)}>
                <InputLabel id="end-hour-label">Hour</InputLabel>
                <Select
                  labelId="end-hour-label"
                  value={endHour}
                  label="Hour"
                  displayEmpty
                  renderValue={(value) => value || '00'}
                  onChange={(e) => handleTimePartChange('end_datetime', 'hour', e.target.value)}
                >
                  <MenuItem value="">
                    <em>00</em>
                  </MenuItem>
                  {TIME_HOUR_OPTIONS.map((hour) => (
                    <MenuItem key={hour} value={hour}>
                      {hour.padStart(2, '0')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required error={Boolean(errors.end_datetime)}>
                <InputLabel id="end-minute-label">Minute</InputLabel>
                <Select
                  labelId="end-minute-label"
                  value={endMinute}
                  label="Minute"
                  onChange={(e) => handleTimePartChange('end_datetime', 'minute', e.target.value)}
                >
                  {TIME_MINUTE_OPTIONS.map((minute) => (
                    <MenuItem key={minute} value={minute}>
                      {minute}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required error={Boolean(errors.end_datetime)}>
                <InputLabel id="end-period-label">AM/PM</InputLabel>
                <Select
                  labelId="end-period-label"
                  value={endPeriod}
                  label="AM/PM"
                  onChange={(e) => handleTimePartChange('end_datetime', 'period', e.target.value)}
                >
                  {TIME_PERIOD_OPTIONS.map((period) => (
                    <MenuItem key={period} value={period}>
                      {period}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
          {errors.end_datetime && (
            <FormHelperText error>{errors.end_datetime}</FormHelperText>
          )}
        </Box>

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

        <FormControl fullWidth required error={Boolean(errors.audience)}>
          <InputLabel id="audience-label">Audience</InputLabel>
          <Select
            labelId="audience-label"
            id="audience-select"
            name="audience"
            value={formData.audience}
            label="Audience"
            onChange={handleChange}
          >
            <MenuItem value="">
              <em>Select audience</em>
            </MenuItem>
            {AUDIENCE_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
          {errors.audience && (
            <FormHelperText>{errors.audience}</FormHelperText>
          )}
        </FormControl>

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
          required
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
          required
          fullWidth
          error={Boolean(errors.event_contact)}
          helperText={errors.event_contact}
        />

        {/* Event Type — chip grid */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Event Type
            <Typography component="span" variant="caption" color="error.main"> *</Typography>
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {EVENT_TYPES.map((type) => {
              const selected = formData.event_type === type;
              return (
                <Chip
                  key={type}
                  label={type}
                  clickable
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      event_type: selected ? '' : type,
                    }));
                    if (errors.event_type) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.event_type;
                        return next;
                      });
                    }
                  }}
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
          {errors.event_type && (
            <FormHelperText error>{errors.event_type}</FormHelperText>
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
