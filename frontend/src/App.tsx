import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CartProvider } from "@/contexts/CartContext";
import { SchoolProvider } from "@/hooks/useSchoolContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AuthLayout from "@/layouts/AuthLayout";
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Suspense, lazy } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { InstallBanner } from "./pwa/InstallBanner";
import { UpdateBanner } from "./pwa/UpdateBanner";

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
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const SchoolDetailPage = lazy(() => import("./pages/SchoolDetailPage"));
const UnauthorizedPage = lazy(() => import("./pages/UnauthorizedPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const ParentCheckoutPage = lazy(() => import("./pages/ParentCheckoutPage"));
const PaymentResultPage = lazy(() => import("./pages/PaymentResultPage"));
const PublicSchoolPage = lazy(() => import("./pages/PublicSchoolPage"));
const SchoolProfilePage = lazy(() => import("./pages/SchoolProfilePage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const PublicPollPage = lazy(() => import("./pages/polls/PublicPollPage"));

// ─── Events (public, lazy) ────────────────────────────────────────────────────
const EventsMapPage = lazy(() => import("./pages/events/EventsMapPage"));
const EventPublicPage = lazy(() => import("./pages/events/EventPublicPage"));

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
const StaffPage = lazy(() => import("./pages/StaffPage"));
const ProgramsManagementPage = lazy(() => import("./pages/ProgramsManagementPage"));
const AttendanceSupervisionPage = lazy(() => import("./pages/AttendanceSupervisionPage"));
const ResultsOverviewPage = lazy(() => import("./pages/ResultsOverviewPage"));
const FinancesPage = lazy(() => import("./pages/FinancesPage"));
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
const PollsPage = lazy(() => import("./pages/polls/PollsPage"));
const PollResultsPage = lazy(() => import("./pages/polls/PollResultsPage"));

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

// ─── Admin pages (lazy) ───────────────────────────────────────────────────────
const AdminAnalyticsPage = lazy(() => import("./pages/AdminAnalyticsPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminClubsPage = lazy(() => import("./pages/AdminClubsPage"));

// ─── Organizer pages (lazy) ───────────────────────────────────────────────────
const OrganizerDashboardPage = lazy(() => import("./pages/organizer/OrganizerDashboardPage"));
const CreateEventPage = lazy(() => import("./pages/organizer/CreateEventPage"));
const EventManagementPage = lazy(() => import("./pages/organizer/EventManagementPage"));

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

// ─── Layout autenticado ────────────────────────────────────
// Removemos el SchoolProvider de aquí porque ThemeProvider y ProtectedRoute 
// necesitan el contexto de la escuela (para colores y roles) ANTES de llegar aquí.
const AuthenticatedLayout = () => (
  <AuthLayout />
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
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
                    <Route path="/explore" element={<ExplorePage />} />
                    <Route path="/schools/:id" element={<SchoolDetailPage />} />
                    <Route path="/escuela/:id" element={<SchoolProfilePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/terminos-y-condiciones" element={<TermsPage />} />
                    <Route path="/politica-de-privacidad" element={<PrivacyPage />} />
                    <Route path="/checkout" element={
                      <ProtectedRoute><CheckoutPage /></ProtectedRoute>
                    } />
                    <Route path="/setup/school" element={
                      <ProtectedRoute><SchoolSetupPage /></ProtectedRoute>
                    } />
                    <Route path="/parent-checkout" element={
                      <ProtectedRoute><ParentCheckoutPage /></ProtectedRoute>
                    } />
                    <Route path="/payment-result" element={<PaymentResultPage />} />
                    <Route path="/unauthorized" element={<UnauthorizedPage />} />

                    {/* Public Events routes */}
                    <Route path="/events" element={<EventsMapPage />} />
                    <Route path="/event/:slug" element={<EventPublicPage />} />
                    <Route path="/s/:slug" element={<PublicSchoolPage />} />
                    <Route path="/polls/v/:pollId" element={<PublicPollPage />} />

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
                      <Route path="athlete-payments" element={<AthletePaymentsPage />} />

                      {/* Parent routes */}
                      <Route path="children" element={<MyChildrenPage />} />
                      <Route path="my-payments" element={<MyPaymentsPage />} />
                      <Route path="children/:id/progress" element={<ChildProgressPage />} />
                      <Route path="children/:id/attendance" element={<ChildAttendancePage />} />
                      <Route path="academic-progress" element={<AcademicProgressPage />} />
                      <Route path="parent-attendance" element={<AttendancePage />} />

                      {/* Coach routes */}
                      <Route path="coach-attendance" element={<CoachAttendancePage />} />
                      <Route path="training-plans" element={<TrainingPlansPage />} />
                      <Route path="coach-reports" element={<CoachReportsPage />} />
                      <Route path="evaluations" element={<CoachEvaluationsPage />} />
                      <Route path="announcements" element={<AnnouncementsPage />} />

                      {/* Attendance Polls */}
                      <Route path="dashboard/polls" element={<PollsPage />} />
                      <Route path="dashboard/polls/:pollId/results" element={<PollResultsPage />} />

                      {/* School routes (role-guarded) */}
                      <Route path="students" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin', 'coach']}>
                          <SchoolStudentsManagementPage />
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
                      <Route path="payments-automation" element={
                        <ProtectedRoute allowedRoles={['school', 'admin', 'school_admin', 'super_admin']}>
                          <PaymentsAutomationPage />
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
                        <ProtectedRoute allowedRoles={['store_owner', 'admin']}>
                          <StoreProductsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="orders" element={
                        <ProtectedRoute allowedRoles={['store_owner', 'admin']}>
                          <StoreOrdersPage />
                        </ProtectedRoute>
                      } />
                      <Route path="inventory" element={
                        <ProtectedRoute allowedRoles={['store_owner', 'admin']}>
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

                      {/* Organizer routes */}
                      <Route path="organizer/home" element={<OrganizerDashboardPage />} />
                      <Route path="organizer/create-event" element={<CreateEventPage />} />
                      <Route path="organizer/event/:id" element={<EventManagementPage />} />

                      {/* Admin routes */}
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
                      <Route path="admin/logs" element={
                        <ProtectedRoute allowedRoles={['admin', 'school', 'super_admin']}>
                          <NotificationsPage />
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
  </TooltipProvider>
</QueryClientProvider>
);

export default App;