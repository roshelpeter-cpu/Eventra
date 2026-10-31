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
    const align = () => {
      const card = element.querySelector('.event-card');
      const amount = (card?.getBoundingClientRect().width || 280) + 16;
      const index = Math.round(element.scrollLeft / amount);
      element.scrollTo({ left: Math.max(0, index * amount), behavior: 'auto' });
    };
    align();
    window.addEventListener('resize', align);
    return () => window.removeEventListener('resize', align);
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
        {events.map((event, index) => <EventCard key={event.id} event={event} emphasized={index === 0} />)}
      </div>
    </div>
  );
}
