import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { parseLocation } from '../lib/cityCoords';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

export default function ClientMap({ clients }) {
  // Deduplicate by location — show one dot per city even if multiple clients there
  const locationMap = {};
  clients.forEach(c => {
    const coords = parseLocation(c.location);
    if (!coords) return;
    const key = c.location?.trim();
    if (!locationMap[key]) {
      locationMap[key] = { coords, names: [], count: 0 };
    }
    locationMap[key].names.push(c.company_name);
    locationMap[key].count++;
  });

  const markers = Object.entries(locationMap).map(([loc, v]) => ({
    location: loc,
    coords: v.coords,
    names: v.names,
    count: v.count,
  }));

  const mapped = clients.filter(c => parseLocation(c.location)).length;
  const unmapped = clients.length - mapped;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-800">Client Map</span>
          {clients.length > 0 && (
            <span className="text-xs text-slate-400">
              {markers.length} {markers.length === 1 ? 'city' : 'cities'} · {clients.length} {clients.length === 1 ? 'client' : 'clients'}
            </span>
          )}
        </div>
        {unmapped > 0 && (
          <span className="text-xs text-amber-500">
            {unmapped} client{unmapped > 1 ? 's' : ''} — location not recognized
          </span>
        )}
        {clients.length === 0 && (
          <span className="text-xs text-slate-400">Sign your first client to see them here</span>
        )}
      </div>

      {/* Map */}
      <div className="bg-[#F8FAFC]">
        <ComposableMap
          projection="geoAlbersUsa"
          style={{ width: '100%', height: 'auto' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#E2E8F0"
                  stroke="#CBD5E1"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover:   { fill: '#DBEAFE', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {markers.map((m, i) => (
            <Marker key={i} coordinates={m.coords}>
              {/* Outer ring for multi-client cities */}
              {m.count > 1 && (
                <circle r={12} fill="#2196F3" opacity={0.15} />
              )}
              <circle r={6} fill="#2196F3" stroke="#fff" strokeWidth={2} opacity={0.9} />
              {/* City label */}
              <text
                textAnchor="middle"
                y={-12}
                style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: '8px',
                  fill: '#1B3A5C',
                  fontWeight: 600,
                  pointerEvents: 'none',
                }}
              >
                {m.count > 1 ? `${m.location} (${m.count})` : m.location}
              </text>
            </Marker>
          ))}
        </ComposableMap>
      </div>

      {/* Client list below map (if any) */}
      {clients.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap gap-2">
          {clients.map(c => (
            <span
              key={c.id}
              className="text-xs bg-[#EEF6FE] text-[#2196F3] font-medium px-2.5 py-1 rounded-full"
            >
              {c.company_name}
              {c.location && <span className="text-[#2196F3]/60 ml-1">· {c.location}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
