import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Photo } from '../components/EventCard.jsx';
import { ErrorBlock, Field, PageTitle } from '../components/ui.jsx';
import { formatMoney, formatRange } from '../format.js';

const STEPS = ['Tickets', 'Payment', 'Verification', 'Confirmation'];

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function motionDelay(ms) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  return wait(ms);
}

function groupCard(value) {
  return value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function groupExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('The payment provider could not be loaded.'));
    document.body.appendChild(script);
  });
}

export function PaymentPage() {
  const { publicId } = useParams();
  const [payment, setPayment] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState('form');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [verification, setVerification] = useState(null);
  const [otp, setOtp] = useState('');
  const [registration, setRegistration] = useState(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const controller = new AbortController();
    api(`/api/payments/${publicId}`, { signal: controller.signal })
      .then(async (data) => {
        setPayment(data.payment);
        setCheckout(data.checkout);
        if (data.payment.status === 'paid') setStep(3);
        else if (data.payment.status === 'failed' || data.payment.status === 'expired' || data.payment.status === 'cancelled') setPhase('failed');
        if (data.payment.event?.slug) {
          const eventData = await api(`/api/events/${data.payment.event.slug}`, { signal: controller.signal });
          const type = (eventData.event.ticketTypes || []).find((item) => item.name === data.payment.ticketLabel);
          if (type) {
            setQuote({
              unit: type.priceCents,
              fee: type.feeCents,
              quantity: data.payment.quantity,
            });
          }
        }
      })
      .catch((loadError) => {
        if (loadError.name === 'AbortError') return;
        setError(loadError.message);
      });
    return () => controller.abort();
  }, [publicId]);

  useEffect(() => {
    if (!resendAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  const subtotal = quote ? quote.unit * quote.quantity : payment?.amountCents || 0;
  const fees = quote ? quote.fee * quote.quantity : 0;
  const total = payment?.amountCents || subtotal + fees;
  const resendWait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const demo = (checkout?.provider || payment?.provider) === 'development';
  const provider = checkout?.provider || payment?.provider;

  function rememberCode(next) {
    setVerification(next);
    setResendAt(Date.now() + 60 * 1000);
    setNow(Date.now());
  }

  async function submitCard(formEvent) {
    formEvent.preventDefault();
    setFormError('');
    setFieldErrors({});
    setPhase('processing');
    try {
      const [data] = await Promise.all([
        api(`/api/payments/${publicId}/card`, {
          method: 'POST',
          body: {
            cardNumber: card.number,
            cardholderName: card.name,
            expiry: card.expiry,
            cvv: card.cvv,
          },
        }),
        motionDelay(900),
      ]);
      setCard({ number: '', name: card.name, expiry: '', cvv: '' });
      setPayment(data.payment);
      if (data.declined) {
        setFormError(data.message);
        setPhase('failed');
        return;
      }
      rememberCode(data.verification);
      setStep(2);
      setPhase('form');
    } catch (submitError) {
      setFieldErrors(submitError.fields || {});
      setFormError(submitError.message);
      setPhase('form');
    }
  }

  async function verifyCode(formEvent) {
    formEvent.preventDefault();
    setFormError('');
    setPhase('processing');
    try {
      const [data] = await Promise.all([
        api(`/api/payments/${publicId}/otp/verify`, { method: 'POST', body: { code: otp } }),
        motionDelay(800),
      ]);
      setRegistration(data.registration);
      setPayment(data.payment);
      setStep(3);
      setPhase('form');
    } catch (verifyError) {
      setFormError(verifyError.message);
      setPhase(verifyError.code === 'PAYMENT_EXPIRED' || verifyError.code === 'PAYMENT_CLOSED' ? 'failed' : 'form');
    }
  }

  async function resend() {
    setFormError('');
    try {
      const data = await api(`/api/payments/${publicId}/otp`, { method: 'POST', body: {} });
      rememberCode(data.verification);
      setOtp('');
    } catch (resendError) {
      setFormError(resendError.message);
    }
  }

  async function payWithRazorpay() {
    setFormError('');
    setPhase('processing');
    try {
      await loadRazorpay();
      setPhase('form');
      const razorpay = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency || 'USD',
        name: 'Eventra',
        description: payment.event.title,
        order_id: checkout.orderId,
        handler: async (response) => {
          setPhase('processing');
          try {
            const data = await api('/api/payments/razorpay/verify', {
              method: 'POST',
              body: {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              },
            });
            setRegistration(data.registration);
            setStep(3);
            setPhase('form');
          } catch (verifyError) {
            setFormError(verifyError.message);
            setPhase('failed');
          }
        },
        modal: {
          ondismiss: () => setPhase('form'),
        },
        theme: { color: '#3554ee' },
      });
      razorpay.open();
    } catch (providerError) {
      setFormError(providerError.message);
      setPhase('form');
    }
  }

  if (error) return <div className="page"><div className="wrap"><ErrorBlock message={error} /></div></div>;
  if (!payment) return <div className="page"><div className="wrap"><div className="skeleton" /></div></div>;

  return (
    <div className="page pay-page">
      <PageTitle title="Payment" />
      <div className="wrap pay-layout">
        <section className={`pay-panel ${phase === 'processing' ? 'is-busy' : ''}`}>
          <ol className="steps" aria-label="Payment progress">
            {STEPS.map((label, index) => (
              <li key={label} className={index === step ? 'on' : index < step ? 'done' : ''} aria-current={index === step ? 'step' : undefined}>
                <span>{index < step ? '✓' : index + 1}</span>
                {label}
              </li>
            ))}
          </ol>

          {demo ? (
            <p className="demo-banner">DEMO PAYMENT MODE. No bank is involved and no real charge is made.</p>
          ) : null}

          {phase === 'processing' ? (
            <div className="pay-status" role="status">
              <span className="pay-spinner" aria-hidden="true" />
              <h1>{step >= 2 ? 'Verifying' : 'Processing'}</h1>
              <p className="muted">{step >= 2 ? 'Checking the development code.' : 'Sending the demo payment request.'}</p>
            </div>
          ) : null}

          {phase === 'failed' ? (
            <div className="pay-status">
              <div className="check check-bad" aria-hidden="true">!</div>
              <h1>Payment was not completed</h1>
              <p className="muted">{formError || payment.note || 'This demo payment was not confirmed.'}</p>
              <div className="actions">
                <Link className="btn btn-primary" to={`/events/${payment.event.slug}/register`}>Try again</Link>
                <Link className="btn btn-ghost" to={`/events/${payment.event.slug}`}>Back to event</Link>
              </div>
            </div>
          ) : null}

          {phase === 'form' && step === 0 ? (
            <div className="stack pay-step">
              <h1>Ticket details</h1>
              <p className="muted">Review the seat before entering payment details.</p>
              <div className="review-list">
                <div><span>Event</span><strong>{payment.event.title}</strong></div>
                <div><span>When</span><strong>{formatRange(payment.event.startsAt, payment.event.endsAt || payment.event.startsAt)}</strong></div>
                <div><span>Ticket</span><strong>{payment.ticketLabel}</strong></div>
                <div><span>Quantity</span><strong>{payment.quantity}</strong></div>
                <div><span>Guest</span><strong>{payment.fullName}</strong></div>
                <div><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>
                <div><span>Fees</span><strong>{fees ? formatMoney(fees) : 'None'}</strong></div>
                <div><span>Total</span><strong>{formatMoney(total)}</strong></div>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => setStep(1)}>Continue to payment</button>
            </div>
          ) : null}

          {phase === 'form' && step === 1 && provider === 'razorpay' ? (
            <div className="stack pay-step">
              <h1>Payment details</h1>
              <p className="muted">This event uses the configured Razorpay sandbox. Complete payment in the provider window.</p>
              <p className="secure-note">Secure checkout through Razorpay. Eventra does not store your card.</p>
              {formError ? <p className="field-error" role="alert">{formError}</p> : null}
              <div className="actions">
                <button className="btn btn-ghost" type="button" onClick={() => setStep(0)}>Back</button>
                <button className="btn btn-primary" type="button" onClick={payWithRazorpay}>Pay {formatMoney(total)}</button>
              </div>
            </div>
          ) : null}

          {phase === 'form' && step === 1 && provider !== 'razorpay' ? (
            <form className="form-grid pay-step" onSubmit={submitCard} noValidate>
              <h1>Payment details</h1>
              <p className="muted">Use a synthetic test card. The number and security code are checked, then discarded.</p>
              <p className="secure-note">Demo checkout only. Card numbers and CVVs are not stored.</p>
              <Field id="card-number" label="Card number" error={fieldErrors.cardNumber}>
                <input id="card-number" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={card.number} onChange={(event) => setCard({ ...card, number: groupCard(event.target.value) })} aria-invalid={Boolean(fieldErrors.cardNumber)} />
              </Field>
              <Field id="card-name" label="Cardholder name" error={fieldErrors.cardholderName}>
                <input id="card-name" autoComplete="cc-name" placeholder="Name on card" value={card.name} onChange={(event) => setCard({ ...card, name: event.target.value })} aria-invalid={Boolean(fieldErrors.cardholderName)} />
              </Field>
              <div className="two">
                <Field id="card-expiry" label="Expiry date" error={fieldErrors.expiry}>
                  <input id="card-expiry" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={card.expiry} onChange={(event) => setCard({ ...card, expiry: groupExpiry(event.target.value) })} aria-invalid={Boolean(fieldErrors.expiry)} />
                </Field>
                <Field id="card-cvv" label="CVV" error={fieldErrors.cvv}>
                  <input id="card-cvv" inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4} value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value.replace(/\D/g, '').slice(0, 4) })} aria-invalid={Boolean(fieldErrors.cvv)} />
                </Field>
              </div>
              <p className="meta">Test card 4242 4242 4242 4242 is accepted. 4000 0000 0000 0002 is declined.</p>
              {formError ? <p className="field-error" role="alert">{formError}</p> : null}
              <div className="actions">
                <button className="btn btn-ghost" type="button" onClick={() => setStep(0)}>Back</button>
                <button className="btn btn-primary" type="submit">Pay {formatMoney(total)}</button>
              </div>
            </form>
          ) : null}

          {phase === 'form' && step === 2 ? (
            <form className="form-grid pay-step" onSubmit={verifyCode}>
              <h1>Verification</h1>
              <div className="verify-orb" aria-hidden="true"><span /></div>
              <p className="muted">Enter the 6-digit development code for this demo payment. A bank did not send it.</p>
              {verification?.code ? (
                <p className="demo-code">
                  <span>Development only</span>
                  <strong>{verification.code}</strong>
                  <span>Shown here so the local demo can be completed. It was not emailed or texted.</span>
                </p>
              ) : null}
              <Field id="otp" label="Development code" error={formError}>
                <input id="otp" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
              </Field>
              <div className="actions">
                <button className="btn btn-ghost" type="button" onClick={resend} disabled={resendWait > 0}>
                  {resendWait > 0 ? `Resend in ${resendWait}s` : 'Resend code'}
                </button>
                <button className="btn btn-primary" type="submit">Verify</button>
              </div>
            </form>
          ) : null}

          {phase === 'form' && step === 3 ? (
            <div className="pay-status pay-step">
              <div className="check check-draw" aria-hidden="true">✓</div>
              <h1>Payment confirmed</h1>
              <p className="muted">This was a demo payment. A seat is now saved for {payment.fullName}.</p>
              <p className="meta">Reference {registration?.ticketCode || payment.ticketCode}</p>
              <div className="actions">
                <Link className="btn btn-primary" to={`/tickets/${registration?.ticketCode || payment.ticketCode}`}>View ticket</Link>
                <Link className="btn btn-ghost" to={`/confirmation/${registration?.ticketCode || payment.ticketCode}`}>Confirmation</Link>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="panel pay-summary">
          <Photo src={payment.event.imageUrl} alt="" />
          <p className="kicker">Order</p>
          <h2>{payment.event.title}</h2>
          <p className="meta">{payment.event.venue}, {payment.event.city}</p>
          <div className="review-list">
            <div><span>{payment.ticketLabel}</span><strong>× {payment.quantity}</strong></div>
            <div><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>
            <div><span>Fees</span><strong>{fees ? formatMoney(fees) : 'None'}</strong></div>
            <div><span>Total</span><strong>{formatMoney(total)}</strong></div>
          </div>
          {payment.cardLast4 ? <p className="meta">{payment.cardBrand} ···· {payment.cardLast4}</p> : null}
          <p className="meta">Amounts are shown in US dollars.</p>
        </aside>
      </div>
    </div>
  );
}
