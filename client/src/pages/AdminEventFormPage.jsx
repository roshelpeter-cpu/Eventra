import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { CATEGORIES, COVERS } from '../constants.js';
import { useToast } from '../components/useToast.js';
import { ErrorBlock, Field, PageTitle } from '../components/ui.jsx';
import { toDateTimeLocal } from '../format.js';
import { validateEvent } from '../validation.js';

const EMPTY = {
  title: '',
  summary: '',
  description: '',
  category: 'Design',
  venue: '',
  city: '',
  imageUrl: '/covers/custom.svg',
  startsAt: '',
  endsAt: '',
  capacity: '40',
  status: 'draft',
  format: 'in-person',
};

export function AdminEventFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const editing = Boolean(id);
  const [details, setDetails] = useState(null);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!id) return undefined;
    const controller = new AbortController();
    api(`/api/admin/events/${id}`, { signal: controller.signal })
      .then((data) => {
        const event = data.event;
        setValues({
          title: event.title,
          summary: event.summary,
          description: event.description,
          category: event.category,
          venue: event.venue,
          city: event.city,
          imageUrl: event.imageUrl,
          startsAt: toDateTimeLocal(event.startsAt),
          endsAt: toDateTimeLocal(event.endsAt),
          capacity: String(event.capacity),
          status: event.status,
          format: event.details?.format || 'in-person',
        });
        setDetails(event.details || null);
        setLoading(false);
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setLoadError(error.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  function update(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = validateEvent(values);
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) return;
    const body = {
      title: values.title.trim(),
      summary: values.summary.trim(),
      description: values.description.trim(),
      category: values.category,
      venue: values.venue.trim(),
      city: values.city.trim(),
      imageUrl: values.imageUrl.trim(),
      startsAt: new Date(values.startsAt).toISOString(),
      endsAt: new Date(values.endsAt).toISOString(),
      capacity: Number(values.capacity),
      status: values.status,
      format: values.format,
    };
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/admin/events/${id}`, { method: 'PATCH', body });
        toast('Event updated.');
      } else {
        await api('/api/admin/events', { method: 'POST', body });
        toast('Event created.');
      }
      navigate('/admin/events');
    } catch (saveError) {
      setErrors(saveError.fields || {});
      setFormError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="skeleton skeleton-card" />;
  if (loadError) return <ErrorBlock message={loadError} />;

  return (
    <section>
      <PageTitle title={editing ? 'Edit event' : 'New event'} />
      <div className="admin-top">
        <div>
          <p className="kicker">{editing ? 'Edit' : 'Create'}</p>
          <h1>{editing ? 'Edit event' : 'New event'}</h1>
        </div>
        <Link className="btn btn-ghost" to="/admin/events">Back to events</Link>
      </div>
      <form className="form-grid table-card" onSubmit={submit} noValidate>
        <Field id="title" label="Title" error={errors.title}>
          <input id="title" value={values.title} aria-invalid={Boolean(errors.title)} onChange={(event) => update('title', event.target.value)} />
        </Field>
        <Field id="summary" label="Summary" error={errors.summary}>
          <textarea id="summary" value={values.summary} aria-invalid={Boolean(errors.summary)} onChange={(event) => update('summary', event.target.value)} />
        </Field>
        <Field id="description" label="Description" error={errors.description} hint="Separate paragraphs with a blank line.">
          <textarea id="description" value={values.description} aria-invalid={Boolean(errors.description)} onChange={(event) => update('description', event.target.value)} />
        </Field>
        <div className="two">
          <Field id="category" label="Category" error={errors.category}>
            <select id="category" value={values.category} onChange={(event) => update('category', event.target.value)}>
              {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </Field>
          <Field id="status" label="Publication status">
            <select id="status" value={values.status} onChange={(event) => update('status', event.target.value)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
        </div>
        <Field id="format" label="Event type" error={errors.format}>
          <select id="format" value={values.format || 'in-person'} onChange={(event) => update('format', event.target.value)}>
            <option value="in-person">In person</option>
            <option value="online">Online</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </Field>
        <div className="two">
          <Field id="venue" label="Venue" error={errors.venue}>
            <input id="venue" value={values.venue} aria-invalid={Boolean(errors.venue)} onChange={(event) => update('venue', event.target.value)} />
          </Field>
          <Field id="city" label="City" error={errors.city}>
            <input id="city" value={values.city} aria-invalid={Boolean(errors.city)} onChange={(event) => update('city', event.target.value)} />
          </Field>
        </div>
        <div className="two">
          <Field id="startsAt" label="Starts" error={errors.startsAt}>
            <input id="startsAt" type="datetime-local" value={values.startsAt} aria-invalid={Boolean(errors.startsAt)} onChange={(event) => update('startsAt', event.target.value)} />
          </Field>
          <Field id="endsAt" label="Ends" error={errors.endsAt}>
            <input id="endsAt" type="datetime-local" value={values.endsAt} aria-invalid={Boolean(errors.endsAt)} onChange={(event) => update('endsAt', event.target.value)} />
          </Field>
        </div>
        <Field id="capacity" label="Capacity" error={errors.capacity}>
          <input id="capacity" type="number" min="1" max="20000" value={values.capacity} aria-invalid={Boolean(errors.capacity)} onChange={(event) => update('capacity', event.target.value)} />
        </Field>
        <div className="field">
          <p>Cover</p>
          <div className="cover-picker">
            {COVERS.map(([url, label]) => (
              <button key={url} type="button" aria-pressed={values.imageUrl === url} aria-label={label} onClick={() => update('imageUrl', url)}>
                <img src={url} alt="" />
              </button>
            ))}
          </div>
        </div>
        <Field id="imageUrl" label="Image path or URL" error={errors.imageUrl}>
          <input id="imageUrl" value={values.imageUrl} aria-invalid={Boolean(errors.imageUrl)} onChange={(event) => update('imageUrl', event.target.value)} />
        </Field>
        {values.imageUrl ? <img className="preview" src={values.imageUrl} alt="" /> : null}
        {details?.schedule?.length ? (
          <div className="field">
            <p>Schedule already saved</p>
            <ul className="perk-list">
              {details.schedule.map((item) => <li key={`${item.time}-${item.title}`}>{item.time} · {item.title}</li>)}
            </ul>
            <p className="hint">Editing the fields above keeps this schedule, the speakers, and the FAQs.</p>
          </div>
        ) : null}
        {formError ? <p className="notice notice-warn" role="alert">{formError}</p> : null}
        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create event'}</button>
        </div>
      </form>
    </section>
  );
}
