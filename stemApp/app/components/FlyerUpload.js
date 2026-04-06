'use client';

import React, { useRef, useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloseIcon from '@mui/icons-material/Close';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FlyerUpload({ flyerFile, setFlyerFile }) {
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
          role="button"
          tabIndex={0}
          aria-label="Upload flyer — drag and drop or click to browse"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
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
