const PHOTOS = {
  'northline-design-summit': '/photos/northline.jpg',
  'harbor-circuit': '/photos/harbor.jpg',
  'lumen-jazz-after-code': '/photos/lumen.jpg',
  'atlas-founder-forum': '/photos/atlas.jpg',
  'kiln-robotics-showcase': '/photos/kiln.jpg',
  'paper-and-pixel': '/photos/pixel.jpg',
  'solstice-product-retreat': '/photos/solstice.jpg',
  'field-notes-career-studios': '/photos/field.jpg',
  'cedar-circuit-workshop': '/photos/cedar.jpg',
  'midnight-maintainer-marathon': '/photos/midnight.jpg',
  'southbank-review': '/photos/southbank.jpg',
  'winter-salon-archive': '/photos/winter.jpg',
};

function entry(slug, details) {
  return { slug, image: PHOTOS[slug], details };
}

export const CATALOG = [
  entry('northline-design-summit', {
    audience: 'Design leads, students, and independent studios',
    perks: ['Live critique with working notes', 'Small-room portfolio reviews', 'A seat cap that keeps feedback specific'],
    schedule: [
      { time: '9:00 AM', title: 'Doors and name cards', detail: 'Check in with your ticket code at the east hall.' },
      { time: '9:30 AM', title: 'Four short talks', detail: 'Long questions are part of the program, not an interruption.' },
      { time: '1:00 PM', title: 'Studio critiques', detail: 'Each guest brings one project into a small room.' },
      { time: '4:30 PM', title: 'Notes to take home', detail: 'Written feedback is handed back before the hall closes.' },
    ],
    speakers: [
      { name: 'Mira Ellison', role: 'Design lead, Northline College' },
      { name: 'Leila Navarro', role: 'Studio director, Puget Studio' },
    ],
    faqs: [
      { q: 'What should I bring?', a: 'One project you can explain in ten minutes, and a photo ID that matches the ticket.' },
      { q: 'Is there standing room?', a: 'No. The summit is seated so every critique stays specific.' },
    ],
  }),
  entry('harbor-circuit', {
    audience: 'Students and lab teams who still like to see the wires',
    perks: ['Twenty-minute hardware demos', 'A supervised build floor', 'Loaner kits for students who request them'],
    schedule: [
      { time: '6:00 PM', title: 'Floor opens', detail: 'Benches are labeled. Tickets are checked at the pier door.' },
      { time: '6:30 PM', title: 'Demo circuit', detail: 'Local labs run short demonstrations, then take questions.' },
      { time: '8:00 PM', title: 'Build session', detail: 'Stay at a bench or move between them. The schedule is firm.' },
    ],
    speakers: [
      { name: 'Jonah Adeyemi', role: 'Harbor Institute' },
      { name: 'Chris Ibarra', role: 'Foundry Night' },
    ],
    faqs: [
      { q: 'Do I need a laptop?', a: 'Bring one if you have it. Loaner kits are reserved for students who note it when they register.' },
      { q: 'When does the hall close?', a: 'When the last ferry of the night leaves.' },
    ],
  }),
  entry('lumen-jazz-after-code', {
    audience: 'Engineers and musicians who share a set list',
    perks: ['Two seated sets', 'Three maintainer talks', 'No standing room'],
    schedule: [
      { time: '7:00 PM', title: 'First set', detail: 'The quartet plays. Late arrivals wait in the lobby.' },
      { time: '8:10 PM', title: 'Maintainer talks', detail: 'Three short talks about keeping a public tool alive.' },
      { time: '9:00 PM', title: 'Second set', detail: 'Registration includes this set.' },
    ],
    speakers: [
      { name: 'Amira Hassan', role: 'Lumen Hall' },
      { name: 'Noor Alvi', role: 'Guest maintainer' },
    ],
    faqs: [
      { q: 'Can I arrive late?', a: 'You can enter at the break. The room stays seated during the music.' },
      { q: 'Is this a hack night?', a: 'No. It is a listening room with a short program between sets.' },
    ],
  }),
  entry('atlas-founder-forum', {
    audience: 'First-time founders comparing notes',
    perks: ['A small room, not a pitch stage', 'Written notes from the table', 'Time for questions'],
    schedule: [
      { time: '10:00 AM', title: 'Table opens', detail: 'Forty seats. Names are checked against the registration list.' },
      { time: '10:30 AM', title: 'What we would not raise for', detail: 'A facilitated comparison, not a pitch contest.' },
      { time: '2:00 PM', title: 'Notes', detail: 'Each table leaves with a page of decisions.' },
    ],
    speakers: [
      { name: 'Owen Park', role: 'Atlas Fellowship' },
      { name: 'Miles Calder', role: 'Southbank Review' },
    ],
    faqs: [
      { q: 'Is there a pitch session?', a: 'No slides longer than a page, and no open-mic pitches.' },
      { q: 'Who is the room for?', a: 'First-time founders and the people who advise them.' },
    ],
  }),
  entry('kiln-robotics-showcase', {
    audience: 'Student teams and lab groups',
    perks: ['Live machine demos', 'Judges who stay for questions', 'A public floor with a hard capacity'],
    schedule: [
      { time: '11:00 AM', title: 'Pits open', detail: 'Teams set up on marked benches.' },
      { time: '12:00 PM', title: 'Demo rounds', detail: 'Each machine has to work in front of the crowd.' },
      { time: '3:00 PM', title: 'Notes from the judges', detail: 'Short written comments, not a trophy ceremony.' },
    ],
    speakers: [
      { name: 'Sable Okonkwo', role: 'Kiln Lab' },
      { name: 'Jonah Adeyemi', role: 'Visiting reviewer' },
    ],
    faqs: [
      { q: 'Can a team still register?', a: 'Guests register as attendees. Demo slots are arranged with the lab before the day.' },
      { q: 'Are the machines loud?', a: 'Some are. Ear protection is at the door if you want it.' },
    ],
  }),
  entry('paper-and-pixel', {
    audience: 'Editorial designers who still start on paper',
    perks: ['An exhibition you can walk', 'An afternoon workshop', 'Work you can take back to a desk'],
    schedule: [
      { time: '1:00 PM', title: 'Gallery open', detail: 'The exhibition is up before the workshop begins.' },
      { time: '2:00 PM', title: 'Paper workshop', detail: 'A short brief, then time at the tables.' },
      { time: '5:00 PM', title: 'Close', detail: 'Work left on the tables is recycled.' },
    ],
    speakers: [
      { name: 'Priya Raman', role: 'Paper Club' },
      { name: 'Leila Navarro', role: 'Guest editor' },
    ],
    faqs: [
      { q: 'Do I need materials?', a: 'Paper, pens, and a few screens are in the room.' },
      { q: 'Is the exhibition separate?', a: 'No. The same ticket covers the gallery and the workshop.' },
    ],
  }),
  entry('solstice-product-retreat', {
    audience: 'Product people who can spend a full day on one brief',
    perks: ['One problem for the whole day', 'A written decision before you leave', 'A waitlist when the room is full'],
    schedule: [
      { time: '9:00 AM', title: 'The brief', detail: 'What should a campus tool stop doing?' },
      { time: '11:00 AM', title: 'Research block', detail: 'Small groups, no slide deck longer than a page.' },
      { time: '2:00 PM', title: 'Decision', detail: 'The afternoon ends with a page everyone can sign.' },
    ],
    speakers: [
      { name: 'Noor Alvi', role: 'Retreat host' },
      { name: 'Owen Park', role: 'Table facilitator' },
    ],
    faqs: [
      { q: 'What if the retreat is full?', a: 'Join the waitlist. If a confirmed guest cancels, the earliest waitlisted guest is moved into the seat.' },
      { q: 'Is lodging included?', a: 'No. The ticket is for the day at Maroon Creek Lodge.' },
    ],
  }),
  entry('field-notes-career-studios', {
    audience: 'Students who want a review, not a career-fair tote bag',
    perks: ['Short portfolio studios', 'Reviewers who read the work', 'A campus venue with a published capacity'],
    schedule: [
      { time: '10:00 AM', title: 'Studios open', detail: 'Check in, then join the studio listed on your ticket notes.' },
      { time: '10:30 AM', title: 'Reviews', detail: 'Fifteen minutes of work, then fifteen minutes of notes.' },
      { time: '3:00 PM', title: 'Last reviews', detail: 'The pavilion closes on time.' },
    ],
    speakers: [
      { name: 'Theo Marchetti', role: 'Field Notes' },
      { name: 'Hanae Sato', role: 'Reviewer' },
    ],
    faqs: [
      { q: 'What should I bring?', a: 'One project, not a full archive, and a way to show it without relying on the venue wifi.' },
      { q: 'Are employers recruiting?', a: 'Reviewers are there to read the work. This is not a booth fair.' },
    ],
  }),
  entry('cedar-circuit-workshop', {
    audience: 'People who signed up before the workshop was called off',
    perks: ['Existing registrations stay on the list', 'No new seats are sold', 'The status is visible on the public page'],
    schedule: [
      { time: '4:00 PM', title: 'Original start', detail: 'This session was called off. The schedule is kept so guests can see what was planned.' },
    ],
    speakers: [
      { name: 'Hanae Sato', role: 'Cedar Workshop' },
    ],
    faqs: [
      { q: 'Can I still register?', a: 'No. Cancelled events stay visible and registration stays closed.' },
      { q: 'Is my earlier registration deleted?', a: 'No. Existing guests remain on the list.' },
    ],
  }),
  entry('midnight-maintainer-marathon', {
    audience: 'Maintainers who can stay late',
    perks: ['A draft program', 'A room that is not public yet', 'Seats held until it is published'],
    schedule: [
      { time: '8:00 PM', title: 'Planned start', detail: 'This event is still a draft and is hidden from the public calendar.' },
    ],
    speakers: [
      { name: 'Chris Ibarra', role: 'Host' },
    ],
    faqs: [
      { q: 'Why can I not find this on the calendar?', a: 'Draft events are visible only to organizers.' },
    ],
  }),
  entry('southbank-review', {
    audience: 'Readers and editors who came for the autumn review',
    perks: ['A completed public program', 'Check-in records from the door', 'A published archive of who attended'],
    schedule: [
      { time: '10:00 AM', title: 'Review', detail: 'This event has ended. The schedule is kept with the record.' },
      { time: '4:00 PM', title: 'Close', detail: 'Tickets were checked in at the door.' },
    ],
    speakers: [
      { name: 'Miles Calder', role: 'Southbank Review' },
    ],
    faqs: [
      { q: 'Can I register now?', a: 'No. The review has ended.' },
    ],
  }),
  entry('winter-salon-archive', {
    audience: 'Guests from the archived salon',
    perks: ['Records kept after the event left the calendar', 'No public listing while archived'],
    schedule: [
      { time: '6:00 PM', title: 'Salon', detail: 'Archived events stay in the database and leave the public calendar.' },
    ],
    speakers: [
      { name: 'Priya Raman', role: 'Host' },
    ],
    faqs: [
      { q: 'Where did the page go?', a: 'Archived events are not listed publicly. Organizers can restore them to draft.' },
    ],
  }),
];

