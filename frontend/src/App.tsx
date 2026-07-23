import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
// v2.1 — polls, reports, events docs
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CartProvider } from "@/contexts/CartContext";
import { SchoolProvider } from "@/hooks/useSchoolContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequirePersonalTrainer } from "@/components/trainer/RequirePersonalTrainer";
import AuthLayout from "@/layouts/AuthLayout";
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Suspense, lazy } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { InstallBanner } from "./pwa/InstallBanner";
import { UpdateBanner } from "./pwa/UpdateBanner";
import { IdleTimer } from "@/components/auth/IdleTimer";
import { IdleConfigProvider } from "@/contexts/IdleConfigContext";


// ─── Skeleton de carga global ─────────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      <p className="text-sm text-muted-foreground animate-pulse">Cargando...</p>
    </div>
  </div>
);

// ─── Public pages (lazy) ──────────────────────────────────────────────────────
const Index = lazy(() => import("./pages/Index"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const OnboardingRolePage = lazy(() => import("./pages/OnboardingRolePage"));
const JoinTeamPage = lazy(() => import("./pages/JoinTeamPage"));
const JoinPlanPage = lazy(() => import("./pages/JoinPlanPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const SchoolDetailPage = lazy(() => import("./pages/SchoolDetailPage"));
const UnauthorizedPage = lazy(() => import("./pages/UnauthorizedPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const ParentCheckoutPage = lazy(() => import("./pages/ParentCheckoutPage"));
const PaymentResultPage = lazy(() => import("./pages/PaymentResultPage"));
const PaymentConfirmationPage = lazy(() => import("./pages/PaymentConfirmationPage"));
const PublicSchoolPage = lazy(() => import("./pages/PublicSchoolPage"));
const SchoolProfilePage = lazy(() => import("./pages/SchoolProfilePage"));
const SchoolPublicProfilePage = lazy(() => import("./pages/school/SchoolPublicProfilePage"));
const VendorPublicProfilePage = lazy(() => import("./pages/vendor/VendorPublicProfilePage"));
const MyAppointmentsPage = lazy(() => import("./pages/wellness/MyAppointmentsPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const RecepcionPage = lazy(() => import("./pages/recepcion/RecepcionPage"));

// ─── Events (public, lazy) ────────────────────────────────────────────────────
const EventsMapPage = lazy(() => import("./pages/events/EventsMapPage"));
const EventPublicPage = lazy(() => import("./pages/events/EventPublicPage"));
const EventIndividualRegisterPage = lazy(() => import("./pages/events/EventIndividualRegisterPage"));
const MyEventRegistrationsPage = lazy(() => import("./pages/events/MyEventRegistrationsPage"));

// ─── Polls (lazy) ────────────────────────────────────────────────────────────
const PollsPage = lazy(() => import("./pages/polls/PollsPage"));
const PublicPollPage = lazy(() => import("./pages/polls/PublicPollPage"));
const PollResultsPage = lazy(() => import("./pages/polls/PollResultsPage"));

// ─── Dashboard pages (lazy) ───────────────────────────────────────────────────
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const TeamsPage = lazy(() => import("./pages/TeamsPage"));
const OfferingsPage = lazy(() => import("./pages/OfferingsPage"));
const StatsPage = lazy(() => import("./pages/StatsPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const MyEnrollmentsPage = lazy(() => import("./pages/MyEnrollmentsPage"));
const ShopPage = lazy(() => import("./pages/ShopPage"));

// ─── Parent pages (lazy) ──────────────────────────────────────────────────────
const MyChildrenPage = lazy(() => import("./pages/MyChildrenPage"));
const ChildProgressPage = lazy(() => import("./pages/ChildProgressPage"));
const ChildAttendancePage = lazy(() => import("./pages/ChildAttendancePage"));
const AcademicProgressPage = lazy(() => import("./pages/AcademicProgressPage"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const MyPaymentsPage = lazy(() => import("./pages/MyPaymentsPage"));

// ─── Coach pages (lazy) ───────────────────────────────────────────────────────
const CoachAttendancePage = lazy(() => import("./pages/CoachAttendancePage"));
const CoachPlansPage = lazy(() => import("./pages/CoachPlansPage"));
const ResultsPage = lazy(() => import("./pages/ResultsPage"));
const TrainingPlansPage = lazy(() => import("./pages/TrainingPlansPage"));
const CoachReportsPage = lazy(() => import("./pages/CoachReportsPage"));
const CoachEvaluationsPage = lazy(() => import("./pages/CoachEvaluationsPage"));
const AnnouncementsPage = lazy(() => import("./pages/AnnouncementsPage"));

// ─── School pages (lazy) ──────────────────────────────────────────────────────
const SchoolStudentsManagementPage = lazy(() => import("./pages/SchoolStudentsManagementPage"));
const MiPlanPage = lazy(() => import("./pages/MiPlanPage"));
const AdminUpgradeRequestsPage = lazy(() => import("./pages/AdminUpgradeRequestsPage"));
const StaffPage = lazy(() => import("./pages/StaffPage"));
const ProgramsManagementPage = lazy(() => import("./pages/ProgramsManagementPage"));
const AttendanceSupervisionPage = lazy(() => import("./pages/AttendanceSupervisionPage"));
const ResultsOverviewPage = lazy(() => import("./pages/ResultsOverviewPage"));
const FinancesPage = lazy(() => import("./pages/FinancesPage"));
const AccountingPage = lazy(() => import("./pages/AccountingPage"));
const AccountingSuppliersPage = lazy(() => import("./pages/AccountingSuppliersPage"));
const PayrollPage = lazy(() => import("./pages/PayrollPage"));
const AccountingReportsPage = lazy(() => import("./pages/AccountingReportsPage"));
const AccountingBudgetPage = lazy(() => import("./pages/AccountingBudgetPage"));
const PaymentsAutomationPage = lazy(() => import("./pages/PaymentsAutomationPage"));
const PaymentRemindersPage = lazy(() => import("./pages/PaymentRemindersPage"));
const MessageTemplatesPage = lazy(() => import("./pages/MessageTemplatesPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SchoolFacilitiesPage = lazy(() => import("./pages/SchoolFacilitiesPage"));
const SchoolBranchesManagementPage = lazy(() => import("./pages/SchoolBranchesManagementPage"));
const SchoolSettingsPage = lazy(() => import("./pages/SchoolSettingsPage"));
const PickupMonitorPage = lazy(() => import("./pages/school/PickupMonitorPage"));
const InvitationsManagementPage = lazy(() => import("./pages/InvitationsManagementPage"));
const ReporterDashboardPage = lazy(() => import("./pages/ReporterDashboardPage"));

// ─── Athlete pages (lazy) ─────────────────────────────────────────────────────
const GoalsPage = lazy(() => import("./pages/GoalsPage"));
const TrainingPage = lazy(() => import("./pages/TrainingPage"));
const AthleteWellnessPage = lazy(() => import("./pages/AthleteWellnessPage"));
const AthletePaymentsPage = lazy(() => import("./pages/AthletePaymentsPage"));

// ─── Store pages (lazy) ───────────────────────────────────────────────────────
const StoreProductsPage = lazy(() => import("./pages/StoreProductsPage"));
const StoreOrdersPage = lazy(() => import("./pages/StoreOrdersPage"));
const StoreInventoryPage = lazy(() => import("./pages/StoreInventoryPage"));

// ─── Wellness pages (lazy) ────────────────────────────────────────────────────
const WellnessSchedulePage = lazy(() => import("./pages/WellnessSchedulePage"));
const WellnessPatientsPage = lazy(() => import("./pages/WellnessPatientsPage"));
const MedicalHistoryPage = lazy(() => import("./pages/MedicalHistoryPage"));
const NutritionPage = lazy(() => import("./pages/NutritionPage"));
const SchoolSetupPage = lazy(() => import("./pages/SchoolSetupPage"));
const SchoolOnboardingPage = lazy(() => import("./pages/SchoolOnboardingPage"));
const AthleteOnboarding = lazy(() => import("./pages/onboarding/AthleteOnboarding"));
const ParentOnboarding = lazy(() => import("./pages/onboarding/ParentOnboarding"));
const CoachOnboarding = lazy(() => import("./pages/onboarding/CoachOnboarding"));
const WellnessOnboarding = lazy(() => import("./pages/onboarding/WellnessOnboarding"));

// ─── Admin pages (lazy) ───────────────────────────────────────────────────────
const AdminPanelPage = lazy(() => import("./pages/AdminPanelPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/AdminAnalyticsPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminClubsPage = lazy(() => import("./pages/AdminClubsPage"));
const AdminSchoolsGlobalPage = lazy(() => import("./pages/AdminSchoolsGlobalPage"));
const AdminSubscriptionsPage = lazy(() => import("./pages/AdminSubscriptionsPage"));
const AdminActivityLogsPage = lazy(() => import("./pages/AdminActivityLogsPage"));
const PayrollConfigPage = lazy(() => import("./pages/admin/PayrollConfigPage"));
const AdminAccessLogsPage = lazy(() => import("./pages/AdminAccessLogsPage"));
const AthleteCardPublicPage = lazy(() => import("./pages/AthleteCardPublicPage"));
const SchoolCardsAdminPage = lazy(() => import("./pages/SchoolCardsAdminPage"));
const SchoolCertificatesAdminPage = lazy(() => import("./pages/SchoolCertificatesAdminPage"));
const CertificateTemplatesPage = lazy(() => import("./pages/CertificateTemplatesPage"));
const MyCertificatesPage = lazy(() => import("./pages/MyCertificatesPage"));
const MyAthleteCardsPage = lazy(() => import("./pages/MyAthleteCardsPage"));
const CertificateVerifyPublicPage = lazy(() => import("./pages/CertificateVerifyPublicPage"));
const JoinSchoolPublicPage = lazy(() => import("./pages/JoinSchoolPublicPage"));
const SchoolJoinQRsPage = lazy(() => import("./pages/SchoolJoinQRsPage"));

// ─── Vendor/Marketplace pages (lazy) ─────────────────────────────────────────
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));
const MarketplaceDetailPage = lazy(() => import("./pages/MarketplaceDetailPage"));
const ExplorarGlobalPage = lazy(() => import("./pages/ExplorarGlobalPage"));
const TiendaPublicaPage = lazy(() => import("./pages/TiendaPublicaPage"));
const MiTiendaPage = lazy(() => import("./pages/MiTiendaPage"));
const VendorGuard = lazy(() => import("@/components/vendor/VendorGuard").then(module => ({ default: module.VendorGuard })));
const VendorOnboardingPage = lazy(() => import("./pages/vendor/VendorOnboardingPage"));
const VendorDashboardPage = lazy(() => import("./pages/vendor/VendorDashboardPage"));
const VendorPromotionsPage = lazy(() => import("./pages/vendor/VendorPromotionsPage"));
const VendorServicesPage = lazy(() => import("./pages/vendor/VendorServicesPage"));
const VendorAppointmentsPage = lazy(() => import("./pages/vendor/VendorAppointmentsPage"));
const VendorProductsPage = lazy(() => import("./pages/vendor/VendorProductsPage"));
const ProductWizardPage = lazy(() => import("./components/vendor/product-wizard/ProductWizard").then(m => ({ default: m.ProductWizard })));
const AdminMarketplaceModerationPage = lazy(() => import("./pages/admin/AdminMarketplaceModerationPage"));
const AdminPayoutsPage = lazy(() => import("./pages/admin/AdminPayoutsPage"));
const VendorInboxPage = lazy(() => import("./pages/vendor/VendorInboxPage"));
const VendorPayoutsPage = lazy(() => import("./pages/vendor/VendorPayoutsPage"));
const VendorSubscribersPage = lazy(() => import("./pages/vendor/VendorSubscribersPage"));
const VendorShippingSettingsPage = lazy(() => import("./pages/vendor/VendorShippingSettingsPage"));

const OrganizerGuard = lazy(() => import("@/components/organizer/OrganizerGuard").then(module => ({ default: module.OrganizerGuard })));
const OrganizerOnboardingPage = lazy(() => import("./pages/organizer/OrganizerOnboardingPage"));
const OrganizerDashboardPage = lazy(() => import("./pages/organizer/OrganizerDashboardPage"));
const OrganizerProfilePage = lazy(() => import("./pages/organizer/OrganizerProfilePage"));
const CreateEventPage = lazy(() => import("./pages/organizer/CreateEventPage"));
const SchoolTournamentsPage = lazy(() => import("./pages/school/SchoolTournamentsPage"));
const SchoolEquipmentPage = lazy(() => import("./pages/school/SchoolEquipmentPage"));
const CoachEquipmentPage = lazy(() => import("./pages/coach/CoachEquipmentPage"));
const SchoolTournamentDetailPage = lazy(() => import("./pages/school/SchoolTournamentDetailPage"));
const CreateTournamentPage = lazy(() => import("./pages/school/CreateTournamentPage"));
const EventManagementPage = lazy(() => import("./pages/organizer/EventManagementPage"));
const OrganizerEventsPage = lazy(() => import("./pages/organizer/OrganizerEventsPage"));
const OrganizerFinancesPage = lazy(() => import("./pages/organizer/OrganizerFinancesPage"));
const OrganizerCalendarPage = lazy(() => import("./pages/organizer/OrganizerCalendarPage"));
const OrganizerReportsPage = lazy(() => import("./pages/organizer/OrganizerReportsPage"));
const OrganizerSettingsPage = lazy(() => import("./pages/organizer/OrganizerSettingsPage"));
const EventEnrollmentPage = lazy(() => import("./pages/school/EventEnrollmentPage"));
const SchoolDelegationsPage = lazy(() => import("./pages/school/SchoolDelegationsPage"));
const SchoolDelegationDetailPage = lazy(() => import("./pages/school/SchoolDelegationDetailPage"));
const AccessControlPage = lazy(() => import('./pages/school/AccessControlPage'));

// ─── Trainer pages (lazy) ────────────────────────────────────────────────────
const TrainerOnboarding = lazy(() => import("./pages/trainer/TrainerOnboarding"));
const TrainerDashboard = lazy(() => import("./pages/trainer/TrainerDashboard"));
const TrainerClients = lazy(() => import('./pages/trainer/TrainerClients'));
const TrainerRoutines = lazy(() => import('./pages/trainer/TrainerRoutines'));
const TrainerRoutineDetail = lazy(() => import('./pages/trainer/TrainerRoutineDetail'));
const TrainerAvailability = lazy(() => import("./pages/trainer/TrainerAvailability"));
const TrainerPlans = lazy(() => import("./pages/trainer/TrainerPlans"));
const TrainerPayments = lazy(() => import("./pages/trainer/TrainerPayments"));
const TrainerProfileEditor = lazy(() => import("./pages/trainer/TrainerProfileEditor"));
const TrainerPublicProfile = lazy(() => import("./pages/trainer/TrainerPublicProfile"));
const TrainerClientProfile = lazy(() => import("./pages/trainer/TrainerClientProfile"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
  },
});

const EnvironmentBanner = () => {
  const env = import.meta.env.VITE_APP_ENV;
  if (!env || env === 'production') return null;

  const colors: Record<string, string> = {
    staging: 'bg-amber-500',
    development: 'bg-blue-500',
    demo: 'bg-purple-600',
  };

  const bgColor = colors[env] || 'bg-slate-700';

  return (
    <div className={`${bgColor} text-white text-center text-[10px] py-1 font-bold uppercase tracking-widest sticky top-0 z-[9999] shadow-md border-b border-white/10`}>
      Ambiente de {env === 'demo' ? 'Demostración' : env}
    </div>
  );
};

// ─── Layout autenticado ───────────────────────────────
// Removemos el SchoolProvider de aquí porque ThemeProvider y ProtectedRoute 
// necesitan el contexto de la escuela (para colores y roles) ANTES de llegar aquí.
const AuthenticatedLayout = () => (
  <AuthLayout />
);

// Guard que require que el usuario sea entrenador personal.
// Definido en @/components/trainer/RequirePersonalTrainer (importado arriba).

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <IdleConfigProvider>
        <AuthProvider>
          <IdleTimer />
          <SchoolProvider>

          <ThemeProvider>
            <ErrorBoundary>
              <CartProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <EnvironmentBanner />
                <UpdateBanner />
                <InstallBanner />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Index />} />
                    <Route path="/explore" element={<Navigate to="/explorar?category=schools" replace />} />
                    <Route path="/schools/:id" element={<SchoolDetailPage />} />
                    <Route path="/escuela/:id" element={<SchoolProfilePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/onboarding/role" element={
                      <ProtectedRoute skipOnboardingCheck><OnboardingRolePage /></ProtectedRoute>
                    } />
                    <Route path="/join-team/:teamId" element={<JoinTeamPage />} />
                    <Route path="/join-plan/:planId" element={<JoinPlanPage />} />
                    <Route path="/c/:qrToken" element={<AthleteCardPublicPage />} />
                    <Route path="/cert/:folio" element={<CertificateVerifyPublicPage />} />
                    <Route path="/join/:slug" element={<JoinSchoolPublicPage />} />
                    <Route path="/terminos-y-condiciones" element={<TermsPage />} />
                    <Route path="/terms" element={<Navigate to="/terminos-y-condiciones" replace />} />
                    <Route path="/politica-de-privacidad" element={<PrivacyPage />} />
                    <Route path="/privacy" element={<Navigate to="/politica-de-privacidad" replace />} />
                    <Route path="/checkout" element={
                      <ProtectedRoute><CheckoutPage /></ProtectedRoute>
                    } />
                    <Route path="/onboarding/school" element={
                      <ProtectedRoute><SchoolOnboardingPage /></ProtectedRoute>
                    } />
                    <Route path="/onboarding/athlete" element={
                      <ProtectedRoute><AthleteOnboarding /></ProtectedRoute>
                    } />
                    <Route path="/onboarding/parent" element={
                      <ProtectedRoute><ParentOnboarding /></ProtectedRoute>
                    } />
                    <Route path="/onboarding/coach" element={
                      <ProtectedRoute><CoachOnboarding /></ProtectedRoute>
                    } />
                    <Route path="/onboarding/wellness" element={
                      <ProtectedRoute><WellnessOnboarding /></ProtectedRoute>
                    } />
                    <Route path="/setup/school" element={
                      <ProtectedRoute><SchoolSetupPage /></ProtectedRoute>
                    } />
                    <Route path="/parent-checkout" element={
                      <ProtectedRoute><ParentCheckoutPage /></ProtectedRoute>
                    } />
                    <Route path="/payment-result" element={<PaymentResultPage />} />
                    <Route path="/pagos/confirmacion" element={<PaymentConfirmationPage />} />
                    <Route path="/unauthorized" element={<UnauthorizedPage />} />

                    {/* Public Events routes */}
                    <Route path="/events" element={<Navigate to="/explorar?category=events" replace />} />
                    <Route path="/event/:slug" element={<EventPublicPage />} />
                    <Route path="/event/:eventId/register" element={<EventIndividualRegisterPage />} />
                    <Route path="/my-event-registrations" element={<MyEventRegistrationsPage />} />
                    <Route path="/s/:slug" element={<PublicSchoolPage />} />
                    <Route path="/polls/v/:pollId" element={<PublicPollPage />} />

                    {/* Public Marketplace routes */}
                    <Route path="/explorar" element={<ExplorarGlobalPage />} />
                    <Route path="/marketplace" element={<MarketplacePage />} />
                    <Route path="/marketplace/:type/:id" element={<MarketplaceDetailPage />} />
                    <Route path="/tienda/:slug" element={<TiendaPublicaPage />} />

                    {/* Public trainer profile — no auth required */}
                    <Route path="/entrenador/:userId" element={<TrainerPublicProfile />} />

                    {/* Modo Recepción (F-R) — kiosko full-screen para el admin/recepción.
                        No usa AuthLayout (sin chrome). SchoolProvider ya vive en la raíz. */}
                    <Route path="/recepcion" element={
                      <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin', 'reporter']}>
                        <RecepcionPage />
                      </ProtectedRoute>
                    } />

                    {/* ── Rutas autenticadas — SchoolProvider vive aquí ── */}
                    <Route element={
                      <ProtectedRoute>
                        <AuthenticatedLayout />  {/* ← SchoolProvider wrappea AuthLayout */}
                      </ProtectedRoute>
                    }>
                      <Route path="dashboard" element={<DashboardPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="calendar" element={<CalendarPage />} />
                      <Route path="notifications" element={<NotificationsPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="messages" element={<MessagesPage />} />

                      {/* Athlete routes */}
                      <Route path="teams" element={<TeamsPage />} />
                      <Route path="offerings" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <OfferingsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="stats" element={<StatsPage />} />
                      <Route path="goals" element={<GoalsPage />} />
                      <Route path="training" element={<TrainingPage />} />
                      <Route path="enrollments" element={<MyEnrollmentsPage />} />
                      <Route path="shop" element={<ShopPage />} />
                      <Route path="wellness" element={<AthleteWellnessPage />} />
                      <Route path="athlete-payments" element={
                        <ProtectedRoute allowedRoles={['athlete']}>
                          <AthletePaymentsPage />
                        </ProtectedRoute>
                      } />

                      {/* Parent routes */}
                      <Route path="children" element={
                        <ProtectedRoute allowedRoles={['parent']}>
                          <MyChildrenPage />
                        </ProtectedRoute>
                      } />
                      <Route path="my-payments" element={
                        <ProtectedRoute allowedRoles={['parent', 'athlete']}>
                          <MyPaymentsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="mi-tienda" element={
                        <ProtectedRoute allowedRoles={['parent', 'athlete']}>
                          <MiTiendaPage />
                        </ProtectedRoute>
                      } />

                      <Route path="children/:id/progress" element={
                        <ProtectedRoute allowedRoles={['parent']}>
                          <AcademicProgressPage />
                        </ProtectedRoute>
                      } />
                      <Route path="children/:id/attendance" element={
                        <ProtectedRoute allowedRoles={['parent']}>
                          <AttendancePage />
                        </ProtectedRoute>
                      } />
                      <Route path="academic-progress" element={
                        <ProtectedRoute allowedRoles={['parent']}>
                          <AcademicProgressPage />
                        </ProtectedRoute>
                      } />
                      <Route path="parent-attendance" element={
                        <ProtectedRoute allowedRoles={['parent']}>
                          <AttendancePage />
                        </ProtectedRoute>
                      } />

                      {/* Coach routes */}
                      <Route path="coach-attendance" element={<CoachAttendancePage />} />
                      <Route path="coach-plans" element={<CoachPlansPage />} />
                      <Route path="results" element={<ResultsPage />} />
                      <Route path="training-plans" element={<TrainingPlansPage />} />
                      <Route path="coach-reports" element={<CoachReportsPage />} />
                      <Route path="evaluations" element={<CoachEvaluationsPage />} />
                      <Route path="announcements" element={<AnnouncementsPage />} />

                      {/* Polls routes */}
                      <Route path="dashboard/polls" element={<PollsPage />} />
                      <Route path="dashboard/polls/:pollId/results" element={<PollResultsPage />} />

                      {/* School routes (role-guarded) */}
                      <Route path="school/enroll/:eventId" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin']}>
                          <EventEnrollmentPage />
                        </ProtectedRoute>
                      } />
                      <Route path="school/delegations" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin']}>
                          <SchoolDelegationsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="school/tournaments" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin']}>
                          <SchoolTournamentsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="school/tournaments/new" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin']}>
                          <CreateTournamentPage />
                        </ProtectedRoute>
                      } />
                      <Route path="school/tournaments/:id" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin']}>
                          <SchoolTournamentDetailPage />
                        </ProtectedRoute>
                      } />
                      <Route path="school/equipment" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin']}>
                          <SchoolEquipmentPage />
                        </ProtectedRoute>
                      } />
                      <Route path="school/dotacion" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin']}>
                          <SchoolEquipmentPage />
                        </ProtectedRoute>
                      } />
                      <Route path="coach/dotacion" element={
                        <ProtectedRoute allowedRoles={['coach', 'school', 'admin', 'school_admin']}>
                          <CoachEquipmentPage />
                        </ProtectedRoute>
                      } />
                      <Route path="school/delegations/:id" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin']}>
                          <SchoolDelegationDetailPage />
                        </ProtectedRoute>
                      } />
                      <Route path="students" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin', 'coach']}>
                          <SchoolStudentsManagementPage />
                        </ProtectedRoute>
                      } />
                      <Route path="mi-plan" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin', 'athlete', 'parent', 'coach', 'wellness_professional', 'store_owner', 'organizer', 'reporter', 'personal_trainer']}>
                          <MiPlanPage />
                        </ProtectedRoute>
                      } />
                      <Route path="invitations" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin', 'coach']}>
                          <InvitationsManagementPage />
                        </ProtectedRoute>
                      } />
                      <Route path="staff" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <StaffPage />
                        </ProtectedRoute>
                      } />
                      <Route path="programs-management" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <ProgramsManagementPage />
                        </ProtectedRoute>
                      } />
                      <Route path="attendance-supervision" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <AttendanceSupervisionPage />
                        </ProtectedRoute>
                      } />
                      <Route path="results-overview" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <ResultsOverviewPage />
                        </ProtectedRoute>
                      } />
                      <Route path="finances" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <FinancesPage />
                        </ProtectedRoute>
                      } />
                      <Route path="accounting" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <AccountingPage />
                        </ProtectedRoute>
                      } />
                      <Route path="accounting/suppliers" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <AccountingSuppliersPage />
                        </ProtectedRoute>
                      } />
                      <Route path="accounting/payroll" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <PayrollPage />
                        </ProtectedRoute>
                      } />
                      <Route path="accounting/reports" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <AccountingReportsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="accounting/budget" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <AccountingBudgetPage />
                        </ProtectedRoute>
                      } />
                      <Route path="payments-automation" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <PaymentsAutomationPage />
                        </ProtectedRoute>
                      } />
                      <Route path="cards" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <SchoolCardsAdminPage />
                        </ProtectedRoute>
                      } />
                      <Route path="certificates" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <SchoolCertificatesAdminPage />
                        </ProtectedRoute>
                      } />
                      <Route path="cards/templates/certificates" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <CertificateTemplatesPage />
                        </ProtectedRoute>
                      } />
                      <Route path="my-certificates" element={
                        <ProtectedRoute>
                          <MyCertificatesPage />
                        </ProtectedRoute>
                      } />
                      <Route path="my-cards" element={
                        <ProtectedRoute>
                          <MyAthleteCardsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="qr-signup" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <SchoolJoinQRsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="payment-reminders" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <PaymentRemindersPage />
                        </ProtectedRoute>
                      } />
                      <Route path="message-templates" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <MessageTemplatesPage />
                        </ProtectedRoute>
                      } />
                      <Route path="reporter-dashboard" element={
                        <ProtectedRoute allowedRoles={['reporter']}>
                          <ReporterDashboardPage />
                        </ProtectedRoute>
                      } />
                      <Route path="school-reports" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <ReportsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="facilities" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <SchoolFacilitiesPage />
                        </ProtectedRoute>
                      } />
                      <Route path="branches" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <SchoolBranchesManagementPage />
                        </ProtectedRoute>
                      } />
                      <Route path="school-config" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <SchoolSettingsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="school/public-profile" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <SchoolPublicProfilePage />
                        </ProtectedRoute>
                      } />
                      <Route path="school/access-control" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <AccessControlPage />
                        </ProtectedRoute>
                      } />
                      <Route path="vendor/public-profile" element={
                        <ProtectedRoute allowedRoles={['wellness_professional', 'store_owner']}>
                          <VendorPublicProfilePage />
                        </ProtectedRoute>
                      } />
                      <Route path="wellness/appointments" element={
                        <ProtectedRoute>
                          <MyAppointmentsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="pickup" element={
                        <ProtectedRoute allowedRoles={['school', 'admin']}>
                          <PickupMonitorPage />
                        </ProtectedRoute>
                      } />

                      {/* Wellness routes */}
                      <Route path="athletes" element={
                        <ProtectedRoute allowedRoles={['wellness_professional', 'admin', 'super_admin', 'school', 'school_admin']}>
                          <WellnessPatientsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="schedule" element={
                        <ProtectedRoute allowedRoles={['wellness_professional', 'admin', 'super_admin', 'school', 'school_admin']}>
                          <WellnessSchedulePage />
                        </ProtectedRoute>
                      } />
                      <Route path="evaluations/new" element={
                        <ProtectedRoute allowedRoles={['wellness_professional', 'admin', 'super_admin', 'school', 'school_admin']}>
                          <WellnessSchedulePage />
                        </ProtectedRoute>
                      } />
                      <Route path="medical-history" element={
                        <ProtectedRoute allowedRoles={['wellness_professional', 'admin', 'super_admin', 'school', 'school_admin']}>
                          <MedicalHistoryPage />
                        </ProtectedRoute>
                      } />
                      <Route path="follow-ups" element={
                        <ProtectedRoute allowedRoles={['wellness_professional', 'admin', 'super_admin', 'school', 'school_admin']}>
                          <WellnessPatientsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="nutrition" element={
                        <ProtectedRoute allowedRoles={['wellness_professional', 'admin', 'super_admin', 'school', 'school_admin']}>
                          <NutritionPage />
                        </ProtectedRoute>
                      } />
                      <Route path="wellness-reports" element={
                        <ProtectedRoute allowedRoles={['wellness_professional', 'admin', 'super_admin', 'school', 'school_admin']}>
                          <ReportsPage />
                        </ProtectedRoute>
                      } />

                      {/* Store routes */}
                      <Route path="products" element={
                        <ProtectedRoute allowedRoles={['store_owner', 'admin', 'school', 'school_admin', 'super_admin']}>
                          <StoreProductsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="orders" element={
                        <ProtectedRoute allowedRoles={['store_owner', 'admin', 'school', 'school_admin', 'super_admin']}>
                          <StoreOrdersPage />
                        </ProtectedRoute>
                      } />
                      <Route path="inventory" element={
                        <ProtectedRoute allowedRoles={['store_owner', 'admin', 'school', 'school_admin', 'super_admin']}>
                          <StoreInventoryPage />
                        </ProtectedRoute>
                      } />
                      <Route path="suppliers" element={
                        <ProtectedRoute allowedRoles={['store_owner', 'admin']}>
                          <StoreInventoryPage />
                        </ProtectedRoute>
                      } />
                      <Route path="categories" element={
                        <ProtectedRoute allowedRoles={['store_owner', 'admin']}>
                          <StoreProductsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="customers" element={
                        <ProtectedRoute allowedRoles={['store_owner', 'admin']}>
                          <StoreOrdersPage />
                        </ProtectedRoute>
                      } />
                      <Route path="promotions" element={
                        <ProtectedRoute allowedRoles={['store_owner', 'admin']}>
                          <StoreProductsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="store-reports" element={
                        <ProtectedRoute allowedRoles={['store_owner', 'admin']}>
                          <ReportsPage />
                        </ProtectedRoute>
                      } />

                      {/* Vendor routes */}
                      <Route element={<VendorGuard />}>
                        <Route path="vendor/onboarding" element={<VendorOnboardingPage />} />
                        <Route path="vendor/dashboard" element={<VendorDashboardPage />} />
                        <Route path="vendor/services" element={<VendorServicesPage />} />
                        <Route path="vendor/appointments" element={<VendorAppointmentsPage />} />
                        <Route path="vendor/products" element={<VendorProductsPage />} />
                        <Route path="vendor/products/new" element={<ProductWizardPage />} />
                        <Route path="vendor/products/:id/edit" element={<ProductWizardPage />} />
                        <Route path="vendor/inbox" element={<VendorInboxPage />} />
                        <Route path="vendor/payouts" element={<VendorPayoutsPage />} />
                        <Route path="vendor/subscribers" element={<VendorSubscribersPage />} />
                        <Route path="vendor/shipping" element={<VendorShippingSettingsPage />} />
                        <Route path="vendor/promotions" element={<VendorPromotionsPage />} />
                      </Route>

                      {/* Organizer routes */}
                      <Route element={<OrganizerGuard />}>
                        <Route path="organizer/onboarding" element={<OrganizerOnboardingPage />} />
                        <Route path="organizer/dashboard" element={<OrganizerDashboardPage />} />
                        <Route path="organizer/profile" element={<OrganizerProfilePage />} />
                        <Route path="organizer/create-event" element={<CreateEventPage />} />
                        <Route path="organizer/event/:id" element={<EventManagementPage />} />
                        <Route path="organizer/events" element={<OrganizerEventsPage />} />
                        <Route path="organizer/finances" element={<OrganizerFinancesPage />} />
                        <Route path="organizer/calendar" element={<OrganizerCalendarPage />} />
                        <Route path="organizer/reports" element={<OrganizerReportsPage />} />
                        <Route path="organizer/settings" element={<OrganizerSettingsPage />} />
                      </Route>

                      {/* Trainer onboarding — accesible si estás autenticado aunque aún no seas trainer "completo" */}
                      <Route path="trainer/onboarding" element={<TrainerOnboarding />} />

                      {/* Trainer workspace — guard RequirePersonalTrainer */}
                      <Route element={<RequirePersonalTrainer />}>
                        <Route path="trainer/dashboard" element={<TrainerDashboard />} />
                        <Route path="trainer/clients" element={<TrainerClients />} />
                        <Route path="trainer/clients/:clientId" element={<TrainerClientProfile />} />
                        <Route path="trainer/routines" element={<TrainerRoutines />} />
                        <Route path="trainer/routines/:routineId" element={<TrainerRoutineDetail />} />
                        <Route path="trainer/availability" element={<TrainerAvailability />} />
                        <Route path="trainer/plans" element={<TrainerPlans />} />
                        <Route path="trainer/payments" element={<TrainerPayments />} />
                        <Route path="trainer/profile" element={<TrainerProfileEditor />} />
                      </Route>


                      {/* Admin routes */}
                      <Route path="admin" element={
                        <ProtectedRoute allowedRoles={['admin', 'super_admin']} strictRoleCheck>
                          <AdminPanelPage />
                        </ProtectedRoute>
                      } />
                      <Route path="admin/users" element={
                        <ProtectedRoute allowedRoles={['admin', 'school', 'super_admin']}>
                          <AdminUsersPage />
                        </ProtectedRoute>
                      } />
                      <Route path="admin/clubs" element={
                        <ProtectedRoute allowedRoles={['admin', 'school', 'super_admin']}>
                          <AdminClubsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="admin/schools" element={
                        <ProtectedRoute allowedRoles={['admin', 'super_admin']} strictRoleCheck>
                          <AdminSchoolsGlobalPage />
                        </ProtectedRoute>
                      } />
                      <Route path="admin/upgrade-requests" element={
                        <ProtectedRoute allowedRoles={['admin', 'super_admin']} strictRoleCheck>
                          <AdminUpgradeRequestsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="admin/subscriptions" element={
                        <ProtectedRoute allowedRoles={['admin', 'super_admin']} strictRoleCheck>
                          <AdminSubscriptionsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="admin/reports" element={
                        <ProtectedRoute allowedRoles={['admin', 'school', 'super_admin']}>
                          <ReportsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="admin/analytics" element={
                        <ProtectedRoute allowedRoles={['admin', 'school', 'super_admin']}>
                          <AdminAnalyticsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="admin/config" element={
                        <ProtectedRoute allowedRoles={['admin', 'school', 'super_admin']}>
                          <SettingsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="admin/payroll-config" element={
                        <ProtectedRoute allowedRoles={['super_admin']}>
                          <PayrollConfigPage />
                        </ProtectedRoute>
                      } />
                      <Route path="admin/logs" element={
                        <ProtectedRoute allowedRoles={['admin', 'school', 'super_admin']}>
                          <NotificationsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="admin/activity-logs" element={
                        <ProtectedRoute allowedRoles={['admin', 'super_admin']} strictRoleCheck>
                          <AdminActivityLogsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="admin/access-logs" element={
                        <ProtectedRoute allowedRoles={['admin', 'super_admin']} strictRoleCheck>
                          <AdminAccessLogsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="admin/marketplace/moderation" element={
                        <ProtectedRoute allowedRoles={['admin', 'super_admin']} strictRoleCheck>
                          <AdminMarketplaceModerationPage />
                        </ProtectedRoute>
                      } />
                      <Route path="admin/payouts" element={
                        <ProtectedRoute allowedRoles={['admin', 'super_admin']} strictRoleCheck>
                          <AdminPayoutsPage />
                        </ProtectedRoute>
                      } />
                    </Route>

                    {/* Catch-all */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>

                <MobileBottomNav />
                <CartDrawer />
              </BrowserRouter>
            </CartProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </SchoolProvider>
        </AuthProvider>
      </IdleConfigProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;