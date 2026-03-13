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

// SC county geographic centroids — used as fallback when lat/lng is null
const SC_COUNTY_CENTROIDS = {
  'Abbeville':    [34.2228, -82.3796],
  'Aiken':        [33.5438, -81.7146],
  'Allendale':    [32.9860, -81.3879],
  'Anderson':     [34.5254, -82.6449],
  'Bamberg':      [33.2176, -81.0649],
  'Barnwell':     [33.2576, -81.3987],
  'Beaufort':     [32.3532, -80.6600],
  'Berkeley':     [33.1985, -79.9571],
  'Calhoun':      [33.6726, -80.7862],
  'Charleston':   [32.7765, -79.9311],
  'Cherokee':     [35.0460, -81.6218],
  'Chester':      [34.6818, -81.1546],
  'Chesterfield': [34.6368, -80.0754],
  'Clarendon':    [33.6576, -80.2157],
  'Colleton':     [32.9371, -80.7187],
  'Darlington':   [34.3196, -79.9754],
  'Dillon':       [34.4046, -79.3682],
  'Dorchester':   [33.1090, -80.4076],
  'Edgefield':    [33.7626, -81.9690],
  'Fairfield':    [34.3810, -81.1240],
  'Florence':     [34.0360, -79.7668],
  'Georgetown':   [33.5435, -79.2897],
  'Greenville':   [34.8526, -82.3940],
  'Greenwood':    [34.1818, -82.1160],
  'Hampton':      [32.8676, -81.1282],
  'Horry':        [33.9271, -78.9882],
  'Jasper':       [32.5296, -81.0768],
  'Kershaw':      [34.3382, -80.5793],
  'Lancaster':    [34.6860, -80.7079],
  'Laurens':      [34.4893, -82.0132],
  'Lee':          [34.1601, -80.2568],
  'Lexington':    [33.8935, -81.2418],
  'Marion':       [34.1710, -79.4207],
  'Marlboro':     [34.6201, -79.6621],
  'McCormick':    [33.9026, -82.3068],
  'Newberry':     [34.2810, -81.6076],
  'Oconee':       [34.7601, -83.0632],
  'Orangeburg':   [33.4485, -80.8179],
  'Pickens':      [34.8832, -82.7182],
  'Richland':     [34.0007, -80.9009],
  'Saluda':       [34.0035, -81.7454],
  'Spartanburg':  [34.9496, -81.9320],
  'Sumter':       [33.9185, -80.3762],
  'Union':        [34.7082, -81.6240],
  'Williamsburg': [33.6243, -79.8279],
  'York':         [34.9965, -81.2418],
};

function formatDate(iso) {
  if (!iso) return 'Date TBD';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EventsMap({ events }) {
  const mappable = events.filter(e => {
    if (e.lat != null && e.lng != null) return true;
    return e.county in SC_COUNTY_CENTROIDS;
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
        center={[33.8, -81.1]}
        zoom={7}
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
              : SC_COUNTY_CENTROIDS[event.county];
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
