import { Box } from '@mui/material';
import TagsAdmin from '../components/TagsAdmin';

export const dynamic = 'force-dynamic';

export default function UtilitiesPage() {
  return (
    <Box sx={{ p: 3 }}>
      <TagsAdmin />
    </Box>
  );
}
