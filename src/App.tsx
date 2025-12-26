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
import ChildProgressPage from "./pages/ChildProgressPage";
import ChildAttendancePage from "./pages/ChildAttendancePage";
import ShopPage from "./pages/ShopPage";
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
import NotFound from "./pages/NotFound";

// New functional pages (replacing "En construcción")
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

// Checkout and Analytics
import CheckoutPage from "./pages/CheckoutPage";
import AdminAnalyticsPage from "./pages/AdminAnalyticsPage";

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
          <CartProvider>
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
                <Route path="/checkout" element={<CheckoutPage />} />
                
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
                  <Route path="goals" element={<GoalsPage />} />
                  <Route path="training" element={<TrainingPage />} />
                  <Route path="enrollments" element={<MyEnrollmentsPage />} />
                  <Route path="shop" element={<ShopPage />} />
                  <Route path="wellness" element={<AthleteWellnessPage />} />
                  
                  {/* Parent routes */}
                  <Route path="children" element={<MyChildrenPage />} />
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
