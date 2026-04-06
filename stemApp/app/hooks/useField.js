// stemApp/app/hooks/useField.js
'use client';
import { useState, useCallback } from 'react';

/**
 * useField — form state + validation lifecycle hook
 *
 * @param {object} schema      - Zod schema for the whole form
 * @param {object} initial     - initial field values { fieldName: '' }
 * @param {function} onSubmit  - async (validData) => void, called only when schema passes
 * @returns {{ values, errors, handleChange, handleBlur, handleSubmit, setValues }}
 *
 * Error format: flat object { fieldName: 'error message' }
 * (NOT Zod's .format() nested structure)
 */
export function useField(schema, initial, onSubmit) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const extractErrors = (zodResult) => {
    if (zodResult.success) return {};
    const flat = {};
    for (const issue of zodResult.error.issues) {
      const field = issue.path[0];
      if (field && !flat[field]) flat[field] = issue.message;
    }
    return flat;
  };

  const validateOne = useCallback((name, currentValues) => {
    const result = schema.safeParse(currentValues);
    const flat = extractErrors(result);
    return flat[name] ?? null;
  }, [schema]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    const next = { ...values, [name]: value };
    setValues(next);
    if (touched[name]) {
      const error = validateOne(name, next);
      setErrors(prev => {
        const updated = { ...prev };
        if (error) updated[name] = error;
        else delete updated[name];
        return updated;
      });
    }
  }, [values, touched, validateOne]);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateOne(name, values);
    setErrors(prev => {
      const updated = { ...prev };
      if (error) updated[name] = error;
      else delete updated[name];
      return updated;
    });
  }, [values, validateOne]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    // Touch all fields so errors appear
    const allTouched = Object.fromEntries(Object.keys(initial).map(k => [k, true]));
    setTouched(allTouched);

    const result = schema.safeParse(values);
    if (!result.success) {
      setErrors(extractErrors(result));
      return;
    }
    setErrors({});
    onSubmit(result.data);
  }, [values, schema, initial, onSubmit]);

  return { values, errors, handleChange, handleBlur, handleSubmit, setValues };
}
