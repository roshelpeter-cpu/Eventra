import fs from 'node:fs';
import { createAdmin } from './auth.js';
import { applyCatalog, presentationFor } from './catalog.js';
import { migrate, openDatabase } from './db.js';
import { normalizeEmail } from './validate.js';

const LOCAL_DEMO_PASSWORD = 'eventra-demo-2026';

const PEOPLE = [
  ['Mira Ellison', 'Northline College', ['Design', 'Research']],
  ['Jonah Adeyemi', 'Harbor Institute', ['Engineering', 'Product']],
  ['Leila Navarro', 'Puget Studio', ['Design', 'Writing']],
  ['Owen Park', 'Atlas Fellowship', ['Product', 'Operations']],
  ['Sable Okonkwo', 'Kiln Lab', ['Engineering', 'Data']],
  ['Priya Raman', 'Paper Club', ['Design', 'Writing']],
  ['Theo Marchetti', 'Field Notes', ['Marketing', 'Operations']],
  ['Hanae Sato', 'Cedar Workshop', ['Research', 'Design']],
  ['Miles Calder', 'Southbank Review', ['Product', 'Design']],
  ['Amira Hassan', 'Lumen Hall', ['Writing', 'Research']],
  ['Chris Ibarra', 'Foundry Night', ['Engineering', 'Operations']],
  ['Noor Alvi', 'Maroon Creek', ['Product', 'Research']],
  ['Elena Voss', 'Congress Avenue', ['Marketing', 'Product']],
  ['Samir Patel', 'Seaport Labs', ['Data', 'Engineering']],
  ['June Harlow', 'The Armory', ['Design', 'Product']],
  ['Mateo Ruiz', 'RiNo Warehouse', ['Engineering', 'Design']],
  ['Asha Reddy', 'Quad Pavilion', ['Operations', 'Marketing']],
  ['Felix Neumann', 'Green Mill Annex', ['Writing', 'Research']],
  ['Naomi Brooks', 'Drawing Center', ['Design', 'Research']],
  ['Idris Lawal', 'Campus Mail', ['Data', 'Product']],
  ['Clara Nguyen', 'Studio North', ['Design', 'Writing']],
  ['Pavel Horvat', 'Circuit House', ['Engineering', 'Product']],
  ['Yasmin Darwish', 'Harbor Press', ['Writing', 'Marketing']],
  ['Leo Martins', 'Pixel Room', ['Design', 'Data']],
  ['Ingrid Solberg', 'Retreat Desk', ['Operations', 'Research']],
  ['Kwame Mensah', 'Forum West', ['Product', 'Marketing']],
  ['Ruth Keller', 'Archive Desk', ['Research', 'Writing']],
  ['Diego Alvarez', 'Night Shift', ['Engineering', 'Operations']],
  ['Freya Lind', 'Paper Mill', ['Design', 'Product']],
  ['Omar Farouk', 'City Circuit', ['Data', 'Engineering']],
  ['Beatrice Cole', 'College Green', ['Marketing', 'Writing']],
  ['Nikhil Shah', 'Lab Three', ['Engineering', 'Research']],
  ['Sophie Laurent', 'Atelier Row', ['Design', 'Operations']],
  ['Hassan Ali', 'Workshop Nine', ['Product', 'Engineering']],
  ['Lena Hoffman', 'Reading Room', ['Research', 'Writing']],
  ['Victor Chen', 'Open Desk', ['Engineering', 'Data']],
];

function emailOf(name, eventSlug) {
  const local = name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
  return `${local}.${eventSlug}@campus.example`;
}

function atDay(dayOffset, hour) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function hoursAfter(iso, hours) {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(12, 0, 0, 0);
  return date.toISOString();
}

