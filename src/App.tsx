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

import DashboardPage from "./pages/DashboardPage";
import CalendarPage from "./pages/CalendarPage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import TeamsPage from "./pages/TeamsPage";
import StatsPage from "./pages/StatsPage";
import MessagesPage from "./pages/MessagesPage";
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
import UnauthorizedPage from "./pages/UnauthorizedPage";
import UnderConstructionPage from "./pages/UnderConstructionPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos (antes cacheTime)
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
              
              {/* Athlete routes */}
              <Route path="teams" element={<TeamsPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="goals" element={<UnderConstructionPage title="Objetivos" />} />
              <Route path="training" element={<UnderConstructionPage title="Entrenamientos" />} />
              <Route path="enrollments" element={<MyEnrollmentsPage />} />
              <Route path="shop" element={<UnderConstructionPage title="Tienda" />} />
              <Route path="wellness" element={<UnderConstructionPage title="Bienestar" />} />
              
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
              
              {/* School routes - Nota: school-onboarding ya definido en línea 82 */}
              <Route path="students" element={<SchoolStudentsManagementPage />} />
              <Route path="staff" element={<SchoolCoachesManagementPage />} />
              <Route path="programs-management" element={<ProgramsManagementPage />} />
              <Route path="attendance-supervision" element={<AttendanceSupervisionPage />} />
              <Route path="results-overview" element={<ResultsOverviewPage />} />
              <Route path="finances" element={<FinancesPage />} />
              <Route path="school-reports" element={<ReportsPage />} />
              <Route path="facilities" element={<SchoolFacilitiesPage />} />
              
              {/* Wellness routes */}
              <Route path="athletes" element={<UnderConstructionPage title="Mis Atletas" />} />
              <Route path="schedule" element={<UnderConstructionPage title="Agenda" />} />
              <Route path="evaluations/new" element={<UnderConstructionPage title="Nueva Evaluación" />} />
              <Route path="medical-history" element={<UnderConstructionPage title="Historial Médico" />} />
              <Route path="follow-ups" element={<UnderConstructionPage title="Seguimientos" />} />
              <Route path="nutrition" element={<UnderConstructionPage title="Planes Nutricionales" />} />
              
              {/* Store routes */}
              <Route path="products" element={<UnderConstructionPage title="Productos" />} />
              <Route path="orders" element={<UnderConstructionPage title="Pedidos" />} />
              <Route path="inventory" element={<UnderConstructionPage title="Inventario" />} />
              <Route path="suppliers" element={<UnderConstructionPage title="Proveedores" />} />
              <Route path="categories" element={<UnderConstructionPage title="Categorías" />} />
              <Route path="customers" element={<UnderConstructionPage title="Clientes" />} />
              <Route path="promotions" element={<UnderConstructionPage title="Promociones" />} />
              
              {/* Admin routes */}
              <Route path="admin/users" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <UnderConstructionPage title="Gestión de Usuarios" />
                </ProtectedRoute>
              } />
              <Route path="admin/clubs" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <UnderConstructionPage title="Gestión de Clubs" />
                </ProtectedRoute>
              } />
              <Route path="admin/reports" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <UnderConstructionPage title="Reportes del Sistema" />
                </ProtectedRoute>
              } />
              <Route path="admin/config" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <UnderConstructionPage title="Configuración del Sistema" />
                </ProtectedRoute>
              } />
              <Route path="admin/logs" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <UnderConstructionPage title="Logs del Sistema" />
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
