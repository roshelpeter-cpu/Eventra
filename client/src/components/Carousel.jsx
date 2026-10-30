import { useEffect, useRef } from 'react';
import { EventCard } from './EventCard.jsx';

export function FeaturedCarousel({ events }) {
  const scroller = useRef(null);

  function move(direction) {
    const element = scroller.current;
    if (!element) return;
    const card = element.querySelector('.event-card');
    const amount = (card?.getBoundingClientRect().width || 280) + 16;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollBy({ left: direction * amount, behavior: reduce ? 'auto' : 'smooth' });
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    }
  }

  useEffect(() => {
    const element = scroller.current;
    if (!element) return undefined;
    element.scrollLeft = 0;
    return undefined;
  }, [events]);

  if (!events.length) return null;

  return (
    <div className="carousel">
      <div className="carousel-controls">
        <button type="button" className="theme-toggle" onClick={() => move(-1)} aria-label="Previous featured events">‹</button>
        <button type="button" className="theme-toggle" onClick={() => move(1)} aria-label="Next featured events">›</button>
      </div>
      <div
        className="carousel-track"
        ref={scroller}
        tabIndex={0}
        role="region"
        aria-label="Featured events"
        onKeyDown={onKeyDown}
      >
        {events.map((event) => <EventCard key={event.id} event={event} />)}
      </div>
    </div>
  );
}