const BY_SLUG = new Map(CATALOG.map((item) => [item.slug, item]));

export const PLACES = {
  'harbor-circuit': {
    address: 'Pier 62, Alaskan Way, Seattle, WA',
    latitude: 47.6097,
    longitude: -122.3594,
  },
  'lumen-jazz-after-code': {
    address: '4802 N Broadway, Chicago, IL',
    latitude: 41.9691,
    longitude: -87.6599,
  },
  'paper-and-pixel': {
    address: '35 Wooster Street, New York, NY',
    latitude: 40.7224,
    longitude: -74.0029,
  },
};

export const OFFERS = {
  'atlas-founder-forum': [
    { name: 'Early Bird', priceCents: 99900, feeCents: 0 },
    { name: 'Regular', priceCents: 149900, feeCents: 7500 },
    { name: 'Group', priceCents: 119900, feeCents: 0 },
  ],
  'lumen-jazz-after-code': [
    { name: 'Regular', priceCents: 35000, feeCents: 2000 },
  ],
  'kiln-robotics-showcase': [
    { name: 'Early Bird', priceCents: 49900, feeCents: 0 },
    { name: 'Regular', priceCents: 79900, feeCents: 4900 },
  ],
};

export function presentationFor(slug) {
  return BY_SLUG.get(slug) || null;
}

