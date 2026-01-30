import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CartProvider } from "@/contexts/CartContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AuthLayout from "@/layouts/AuthLayout";
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav";
import { CartDrawer } from "@/components/cart/CartDrawer";

// Public pages
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ExplorePage from "./pages/ExplorePage";
import SchoolDetailPage from "./pages/SchoolDetailPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import NotFound from "./pages/NotFound";
import CheckoutPage from "./pages/CheckoutPage";
import ParentCheckoutPage from "./pages/ParentCheckoutPage";
import DemoWelcomePage from "./pages/DemoWelcomePage";

// Events (public)
import EventsMapPage from "./pages/events/EventsMapPage";
import EventPublicPage from "./pages/events/EventPublicPage";

// Dashboard pages
import DashboardPage from "./pages/DashboardPage";
import CalendarPage from "./pages/CalendarPage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import TeamsPage from "./pages/TeamsPage";
import StatsPage from "./pages/StatsPage";
import MessagesPage from "./pages/MessagesPage";
import ProfilePage from "./pages/ProfilePage";
import MyEnrollmentsPage from "./pages/MyEnrollmentsPage";
import ShopPage from "./pages/ShopPage";

// Parent pages
import MyChildrenPage from "./pages/MyChildrenPage";
import ChildProgressPage from "./pages/ChildProgressPage";
import ChildAttendancePage from "./pages/ChildAttendancePage";
import AcademicProgressPage from "./pages/AcademicProgressPage";
import AttendancePage from "./pages/AttendancePage";
import PaymentsPage from "./pages/PaymentsPage";
import MyPaymentsPage from "./pages/MyPaymentsPage";

// Coach pages
import CoachAttendancePage from "./pages/CoachAttendancePage";
import ResultsPage from "./pages/ResultsPage";
import TrainingPlansPage from "./pages/TrainingPlansPage";
import CoachReportsPage from "./pages/CoachReportsPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";

// School pages
import SchoolStudentsManagementPage from "./pages/SchoolStudentsManagementPage";
import SchoolCoachesManagementPage from "./pages/SchoolCoachesManagementPage";
import ProgramsManagementPage from "./pages/ProgramsManagementPage";
import AttendanceSupervisionPage from "./pages/AttendanceSupervisionPage";
import ResultsOverviewPage from "./pages/ResultsOverviewPage";
import FinancesPage from "./pages/FinancesPage";
import PaymentsAutomationPage from "./pages/PaymentsAutomationPage";
import ReportsPage from "./pages/ReportsPage";
import SchoolFacilitiesPage from "./pages/SchoolFacilitiesPage";

// Onboarding pages
import SchoolOnboardingPage from "./pages/SchoolOnboardingPage";
import CoachOnboardingPage from "./pages/CoachOnboardingPage";
import AthleteOnboardingPage from "./pages/AthleteOnboardingPage";
import WellnessOnboardingPage from "./pages/WellnessOnboardingPage";
import StoreOwnerOnboardingPage from "./pages/StoreOwnerOnboardingPage";

// Athlete pages
import GoalsPage from "./pages/GoalsPage";
import TrainingPage from "./pages/TrainingPage";
import AthleteWellnessPage from "./pages/AthleteWellnessPage";

// Store pages
import StoreProductsPage from "./pages/StoreProductsPage";
import StoreOrdersPage from "./pages/StoreOrdersPage";
import StoreInventoryPage from "./pages/StoreInventoryPage";

// Wellness pages
import WellnessSchedulePage from "./pages/WellnessSchedulePage";
import WellnessPatientsPage from "./pages/WellnessPatientsPage";
import MedicalHistoryPage from "./pages/MedicalHistoryPage";
import NutritionPage from "./pages/NutritionPage";

// Admin pages
import AdminAnalyticsPage from "./pages/AdminAnalyticsPage";

