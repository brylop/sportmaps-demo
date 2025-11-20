import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AuthLayout from "@/layouts/AuthLayout";

// Pages
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DemoProfilesPage from "./pages/DemoProfilesPage";
import DashboardPage from "./pages/DashboardPage";
import CalendarPage from "./pages/CalendarPage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import TeamsPage from "./pages/TeamsPage";
import StatsPage from "./pages/StatsPage";
import MessagesPage from "./pages/MessagesPage";
import MessagesDetailPage from "./pages/MessagesDetailPage";
import CalendarAdvancedPage from "./pages/CalendarAdvancedPage";
import AdvancedSearchPage from "./pages/AdvancedSearchPage";
import AnalyticsDashboardPage from "./pages/AnalyticsDashboardPage";
import InvitationsManagementPage from "./pages/InvitationsManagementPage";
import ExplorePage from "./pages/ExplorePage";
import ProfilePage from "./pages/ProfilePage";
import SchoolDetailPage from "./pages/SchoolDetailPage";
import MyEnrollmentsPage from "./pages/MyEnrollmentsPage";
import MyChildrenPage from "./pages/MyChildrenPage";
import AcademicProgressPage from "./pages/AcademicProgressPage";
import AttendancePage from "./pages/AttendancePage";
import PaymentsPage from "./pages/PaymentsPage";
import CoachAttendancePage from "./pages/CoachAttendancePage";
import ResultsPage from "./pages/ResultsPage";
import TrainingPlansPage from "./pages/TrainingPlansPage";
import CoachReportsPage from "./pages/CoachReportsPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import StudentsPage from "./pages/StudentsPage";
import StaffPage from "./pages/StaffPage";
import ProgramsManagementPage from "./pages/ProgramsManagementPage";
import AttendanceSupervisionPage from "./pages/AttendanceSupervisionPage";
import ResultsOverviewPage from "./pages/ResultsOverviewPage";
import FinancesPage from "./pages/FinancesPage";
import ReportsPage from "./pages/ReportsPage";
import SchoolFacilitiesPage from "./pages/SchoolFacilitiesPage";
import SchoolOnboardingPage from "./pages/SchoolOnboardingPage";
import SchoolStudentsManagementPage from "./pages/SchoolStudentsManagementPage";
import SchoolCoachesManagementPage from "./pages/SchoolCoachesManagementPage";
import CoachOnboardingPage from "./pages/CoachOnboardingPage";
import AthleteOnboardingPage from "./pages/AthleteOnboardingPage";
import WellnessOnboardingPage from "./pages/WellnessOnboardingPage";
import StoreOwnerOnboardingPage from "./pages/StoreOwnerOnboardingPage";
import WellnessPage from "./pages/WellnessPage";
import StorePage from "./pages/StorePage";
import AdminPanelPage from "./pages/AdminPanelPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/schools/:id" element={<SchoolDetailPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/demo-profiles" element={<DemoProfilesPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            
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
              <Route path="messages/:conversationId" element={<MessagesDetailPage />} />
              <Route path="calendar-advanced" element={<CalendarAdvancedPage />} />
              <Route path="advanced-search" element={<AdvancedSearchPage />} />
              <Route path="analytics-dashboard" element={<AnalyticsDashboardPage />} />
              <Route path="payments-stripe" element={<PaymentsPage />} />
              <Route path="invitations-management" element={<InvitationsManagementPage />} />
              
              {/* Athlete routes */}
              <Route path="teams" element={<TeamsPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="goals" element={<div className="p-6"><h1 className="text-2xl font-bold">Objetivos - En construcción</h1></div>} />
              <Route path="training" element={<div className="p-6"><h1 className="text-2xl font-bold">Entrenamientos - En construcción</h1></div>} />
              <Route path="enrollments" element={<MyEnrollmentsPage />} />
              <Route path="shop" element={<div className="p-6"><h1 className="text-2xl font-bold">Tienda - En construcción</h1></div>} />
              <Route path="wellness" element={<WellnessPage />} />
              <Route path="shop-marketplace" element={<StorePage />} />
              
              {/* Parent routes */}
              <Route path="children" element={<MyChildrenPage />} />
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
              <Route path="school-onboarding" element={<SchoolOnboardingPage />} />
              <Route path="students" element={<SchoolStudentsManagementPage />} />
              <Route path="staff" element={<SchoolCoachesManagementPage />} />
              <Route path="programs-management" element={<ProgramsManagementPage />} />
              <Route path="attendance-supervision" element={<AttendanceSupervisionPage />} />
              <Route path="results-overview" element={<ResultsOverviewPage />} />
              <Route path="finances" element={<FinancesPage />} />
              <Route path="school-reports" element={<ReportsPage />} />
              <Route path="facilities" element={<SchoolFacilitiesPage />} />
              
              {/* Wellness routes */}
              <Route path="wellness-dashboard" element={<WellnessPage />} />
              <Route path="athletes" element={<WellnessPage />} />
              <Route path="schedule" element={<WellnessPage />} />
              <Route path="evaluations/new" element={<WellnessPage />} />
              <Route path="medical-history" element={<WellnessPage />} />
              <Route path="follow-ups" element={<WellnessPage />} />
              <Route path="nutrition" element={<WellnessPage />} />
              
              {/* Store routes */}
              <Route path="products" element={<StorePage />} />
              <Route path="orders" element={<StorePage />} />
              <Route path="inventory" element={<StorePage />} />
              <Route path="suppliers" element={<StorePage />} />
              <Route path="categories" element={<StorePage />} />
              <Route path="customers" element={<StorePage />} />
              <Route path="promotions" element={<StorePage />} />
              
              {/* Admin routes */}
              <Route path="admin/dashboard" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPanelPage />
                </ProtectedRoute>
              } />
              <Route path="admin/users" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPanelPage />
                </ProtectedRoute>
              } />
              <Route path="admin/clubs" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPanelPage />
                </ProtectedRoute>
              } />
              <Route path="admin/reports" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPanelPage />
                </ProtectedRoute>
              } />
              <Route path="admin/config" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPanelPage />
                </ProtectedRoute>
              } />
              <Route path="admin/logs" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPanelPage />
                </ProtectedRoute>
              } />
            </Route>
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
