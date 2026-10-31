import { Route, Routes } from 'react-router-dom';
import { PublicLayout } from './components/Layout.jsx';
import { AdminCheckInPage } from './pages/AdminCheckInPage.jsx';
import { AdminEventFormPage } from './pages/AdminEventFormPage.jsx';
import { AdminEventsPage } from './pages/AdminEventsPage.jsx';
import { AdminNotFound, NotFoundPage, RequireAdmin } from './pages/AdminGate.jsx';
import { AdminLoginPage } from './pages/AdminLoginPage.jsx';
import { AdminOverviewPage } from './pages/AdminOverviewPage.jsx';
import { AdminAttendeesPage } from './pages/AdminAttendeesPage.jsx';
import { AdminSettingsPage } from './pages/AdminSettingsPage.jsx';
import { ContactPage } from './pages/ContactPage.jsx';
import { EventDetailPage } from './pages/EventDetailPage.jsx';
import { EventsPage } from './pages/EventsPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { AboutPage } from './pages/InfoPages.jsx';
import { PaymentPage } from './pages/PaymentPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { SavedPage, TicketsHome } from './pages/AccountPages.jsx';
import { ConfirmationPage, TicketPage } from './pages/TicketPages.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="events/:id/register" element={<RegisterPage />} />
        <Route path="pay/:publicId" element={<PaymentPage />} />
        <Route path="saved" element={<SavedPage />} />
        <Route path="tickets" element={<TicketsHome />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="confirmation/:code" element={<ConfirmationPage />} />
        <Route path="tickets/:code" element={<TicketPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="admin/login" element={<AdminLoginPage />} />
      <Route path="admin" element={<RequireAdmin />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="events" element={<AdminEventsPage />} />
        <Route path="events/new" element={<AdminEventFormPage />} />
        <Route path="events/:id/edit" element={<AdminEventFormPage />} />
        <Route path="attendees" element={<AdminAttendeesPage />} />
        <Route path="check-in" element={<AdminCheckInPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="*" element={<AdminNotFound />} />
      </Route>
    </Routes>
  );
}
