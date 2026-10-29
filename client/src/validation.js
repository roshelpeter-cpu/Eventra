export function validateRegistration(values) {
  const fields = {};
  const fullName = values.fullName.trim().replace(/\s+/g, ' ');
  const email = values.email.trim().toLowerCase();
  const organization = values.organization.trim().replace(/\s+/g, ' ');
  const interests = values.interests || [];

  if (fullName.length < 2) fields.fullName = 'Enter your full name.';
  else if (fullName.length > 120) fields.fullName = 'Name must be 120 characters or fewer.';
  else if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(fullName)) {
    fields.fullName = 'Use letters, spaces, apostrophes, or hyphens.';
  }

  if (!email) fields.email = 'Enter your email address.';
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fields.email = 'Enter a valid email address.';
  }

  if (organization.length < 2) fields.organization = 'Enter your college or organization.';
  else if (organization.length > 160) fields.organization = 'Organization must be 160 characters or fewer.';

  if (interests.length === 0) fields.interests = 'Choose at least one domain interest.';
  else if (interests.length > 6) fields.interests = 'Choose up to six interests.';

  if (!values.consent) fields.consent = 'Confirm that the information is correct.';

  return fields;
}

export function validateEvent(values) {
  const fields = {};
  if (values.title.trim().length < 3) fields.title = 'Title must be at least 3 characters.';
  if (values.summary.trim().length < 10) fields.summary = 'Summary must be at least 10 characters.';
  if (values.description.trim().length < 20) fields.description = 'Description must be at least 20 characters.';
  if (!values.category) fields.category = 'Choose a category.';
  if (values.venue.trim().length < 2) fields.venue = 'Enter a venue.';
  if (values.city.trim().length < 2) fields.city = 'Enter a city.';
  if (!values.imageUrl.trim()) fields.imageUrl = 'Choose a cover or paste an image URL.';
  if (!values.startsAt) fields.startsAt = 'Enter a start date.';
  if (!values.endsAt) fields.endsAt = 'Enter an end date.';
  if (values.startsAt && values.endsAt && new Date(values.endsAt) <= new Date(values.startsAt)) {
    fields.endsAt = 'End must be after the start.';
  }
  const capacity = Number(values.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20000) {
    fields.capacity = 'Capacity must be a whole number from 1 to 20000.';
  }
  return fields;
}