export function applyCatalog(db) {
  const columns = db.prepare('PRAGMA table_info(events)').all().map((column) => column.name);
  if (!columns.includes('details')) return;
  const read = db.prepare('SELECT image_url, details FROM events WHERE slug = ?');
  const write = db.prepare('UPDATE events SET image_url = ?, details = ? WHERE slug = ?');
  for (const item of CATALOG) {
    const row = read.get(item.slug);
    if (!row) continue;
    const image = String(row.image_url).startsWith('/covers/') ? item.image : row.image_url;
    const details = !row.details || row.details === '{}' ? JSON.stringify(item.details) : row.details;
    if (image !== row.image_url || details !== row.details) {
      write.run(image, details, item.slug);
    }
  }

  if (columns.includes('latitude')) {
    const readPlace = db.prepare('SELECT latitude FROM events WHERE slug = ?');
    const writePlace = db.prepare(
      'UPDATE events SET address = ?, latitude = ?, longitude = ? WHERE slug = ? AND latitude IS NULL',
    );
    for (const [slug, place] of Object.entries(PLACES)) {
      const row = readPlace.get(slug);
      if (!row || row.latitude != null) continue;
      writePlace.run(place.address, place.latitude, place.longitude, slug);
    }
    db.prepare(`UPDATE events SET address = venue || ', ' || city WHERE address = ''`).run();
  }

  const typesTable = db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ticket_types'`,
  ).get();
  if (!typesTable) return;
  const eventBySlug = db.prepare('SELECT id, price_cents FROM events WHERE slug = ?');
  const typeCount = db.prepare('SELECT COUNT(*) AS n FROM ticket_types WHERE event_id = ?');
  const insertType = db.prepare(
    `INSERT INTO ticket_types (event_id, name, price_cents, fee_cents, currency, sort_order)
     VALUES (?, ?, ?, ?, 'INR', ?)`,
  );
  const setPrice = db.prepare('UPDATE events SET price_cents = ? WHERE id = ? AND price_cents = 0');
  for (const [slug, types] of Object.entries(OFFERS)) {
    const event = eventBySlug.get(slug);
    if (!event || Number(typeCount.get(event.id).n) > 0) continue;
    types.forEach((type, index) => {
      insertType.run(event.id, type.name, type.priceCents, type.feeCents, index);
    });
    setPrice.run(Math.min(...types.map((type) => type.priceCents)), event.id);
  }
}
