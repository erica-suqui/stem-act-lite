// stemApp/app/hooks/useForm.js
'use client';
import { useState, useCallback } from 'react';

/**
 * Extracts a flat error map from a Zod safeParse result.
 * Defined outside the hook so it is stable and doesn't escape dep tracking.
 * @param {import('zod').SafeParseReturnType} zodResult
 * @returns {{ [fieldName: string]: string }}
 */
function extractErrors(zodResult) {
  if (zodResult.success) return {};
  const flat = {};
  for (const issue of zodResult.error.issues) {
    const field = issue.path[0];
    if (field && !flat[field]) flat[field] = issue.message;
  }
  return flat;
}

/**
 * useForm — form state + validation lifecycle hook
 *
 * IMPORTANT: Define your Zod schema outside the component (or in useMemo) to avoid
 * re-creating it on every render, which would defeat useCallback memoization.
 *
 * @param {object} schema      - Zod schema for the whole form (must be stable reference)
 * @param {object} initial     - initial field values { fieldName: '' }
 * @param {function} onSubmit  - async (validData) => void, called only when schema passes
 * @returns {{ values, errors, touched, handleChange, handleBlur, handleSubmit, setValues }}
 *
 * Error format: flat object { fieldName: 'error message' }
 * (NOT Zod's .format() nested structure)
 *
 * Validation lifecycle:
 * - Before touch: no error shown (field is pristine)
 * - On blur: mark touched, validate, show error if invalid
 * - On change after touch: re-validate immediately (live feedback)
 * - On submit: mark all fields touched + validate all at once
 */
export function useForm(schema, initial, onSubmit) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateOne = useCallback((name, currentValues) => {
    const result = schema.safeParse(currentValues);
    const flat = extractErrors(result);
    return flat[name] ?? null;
  }, [schema]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    // Use functional updater to avoid closing over stale `values` snapshot.
    // React 18 batches the setErrors call inside the updater into the same render.
    setValues(prev => {
      const next = { ...prev, [name]: value };
      if (touched[name]) {
        const error = validateOne(name, next);
        setErrors(errPrev => {
          const updated = { ...errPrev };
          if (error) updated[name] = error;
          else delete updated[name];
          return updated;
        });
      }
      return next;
    });
  }, [touched, validateOne]);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    // `values` here is the committed state from the last render — correct for blur,
    // since handleChange already flushed the typed value into state.
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
    // Touch all live values keys (not `initial`) to handle dynamically added fields.
    const allTouched = Object.fromEntries(Object.keys(values).map(k => [k, true]));
    setTouched(allTouched);

    const result = schema.safeParse(values);
    if (!result.success) {
      setErrors(extractErrors(result));
      return;
    }
    setErrors({});
    onSubmit(result.data);
  }, [values, schema, onSubmit]);

  return { values, errors, touched, handleChange, handleBlur, handleSubmit, setValues };
}
