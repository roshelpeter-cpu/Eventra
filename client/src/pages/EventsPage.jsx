import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { EventCard } from '../components/EventCard.jsx';
import { CATEGORIES } from '../constants.js';
import { EmptyState, ErrorBlock, PageTitle, SkeletonCards } from '../components/ui.jsx';

const SORTS = [
  ['soonest', 'Soonest'],
  ['latest', 'Latest date'],
  ['title', 'Title'],
  ['popular', 'Most registered'],
  ['price', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
];

function localISO(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function presetRange(preset) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'week') {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return [localISO(start), localISO(end)];
  }
  if (preset === 'month') {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return [localISO(start), localISO(end)];
  }
  if (preset === 'next') {
    const first = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 2, 0);
    return [localISO(first), localISO(end)];
  }
  return ['', ''];
}

export function EventsPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(() => params.get('q') || '');
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [cities, setCities] = useState([]);
  const [counts, setCounts] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const search = params.toString();
  const loadKey = `${search}|${attempt}`;
  const [seenKey, setSeenKey] = useState(loadKey);
  if (seenKey !== loadKey) {
    setSeenKey(loadKey);
    setLoading(true);
    setError('');
    setPage(0);
  }

  useEffect(() => {
    const current = params.get('q') || '';
    if (current === query) return undefined;
    const handle = window.setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (query) next.set('q', query);
        else next.delete('q');
        return next;
      }, { replace: true });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, params, setParams]);

  useEffect(() => {
    if (params.get('focus') !== 'search') return undefined;
    document.getElementById('event-search')?.focus();
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('focus');
      return next;
    }, { replace: true });
    return undefined;
  }, [params, setParams]);

  useEffect(() => {
    const controller = new AbortController();
    api('/api/events?sort=soonest', { signal: controller.signal })
      .then((data) => {
        const next = {};
        data.events.forEach((event) => {
          next[event.category] = (next[event.category] || 0) + 1;
        });
        setCounts(next);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const next = new URLSearchParams(search);
    next.set('limit', '9');
    next.set('offset', String(page * 9));
    api(`/api/events?${next.toString()}`, { signal: controller.signal })
      .then((data) => {
        setEvents((current) => (page === 0 ? data.events : [...current, ...data.events.filter((event) => !current.some((item) => item.id === event.id))]));
        setTotal(data.total);
        setCities(data.cities || []);
        setLoading(false);
      })
      .catch((loadError) => {
        if (loadError.name === 'AbortError') return;
        setError(loadError.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [search, attempt, page]);

  function setFilter(key, value) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }

  function applyPreset(preset) {
    const [from, to] = presetRange(preset);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (from) next.set('from', from);
      else next.delete('from');
      if (to) next.set('to', to);
      else next.delete('to');
      return next;
    }, { replace: true });
  }

  const category = params.get('category') || '';
  const price = params.get('price') || '';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const activePreset = useMemo(() => {
    const presets = ['week', 'month', 'next'];
    return presets.find((preset) => {
      const [start, end] = presetRange(preset);
      return start === from && end === to;
    }) || (!from && !to ? 'any' : '');
  }, [from, to]);
  const filtersActive = Boolean(query || category || price || params.get('city') || from || to || params.get('sort'));

  return (
    <div className="page">
      <PageTitle title="Explore events" />
      <div className="wrap">
        <div className="explore-head">
          <p className="kicker">Discovery</p>
          <h1>Explore Events</h1>
          <p className="lede">Find events that match your interests and grow your skills.</p>
          <button type="button" className="btn btn-ghost filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}>
            {filtersOpen ? 'Hide filters' : 'Show filters'}
          </button>
        </div>
        <div className="explore">
          <aside className={filtersOpen ? 'filter-panel open' : 'filter-panel'}>
            <h2>Filters</h2>
            <div className="field">
              <label htmlFor="event-search">Search</label>
              <input id="event-search" value={query} placeholder="Title, topic, or location" onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className="field">
              <span id="date-label">Date</span>
              <div className="date-picks" role="group" aria-labelledby="date-label">
                {[
                  ['any', 'Any date'],
                  ['week', 'This week'],
                  ['month', 'This month'],
                  ['next', 'Next month'],
                ].map(([value, label]) => (
                  <button key={value} type="button" className="chip" aria-pressed={activePreset === value} onClick={() => applyPreset(value)}>{label}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="from-date">From</label>
              <input id="from-date" type="date" value={from} onChange={(event) => setFilter('from', event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="to-date">To</label>
              <input id="to-date" type="date" value={to} onChange={(event) => setFilter('to', event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="city">Location</label>
              <select id="city" value={params.get('city') || ''} onChange={(event) => setFilter('city', event.target.value)}>
                <option value="">All locations</option>
                {cities.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
            <div className="field">
              <span id="category-label">Categories</span>
              <div className="count-list" role="group" aria-labelledby="category-label">
                <button type="button" className="chip" aria-pressed={!category} onClick={() => setFilter('category', '')}>
                  <span>All</span><span>{Object.values(counts).reduce((sum, value) => sum + value, 0)}</span>
                </button>
                {CATEGORIES.map((item) => (
                  <button key={item} type="button" className="chip" aria-pressed={category === item} onClick={() => setFilter('category', category === item ? '' : item)}>
                    <span>{item}</span><span>{counts[item] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span id="price-label">Price</span>
              <div className="chip-row" role="group" aria-labelledby="price-label">
                {[
                  ['', 'Any'],
                  ['free', 'Free'],
                  ['paid', 'Paid'],
                ].map(([value, label]) => (
                  <button key={label} type="button" className="chip" aria-pressed={price === value} onClick={() => setFilter('price', value)}>{label}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="sort">Sort by</label>
              <select id="sort" value={params.get('sort') || 'soonest'} onChange={(event) => setFilter('sort', event.target.value === 'soonest' ? '' : event.target.value)}>
                {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            {filtersActive ? (
              <button type="button" className="btn btn-ghost" onClick={() => { setQuery(''); setParams({}, { replace: true }); setFiltersOpen(false); }}>Clear filters</button>
            ) : null}
          </aside>
          <div>
            {error ? <ErrorBlock message={error} onRetry={() => setAttempt((value) => value + 1)} /> : null}
            {loading && !error ? <SkeletonCards count={6} /> : null}
            {!loading && !error && events.length === 0 ? (
              <EmptyState title="No events match these filters." body="Try another category, city, or date range." />
            ) : null}
            {!loading && !error && events.length > 0 ? (
              <>
                <div className="result-row">
                  <p className="meta">{total} event{total === 1 ? '' : 's'}</p>
                </div>
                <div className="chip-row filter-chips">
                  <button type="button" className="chip" aria-pressed={!category} onClick={() => setFilter('category', '')}>All</button>
                  {CATEGORIES.map((item) => (
                    <button key={item} type="button" className="chip" aria-pressed={category === item} onClick={() => setFilter('category', category === item ? '' : item)}>{item}</button>
                  ))}
                  <button type="button" className="chip" aria-pressed={price === 'free'} onClick={() => setFilter('price', price === 'free' ? '' : 'free')}>Free</button>
                  <button type="button" className="chip" aria-pressed={price === 'paid'} onClick={() => setFilter('price', price === 'paid' ? '' : 'paid')}>Paid</button>
                </div>
                <div className="event-grid">
                  {events.map((event) => <EventCard key={event.id} event={event} />)}
                </div>
                {events.length < total ? (
                  <div className="actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setPage((value) => value + 1)}>Load more</button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
