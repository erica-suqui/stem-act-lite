import ThemeRegistry from '../components/ThemeRegistry';

export default function EmbedLayout({ children }) {
  return (
    <ThemeRegistry>
      {children}
    </ThemeRegistry>
  );
}