// Organizer pages
import OrganizerDashboardPage from "./pages/organizer/OrganizerDashboardPage";
import OrganizerOnboardingPage from "./pages/organizer/OrganizerOnboardingPage";
import CreateEventPage from "./pages/organizer/CreateEventPage";
import EventManagementPage from "./pages/organizer/EventManagementPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/demo-welcome" element={<DemoWelcomePage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/schools/:id" element={<SchoolDetailPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/parent-checkout" element={<ParentCheckoutPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                
                {/* Public Events routes */}
                <Route path="/events" element={<EventsMapPage />} />
                <Route path="/event/:slug" element={<EventPublicPage />} />
                
                {/* Protected routes with layout */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <AuthLayout />
                  </ProtectedRoute>
                }>
                  {/* Main routes */}
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="school-onboarding" element={<SchoolOnboardingPage />} />
                  <Route path="coach-onboarding" element={<CoachOnboardingPage />} />
                  <Route path="athlete-onboarding" element={<AthleteOnboardingPage />} />
                  <Route path="wellness-onboarding" element={<WellnessOnboardingPage />} />
                  <Route path="store-onboarding" element={<StoreOwnerOnboardingPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="messages" element={<MessagesPage />} />
                  
                  {/* Athlete routes */}
                  <Route path="teams" element={<TeamsPage />} />
                  <Route path="stats" element={<StatsPage />} />
                  <Route path="goals" element={<GoalsPage />} />
                  <Route path="training" element={<TrainingPage />} />
                  <Route path="enrollments" element={<MyEnrollmentsPage />} />
                  <Route path="shop" element={<ShopPage />} />
                  <Route path="wellness" element={<AthleteWellnessPage />} />
                  
                  {/* Parent routes */}
                  <Route path="children" element={<MyChildrenPage />} />
                  <Route path="my-payments" element={<MyPaymentsPage />} />
                  <Route path="children/:id/progress" element={<ChildProgressPage />} />
                  <Route path="children/:id/attendance" element={<ChildAttendancePage />} />
                  <Route path="academic-progress" element={<AcademicProgressPage />} />
                  <Route path="parent-attendance" element={<AttendancePage />} />
                  <Route path="payments" element={<PaymentsPage />} />
                  
                  {/* Coach routes */}
                  <Route path="coach-attendance" element={<CoachAttendancePage />} />
                  <Route path="results" element={<ResultsPage />} />
                  <Route path="training-plans" element={<TrainingPlansPage />} />
                  <Route path="coach-reports" element={<CoachReportsPage />} />
                  <Route path="announcements" element={<AnnouncementsPage />} />
                  
                  {/* School routes */}
                  <Route path="students" element={<SchoolStudentsManagementPage />} />
                  <Route path="staff" element={<SchoolCoachesManagementPage />} />
                  <Route path="programs-management" element={<ProgramsManagementPage />} />
                  <Route path="attendance-supervision" element={<AttendanceSupervisionPage />} />
                  <Route path="results-overview" element={<ResultsOverviewPage />} />
                  <Route path="finances" element={<FinancesPage />} />
                  <Route path="payments-automation" element={<PaymentsAutomationPage />} />
                  <Route path="school-reports" element={<ReportsPage />} />
                  <Route path="facilities" element={<SchoolFacilitiesPage />} />
                  
                  {/* Wellness routes */}
                  <Route path="athletes" element={<WellnessPatientsPage />} />
                  <Route path="schedule" element={<WellnessSchedulePage />} />
                  <Route path="evaluations/new" element={<WellnessSchedulePage />} />
                  <Route path="medical-history" element={<MedicalHistoryPage />} />
                  <Route path="follow-ups" element={<WellnessPatientsPage />} />
                  <Route path="nutrition" element={<NutritionPage />} />
                  <Route path="wellness-reports" element={<ReportsPage />} />
                  
                  {/* Store routes */}
                  <Route path="products" element={<StoreProductsPage />} />
                  <Route path="orders" element={<StoreOrdersPage />} />
                  <Route path="inventory" element={<StoreInventoryPage />} />
                  <Route path="suppliers" element={<StoreInventoryPage />} />
                  <Route path="categories" element={<StoreProductsPage />} />
                  <Route path="customers" element={<StoreOrdersPage />} />
                  <Route path="promotions" element={<StoreProductsPage />} />
                  <Route path="store-reports" element={<ReportsPage />} />
                  
                  {/* Organizer routes */}
                  <Route path="organizer-onboarding" element={<OrganizerOnboardingPage />} />
                  <Route path="organizer/home" element={<OrganizerDashboardPage />} />
                  <Route path="organizer/create-event" element={<CreateEventPage />} />
                  <Route path="organizer/event/:id" element={<EventManagementPage />} />
                  
                  {/* Admin routes */}
                  <Route path="admin/users" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <SettingsPage />
                    </ProtectedRoute>
                  } />
                  <Route path="admin/clubs" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ExplorePage />
                    </ProtectedRoute>
                  } />
                  <Route path="admin/reports" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ReportsPage />
                    </ProtectedRoute>
                  } />
                  <Route path="admin/analytics" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminAnalyticsPage />
                    </ProtectedRoute>
                  } />
                  <Route path="admin/config" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <SettingsPage />
                    </ProtectedRoute>
                  } />
                  <Route path="admin/logs" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <NotificationsPage />
                    </ProtectedRoute>
                  } />
                </Route>
                
                {/* Catch-all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              
              {/* Mobile Bottom Navigation */}
              <MobileBottomNav />
              
              {/* Global Cart Drawer */}
              <CartDrawer />
            </BrowserRouter>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
