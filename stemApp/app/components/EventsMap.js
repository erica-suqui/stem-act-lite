'use client';

import { useEffect, useRef } from 'react';
import { Box, Typography, Chip, Divider } from '@mui/material';
import { useMap, MapContainer, TileLayer } from 'react-leaflet';
import CT_Counties from '@/app/components/CT_Counties';
import L from 'leaflet';
import 'leaflet.markercluster';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const greyIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

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

function CTCountiesLayer({ events, selectedCounty, setSelectedCounty }) {
  const map = useMap();
  const geoJsonRef = useRef(null);

  useEffect(() => {
    geoJsonRef.current = L.geoJSON(CT_Counties, {
      style: (feature) => {
        const countyName = feature.properties.County.replace(' County', '');
        const isSelected = selectedCounty === countyName;
        return {
          fillColor: '#888888',
          color: '#555555',
          weight: 1,
          opacity: 1,
          fillOpacity: isSelected ? 0 : 0.15,
        };
      },
      onEachFeature: (feature, layer) => {
        const countyName = feature.properties.County.replace(' County', '');
        const count = events.filter(e => e.county === countyName).length;

        layer.on({
          click: (e) => {
            if (selectedCounty === countyName) {
              setSelectedCounty('');
              map.setView([41.6, -72.7], 9);
            } else {
              setSelectedCounty(countyName);
              map.fitBounds(e.target.getBounds());
            }
          },
          mouseover: (e) => e.target.setStyle({ fillOpacity: isSelected ? 0.1 : 0.3 }),
          mouseout: (e) => {
            const name = e.target.feature.properties.County.replace(' County', '');
            e.target.setStyle({ fillOpacity: selectedCounty === name ? 0 : 0.15 });
          },
        });

        layer.bindTooltip(
          `<strong>${countyName}</strong><br/>${count} event${count !== 1 ? 's' : ''}`,
          { direction: 'top', className: 'county-tooltip' }
        );
      },
    }).addTo(map);

    return () => {
      if (geoJsonRef.current) map.removeLayer(geoJsonRef.current);
    };
  }, [map, events, selectedCounty]);

  return null;
}

function MarkersLayer({ mappable }) {
  const map = useMap();

  useEffect(() => {
    const cluster = L.markerClusterGroup();

    mappable.forEach(event => {
      const isExact = event.lat != null && event.lng != null;
      const position = isExact
        ? [event.lat, event.lng]
        : CT_COUNTY_CENTROIDS[event.county];

      const marker = L.marker(position, { icon: isExact ? undefined : greyIcon })
        .bindPopup(`
          <strong>${event.title}</strong><br/>
          ${formatDate(event.start_datetime)} · ${event.city}<br/>
          ${event.address || ''}
          ${!isExact ? '<br/><em style="font-size:0.8em;color:#666">Approximate location — pinned by county</em>' : ''}
        `);

      cluster.addLayer(marker);
    });

    map.addLayer(cluster);
    return () => map.removeLayer(cluster);
  }, [map, mappable]);

  return null;
}

function Sidebar({ county, events, onClear, onSelectEvent }) {
  if (!county) return null;

  const countyEvents = events.filter(e => e.county === county);

  return (
    <Box sx={{
      width: 340,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '0.5px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
      overflow: 'hidden',
    }}>
      <Box sx={{ px: 2.5, py: 2, borderBottom: '0.5px solid', borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight={500}>{county}</Typography>
        <Typography variant="body2" color="text.secondary">
          {countyEvents.length} event{countyEvents.length !== 1 ? 's' : ''} found
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {countyEvents.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
            No events in this county.
          </Typography>
        ) : (
          countyEvents.map(event => (
            <Box
              key={event.event_id}
              onClick={() => onSelectEvent(event)}
              sx={{
                border: '0.5px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 2,
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                transition: 'border-color 0.15s',
              }}
            >
              <Typography variant="body1" fontWeight={500} sx={{ mb: 0.5, lineHeight: 1.3 }}>
                {event.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" display="block">
                {formatDate(event.start_datetime)} · {event.city}
              </Typography>
              {event.address && (
                <Typography variant="body2" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  {event.address}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {event.cost && (
                  <Chip
                    label={event.cost}
                    size="small"
                    color={event.cost === 'Free' ? 'success' : 'warning'}
                  />
                )}
                {event.audience && (
                  <Chip
                    label={event.audience}
                    size="small"
                    color="info"
                  />
                )}
              </Box>
            </Box>
          ))
        )}
      </Box>

      <Divider />
      <Box
        onClick={onClear}
        sx={{
          px: 2.5, py: 1.5, cursor: 'pointer', textAlign: 'center',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Typography variant="body1" color="text.secondary">✕ Clear county filter</Typography>
      </Box>
    </Box>
  );
}

export default function EventsMap({ events, setCounty, county, onSelectEvent }) {
  const mappable = !county ? [] : events.filter(e => e.county === county).filter(e => {
    if (e.lat != null && e.lng != null) return true;
    return e.county in CT_COUNTY_CENTROIDS;
  });

  return (
    <Box sx={{
      display: 'flex',
      height: { xs: 400, md: 500 },
      width: '100%',
      borderRadius: 1,
      overflow: 'hidden',
      border: '0.5px solid',
      borderColor: 'divider',
      position: 'relative',
    }}>
      <Box sx={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[41.6, -72.7]}
          minZoom={9}
          zoom={9}
          style={{ height: '100%', width: '100%' }}
          aria-label="Map of STEM events in Connecticut"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png"
          />
          <CTCountiesLayer events={events} selectedCounty={county} setSelectedCounty={setCounty} />
          <MarkersLayer mappable={mappable} />
        </MapContainer>
      </Box>

      <Sidebar
        county={county}
        events={events}
        onClear={() => setCounty('')}
        onSelectEvent={onSelectEvent}
      />
    </Box>
  );
}