function events() {
  const northline = atDay(12, 9);
  const harbor = atDay(5, 18);
  const lumen = atDay(18, 19);
  const atlas = atDay(26, 10);
  const kiln = atDay(33, 11);
  const pixel = atDay(8, 13);
  const solstice = atDay(21, 9);
  const field = atDay(15, 10);
  const cedar = atDay(14, 16);
  const midnight = atDay(40, 20);
  const southbank = atDay(-20, 10);
  const winter = atDay(-200, 18);
  return [
    {
      slug: 'northline-design-summit',
      title: 'Northline Design Summit',
      summary: 'A one-day summit for product designers who want critique, not another keynote reel.',
      description: 'Northline gathers design leads, students, and independent studios for a day of live critiques and material studies. The morning is four short talks with long questions. The afternoon breaks into small rooms where each guest brings one project and leaves with notes that can be used on Monday.\n\nPortfolio reviews run quietly in the east gallery. Seats are capped so the critiques stay specific.',
      category: 'Design',
      venue: 'The Armory, East Hall',
      city: 'Portland',
      image: '/covers/northline.svg',
      starts: northline,
      ends: hoursAfter(northline, 8),
      capacity: 120,
      status: 'published',
      plan: { confirmed: 18 },
    },
    {
      slug: 'harbor-circuit',
      title: 'Harbor Circuit',
      summary: 'Hardware demos, short talks, and a build floor beside the working waterfront.',
      description: 'Harbor Circuit is an evening for people who still like to see the wires. Local labs open their benches for twenty-minute demos, then the floor turns into a supervised build session. Bring a laptop if you have one. Loaner kits are reserved for students who note it on the registration form.\n\nThe hall closes when the last ferry of the night leaves, so the schedule is firm.',
      category: 'Technology',
      venue: 'Pier 62 Hall',
      city: 'Seattle',
      image: '/covers/harbor.svg',
      starts: harbor,
      ends: hoursAfter(harbor, 4),
      capacity: 80,
      status: 'published',
      plan: { confirmed: 22 },
    },
    {
      slug: 'lumen-jazz-after-code',
      title: 'Lumen: Jazz After Code',
      summary: 'A listening room for engineers and musicians who share a set list and a shipping date.',
      description: 'Lumen is not a hack night with a playlist in the corner. A quartet plays two sets. Between them, three maintainers talk about the unglamorous work of keeping a public tool alive. The room is seated. Late arrivals wait in the lobby until the break.\n\nRegistration includes the second set. There is no standing room.',
      category: 'Arts',
      venue: 'Green Mill Annex',
      city: 'Chicago',
      image: '/covers/lumen.svg',
      starts: lumen,
      ends: hoursAfter(lumen, 4),
      capacity: 60,
      status: 'published',
      plan: { confirmed: 16 },
    },
    {
      slug: 'atlas-founder-forum',
      title: 'Atlas Founder Forum',
      summary: 'A small forum for first-time founders comparing notes before the next raise.',
      description: 'Atlas keeps the room small on purpose. The morning is a facilitated case read of two fictional companies, with the numbers on the table. The afternoon is office hours with operators who have actually closed a seed round and lived with it.\n\nThis session is nearly full. If the last seats go, the waitlist is promoted in the order guests joined.',
      category: 'Business',
      venue: 'Congress Avenue Loft',
      city: 'Austin',
      image: '/covers/atlas.svg',
      starts: atlas,
      ends: hoursAfter(atlas, 7),
      capacity: 40,
      status: 'published',
      plan: { confirmed: 36 },
    },
    {
      slug: 'kiln-robotics-showcase',
      title: 'Kiln Robotics Showcase',
      summary: 'Student teams and lab groups demo machines that have to work in front of a crowd.',
      description: 'Kiln is a showcase, not a trade-show aisle. Each team gets a marked bay, a power drop, and six minutes on the microphone. Judges are faculty and working roboticists. Guests can walk the floor after the presentations.\n\nClosed-toe shoes are required on the floor. Registration collects the college or lab so badges can be printed the night before.',
      category: 'Technology',
      venue: 'Seaport Labs',
      city: 'Boston',
      image: '/covers/kiln.svg',
      starts: kiln,
      ends: hoursAfter(kiln, 6),
      capacity: 150,
      status: 'published',
      plan: { confirmed: 28 },
    },
    {
      slug: 'paper-and-pixel',
      title: 'Paper & Pixel',
      summary: 'An exhibition and afternoon workshop on editorial design that still starts on paper.',
      description: 'Paper & Pixel opens with a hung show of student and studio work, then moves into a workshop on grids, type, and the moment a layout should become code. Materials are provided. Guests leave with a printed signature and the file that produced it.\n\nThe gallery stays open after the workshop for anyone who wants to look without talking.',
      category: 'Arts',
      venue: 'Drawing Center Hall',
      city: 'New York',
      image: '/covers/pixel.svg',
      starts: pixel,
      ends: hoursAfter(pixel, 6),
      capacity: 90,
      status: 'published',
      plan: { confirmed: 24 },
    },
    {
      slug: 'solstice-product-retreat',
      title: 'Solstice Product Retreat',
      summary: 'A full-day retreat with one product problem and no slide deck longer than a page.',
      description: 'Solstice is intentionally full. Twenty-four people spend the day on a single brief: what should a campus tool stop doing? The morning is research. The afternoon is a decision, written down, with an owner.\n\nWhen the room is full, new guests join the waitlist. If someone cancels, the earliest waitlisted guest is confirmed automatically.',
      category: 'Workshop',
      venue: 'Maroon Creek Lodge',
      city: 'Aspen',
      image: '/covers/solstice.svg',
      starts: solstice,
      ends: hoursAfter(solstice, 8),
      capacity: 24,
      status: 'published',
      plan: { confirmed: 24, waitlisted: 4 },
    },
    {
      slug: 'field-notes-career-studios',
      title: 'Field Notes Career Studios',
      summary: 'Short portfolio studios for students who want a review, not a career-fair tote bag.',
      description: 'Field Notes replaces the ballroom career fair with twenty-minute studios. Reviewers are hiring managers and senior ICs from studios that agreed to give actual feedback. Guests choose a domain interest at registration so the schedule can be built the week before.\n\nArrive ten minutes early. The studios do not run long.',
      category: 'Community',
      venue: 'Campus Quad Pavilion',
      city: 'Ann Arbor',
      image: '/covers/field.svg',
      starts: field,
      ends: hoursAfter(field, 6),
      capacity: 200,
      status: 'published',
      plan: { confirmed: 31 },
    },
    {
      slug: 'cedar-circuit-workshop',
      title: 'Cedar Circuit Workshop',
      summary: 'A hands-on soldering workshop that has been called off for the season.',
      description: 'Cedar Circuit was planned as a beginner soldering workshop in a RiNo warehouse. The facilitator had to withdraw, and the date could not be restaffed honestly. The event stays on the calendar so registered guests can see that it was cancelled rather than quietly deleted.\n\nNew registration is closed. Confirmed guests keep their records for the organizer.',
      category: 'Workshop',
      venue: 'RiNo Warehouse',
      city: 'Denver',
      image: '/covers/cedar.svg',
      starts: cedar,
      ends: hoursAfter(cedar, 3),
      capacity: 30,
      status: 'cancelled',
      plan: { confirmed: 9 },
    },
    {
      slug: 'midnight-maintainer-marathon',
      title: 'Midnight Maintainer Marathon',
      summary: 'A draft overnight for open-source maintainers. Not yet published.',
      description: 'This overnight is still a draft. The venue hold is tentative, and the organizer has not published the registration page. It appears in the admin workspace so the schedule, capacity, and description can be finished before anyone is invited.',
      category: 'Community',
      venue: 'The Foundry',
      city: 'San Francisco',
      image: '/covers/midnight.svg',
      starts: midnight,
      ends: hoursAfter(midnight, 8),
      capacity: 50,
      status: 'draft',
      plan: {},
    },
    {
      slug: 'southbank-review',
      title: 'Southbank Review',
      summary: 'Last month’s design review, kept on the books with real attendance.',
      description: 'Southbank Review was a morning of live critiques held three weeks ago. The record stays published so organizers can see who came, who checked in, and which seats went unused. Registration is closed because the event has ended.',
      category: 'Design',
      venue: 'Southbank Rooms',
      city: 'London',
      image: '/covers/southbank.svg',
      starts: southbank,
      ends: hoursAfter(southbank, 5),
      capacity: 80,
      status: 'published',
      plan: { checkedIn: 14, confirmed: 6, cancelled: 3 },
    },
    {
      slug: 'winter-salon-archive',
      title: 'Winter Salon',
      summary: 'An archived evening from last season, kept for the record and out of the public list.',
      description: 'Winter Salon has been archived. It no longer appears in public discovery. The registrations remain so the organizer can export them or compare last season with this one.',
      category: 'Arts',
      venue: 'Reading Room',
      city: 'Montreal',
      image: '/covers/winter.svg',
      starts: winter,
      ends: hoursAfter(winter, 3),
      capacity: 40,
      status: 'archived',
      plan: { confirmed: 8 },
    },
  ];
}

