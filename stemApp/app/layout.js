import './globals.css';
import AdminNav from './components/AdminNav';
import ThemeRegistry from './components/ThemeRegistry';

export const metadata = {
  title: 'STEM-ACT',
  description: 'STEM events across Connecticut',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <AdminNav>{children}</AdminNav>
        </ThemeRegistry>
      </body>
    </html>
  );
}
