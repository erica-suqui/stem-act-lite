'use client';

import { Box, Typography } from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import '@changey/react-leaflet-markercluster/dist/styles.min.css';
import L from 'leaflet';

// Fix Leaflet's broken default icon in Next.js / webpack builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Grey icon for county-centroid fallback pins
const greyIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// CT county geographic centroids — used as fallback when lat/lng is null
const CT_COUNTY_CENTROIDS = {
  'Fairfield':   [41.1408, -73.2637],
  'Hartford':    [41.7658, -72.6851],
  'Litchfield':  [41.7471, -73.2387],
  'Middlesex':   [41.4459, -72.5370],
  'New Haven':   [41.3083, -72.9279],
  'New London':  [41.4501, -72.0974],
  'Tolland':     [41.8540, -72.3648],
  'Windham':     [41.8262, -72.0474],
};

function formatDate(iso) {
  if (!iso) return 'Date TBD';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EventsMap({ events }) {
  const mappable = events.filter(e => {
    if (e.lat != null && e.lng != null) return true;
    return e.county in CT_COUNTY_CENTROIDS;
  });

  if (mappable.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="text.secondary">No events to display on the map.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: { xs: 300, md: 500 }, width: '100%', borderRadius: 1, overflow: 'hidden' }}>
      <MapContainer
        center={[41.6, -72.7]}
        zoom={9}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup>
          {mappable.map(event => {
            const isExact = event.lat != null && event.lng != null;
            const position = isExact
              ? [event.lat, event.lng]
              : CT_COUNTY_CENTROIDS[event.county];
            const icon = isExact ? undefined : greyIcon;
            const safeHref = event.hyperlink && /^https?:\/\//i.test(event.hyperlink)
              ? event.hyperlink
              : null;

            return (
              <Marker key={event.event_id} position={position} icon={icon}>
                <Popup>
                  <strong>{event.title}</strong>
                  <br />
                  {formatDate(event.start_datetime)} &middot; {event.city}
                  <br />
                  {event.address}
                  {!isExact && (
                    <>
                      <br />
                      <em style={{ fontSize: '0.8em', color: '#666' }}>
                        Approximate location — pinned by county
                      </em>
                    </>
                  )}
                  {safeHref && (
                    <>
                      <br />
                      <a href={safeHref} target="_blank" rel="noopener noreferrer">
                        More Info →
                      </a>
                    </>
                  )}
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </Box>
  );
}