export function ensureAdmin(db) {
  const email = normalizeEmail(process.env.ADMIN_EMAIL || 'organizer@eventra.demo');
  const existing = db.prepare(`SELECT id FROM admins WHERE email = ?`).get(email);
  if (existing) return false;
  if (!process.env.ADMIN_PASSWORD && process.env.NODE_ENV === 'production') {
    throw new Error('Set ADMIN_PASSWORD before creating an organizer account in production.');
  }
  const password = process.env.ADMIN_PASSWORD || LOCAL_DEMO_PASSWORD;
  createAdmin(db, {
    email,
    password,
    name: process.env.ADMIN_NAME || 'Avery Quinn',
    rounds: 10,
  });
  console.log(`Administrator account ready: ${email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log('Local demo password is documented in the README. Set ADMIN_PASSWORD to override it.');
  }
  return true;
}

export function seedEventsIfEmpty(db) {
  const existing = db.prepare(`SELECT COUNT(*) AS n FROM events`).get().n;
  if (existing > 0) {
    console.log('Events already exist. Seed left them in place.');
    return false;
  }

  const insertEvent = db.prepare(
    `INSERT INTO events (
       slug, title, summary, description, category, venue, city, image_url,
       starts_at, ends_at, capacity, status, created_at, updated_at, details
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertRegistration = db.prepare(
    `INSERT INTO registrations (
       event_id, full_name, email, organization, interests, status, ticket_code,
       created_at, updated_at, checked_in_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const now = new Date().toISOString();
  let ticket = 1;
  let stamp = 0;
  for (const event of events()) {
    const look = presentationFor(event.slug);
    const info = insertEvent.run(
      event.slug,
      event.title,
      event.summary,
      event.description,
      event.category,
      event.venue,
      event.city,
      look?.image || event.image,
      event.starts,
      event.ends,
      event.capacity,
      event.status,
      now,
      now,
      JSON.stringify(look?.details || {}),
    );
    const eventId = Number(info.lastInsertRowid);
    const plan = [
      ...Array(event.plan.checkedIn || 0).fill('checked_in'),
      ...Array(event.plan.confirmed || 0).fill('confirmed'),
      ...Array(event.plan.waitlisted || 0).fill('waitlisted'),
      ...Array(event.plan.cancelled || 0).fill('cancelled'),
    ];
    plan.forEach((status, index) => {
      const person = PEOPLE[index % PEOPLE.length];
      const createdAt = daysAgo(stamp % 14);
      stamp += 1;
      const checkedInAt = status === 'checked_in' ? event.starts : null;
      const code = `EVSEED${String(ticket).padStart(4, '0')}`;
      ticket += 1;
      insertRegistration.run(
        eventId,
        person[0],
        emailOf(person[0], event.slug),
        person[1],
        JSON.stringify(person[2]),
        status,
        code,
        createdAt,
        createdAt,
        checkedInAt,
      );
    });
  }
  console.log('Seeded the Eventra calendar.');
  return true;
}

export function initializeDatabase(db) {
  migrate(db);
  const adminCreated = ensureAdmin(db);
  const seeded = seedEventsIfEmpty(db);
  applyCatalog(db);
  return { adminCreated, seeded };
}

export function resetDatabase(filename) {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${filename}${suffix}`, { force: true });
  }
  const db = openDatabase(filename);
  const result = initializeDatabase(db);
  db.close();
  return result;
}
