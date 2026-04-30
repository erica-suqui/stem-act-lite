import './globals.css';
import 'leaflet/dist/leaflet.css';
import ThemeRegistry from './components/ThemeRegistry';
import ConditionalLayout from './components/ConditionalLayout';
export const metadata = {
  title: 'STEM-ACT',
  description: 'STEM events across Connecticut',
};

export default function RootLayout({ children }) {
  
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
         <ConditionalLayout>{children}</ConditionalLayout> 
        </ThemeRegistry>
      </body>
    </html>
  );
}
