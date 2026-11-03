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

function luhnValid(number) {
  let sum = 0;
  let alternate = false;
  for (let index = number.length - 1; index >= 0; index -= 1) {
    let digit = Number(number[index]);
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function cardBrand(number) {
  if (number.startsWith('4')) return 'Visa';
  if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return 'Mastercard';
  if (/^3[47]/.test(number)) return 'American Express';
  return 'Card';
}

function validateCard(card) {
  const digits = card.number.replace(/\D/g, '');
  const cvv = card.cvv.replace(/\D/g, '');
  const name = card.name.trim().replace(/\s+/g, ' ');
  const fields = {};
  if (digits.length < 13 || digits.length > 19 || !luhnValid(digits)) {
    fields.cardNumber = 'Enter a valid card number.';
  }
  const expiryMatch = card.expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!expiryMatch) {
    fields.expiry = 'Use the month and year as MM/YY.';
  } else {
    const month = Number(expiryMatch[1]);
    const year = Number(`20${expiryMatch[2]}`);
    const end = new Date(year, month, 1).getTime();
    if (month < 1 || month > 12 || end <= Date.now()) fields.expiry = 'Enter a future expiry date.';
  }
  if (cvv.length < 3 || cvv.length > 4) fields.cvv = 'Enter the security code.';
  if (name.length < 2 || name.length > 80) fields.cardholderName = 'Enter the name on the card.';
  return { fields, digits, brand: cardBrand(digits), name };
}

function clock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('The payment window could not be loaded.'));
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
  const [now, setNow] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api(`/api/payments/${publicId}`, { signal: controller.signal })
      .then(async (data) => {
        setPayment(data.payment);
        setCheckout(data.checkout);
        if (data.payment.status === 'paid') setStep(3);
        else if (data.payment.status === 'failed' || data.payment.status === 'expired' || data.payment.status === 'cancelled') setPhase('failed');
        else if (data.verification?.sent) {
          setVerification(data.verification);
          setResendAt(new Date(data.verification.resendAvailableAt).getTime());
          setNow(Date.now());
          setStep(2);
        }
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
    const tick = () => setNow(Date.now());
    const immediate = window.setTimeout(tick, 0);
    if (!resendAt && !verification?.expiresAt) return () => window.clearTimeout(immediate);
    const timer = window.setInterval(tick, 500);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
    };
  }, [resendAt, verification?.expiresAt]);

  const subtotal = quote ? quote.unit * quote.quantity : payment?.amountCents || 0;
  const fees = quote ? quote.fee * quote.quantity : 0;
  const total = payment?.amountCents || subtotal + fees;
  const resendWait = now ? Math.max(0, Math.ceil((resendAt - now) / 1000)) : 0;
  const expireWait = now && verification?.expiresAt
    ? Math.max(0, Math.ceil((new Date(verification.expiresAt).getTime() - now) / 1000))
    : null;
  const provider = checkout?.provider || payment?.provider;
  const codeExpired = step === 2 && verification?.expiresAt && expireWait === 0;
  const verifyMessage = formError || (codeExpired ? 'This verification code has expired. Request a new one.' : '');

  function rememberCode(next) {
    setVerification(next);
    setResendAt(next?.resendAvailableAt ? new Date(next.resendAvailableAt).getTime() : Date.now() + 60 * 1000);
    setNow(Date.now());
  }

  async function submitCard(formEvent) {
    formEvent.preventDefault();
    setFormError('');
    const summary = validateCard(card);
    if (Object.keys(summary.fields).length) {
      setFieldErrors(summary.fields);
      return;
    }
    setFieldErrors({});
    setPhase('processing');
    try {
      const [data] = await Promise.all([
        api(`/api/payments/${publicId}/card`, {
          method: 'POST',
          body: {
            cardLast4: summary.digits.slice(-4),
            cardBrand: summary.brand,
            cardholderName: summary.name,
          },
        }),
        motionDelay(900),
      ]);
      if (!data.verification?.sent) {
        setFormError('We could not send a verification code. Please try again.');
        setPhase('form');
        return;
      }
      setCard({ number: '', name: '', expiry: '', cvv: '' });
      setPayment(data.payment);
      rememberCode(data.verification);
      setOtp('');
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
    if (codeExpired) {
      setFormError('This verification code has expired. Request a new one.');
      return;
    }
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
    setSendingCode(true);
    try {
      const data = await api(`/api/payments/${publicId}/otp`, { method: 'POST', body: {} });
      if (!data.verification?.sent) {
        setFormError('We could not send a verification code. Please try again.');
        return;
      }
      rememberCode(data.verification);
      setOtp('');
    } catch (resendError) {
      setFormError(resendError.message);
    } finally {
      setSendingCode(false);
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

          {phase === 'processing' ? (
            <div className="pay-status" role="status">
              <span className="pay-spinner" aria-hidden="true" />
              <h1>{step >= 2 ? 'Verifying' : 'Sending code'}</h1>
              <p className="muted">{step >= 2 ? 'Checking your verification code.' : 'Sending your verification code.'}</p>
            </div>
          ) : null}

          {phase === 'failed' ? (
            <div className="pay-status">
              <div className="check check-bad" aria-hidden="true">!</div>
              <h1>Registration was not completed</h1>
              <p className="muted">{formError || payment.note || 'Please start again to reserve your seat.'}</p>
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
              <p className="muted">Complete checkout in the secure payment window.</p>
              <p className="secure-note">Eventra does not store your card number.</p>
              {formError ? <p className="field-error" role="alert">{formError}</p> : null}
              <div className="actions">
                <button className="btn btn-ghost" type="button" onClick={() => setStep(0)}>Back</button>
                <button className="btn btn-primary" type="button" onClick={payWithRazorpay}>Continue</button>
              </div>
            </div>
          ) : null}

          {phase === 'form' && step === 1 && provider !== 'razorpay' ? (
            <form className="form-grid pay-step" onSubmit={submitCard} noValidate>
              <h1>Payment details</h1>
              <p className="muted">Enter your card details to continue. A verification code will be emailed to you.</p>
              <p className="secure-note">Card numbers and security codes are not stored.</p>
              <Field id="card-number" label="Card number" error={fieldErrors.cardNumber}>
                <input id="card-number" inputMode="numeric" autoComplete="cc-number" placeholder="Card number" value={card.number} onChange={(event) => setCard({ ...card, number: groupCard(event.target.value) })} aria-invalid={Boolean(fieldErrors.cardNumber)} />
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
              {formError ? <p className="field-error" role="alert">{formError}</p> : null}
              <div className="actions">
                <button className="btn btn-ghost" type="button" onClick={() => setStep(0)}>Back</button>
                <button className="btn btn-primary" type="submit">Continue</button>
              </div>
            </form>
          ) : null}

          {phase === 'form' && step === 2 ? (
            <form className="form-grid pay-step" onSubmit={verifyCode}>
              <h1>Verify Your Email</h1>
              <div className="verify-orb" aria-hidden="true"><span /></div>
              <p className="muted">We've sent a 6-digit verification code to your registered email address.</p>
              <p className="meta">{verification?.maskedEmail || 'your email'}</p>
              <p className="meta" role="status">{expireWait == null ? '' : codeExpired ? 'This code has expired.' : `Code expires in ${clock(expireWait)}`}</p>
              <Field id="otp" label="Verification code" error={verifyMessage}>
                <input id="otp" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} aria-invalid={Boolean(verifyMessage)} />
              </Field>
              <div className="actions">
                <button className="btn btn-ghost" type="button" onClick={resend} disabled={resendWait > 0 || sendingCode}>
                  {sendingCode ? 'Sending…' : resendWait > 0 ? `Resend in ${resendWait}s` : 'Resend code'}
                </button>
                <button className="btn btn-primary" type="submit" disabled={codeExpired || otp.length !== 6}>Verify</button>
              </div>
            </form>
          ) : null}

          {phase === 'form' && step === 3 ? (
            <div className="pay-status pay-step">
              <div className="check check-draw" aria-hidden="true">✓</div>
              <h1>Registration confirmed</h1>
              <p className="muted">Your seat is reserved for {payment.fullName}.</p>
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
