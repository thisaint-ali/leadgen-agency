import { useState, useRef, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';
import { CITY_COORDS } from '../lib/cityCoords';

const ALL_CITIES = Object.keys(CITY_COORDS).sort();

export default function CitySearch({ value, onChange, disabled, placeholder = 'e.g. Atlanta, GA' }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Keep internal query in sync when parent resets value
  useEffect(() => { setQuery(value || ''); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.length >= 1
    ? ALL_CITIES.filter(c => c.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    : [];

  const select = (city) => {
    setQuery(city);
    onChange(city);
    setOpen(false);
    setHighlighted(0);
  };

  const clear = () => {
    setQuery('');
    onChange('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setHighlighted(0);
    setOpen(true);
  };

  const handleKeyDown = (e) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(filtered[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => query.length >= 1 && setOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-8 py-2.5 bg-white text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors disabled:opacity-50 disabled:bg-slate-50"
        />
        {query && !disabled && (
          <button
            onClick={clear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.map((city, i) => {
            const [name, state] = city.split(', ');
            return (
              <li
                key={city}
                onMouseDown={() => select(city)}
                onMouseEnter={() => setHighlighted(i)}
                className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                  i === highlighted ? 'bg-[#EEF6FE] text-[#2196F3]' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <MapPin size={12} className={i === highlighted ? 'text-[#2196F3]' : 'text-slate-300'} />
                <span className="font-medium">{name}</span>
                <span className={`text-xs ${i === highlighted ? 'text-[#2196F3]/70' : 'text-slate-400'}`}>{state}</span>
              </li>
            );
          })}
          {query.length >= 2 && !ALL_CITIES.some(c => c.toLowerCase() === query.toLowerCase()) && (
            <li
              onMouseDown={() => select(query)}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer text-xs text-slate-400 border-t border-slate-100 hover:bg-slate-50 transition-colors"
            >
              <span>Use &ldquo;<span className="font-medium text-slate-600">{query}</span>&rdquo; as-is</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
