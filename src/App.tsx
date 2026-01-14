import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import AuthLayout from "@/layouts/AuthLayout";
import { Loader2 } from "lucide-react";

// Loading component for suspense
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Critical pages (loaded immediately)
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import NotFound from "./pages/NotFound";
import UnauthorizedPage from "./pages/UnauthorizedPage";

// Lazy loaded pages (loaded on demand)
const DemoProfilesPage = lazy(() => import("./pages/DemoProfilesPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const TeamsPage = lazy(() => import("./pages/TeamsPage"));
const StatsPage = lazy(() => import("./pages/StatsPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const MessagesDetailPage = lazy(() => import("./pages/MessagesDetailPage"));
const CalendarAdvancedPage = lazy(() => import("./pages/CalendarAdvancedPage"));
const AdvancedSearchPage = lazy(() => import("./pages/AdvancedSearchPage"));
const AnalyticsDashboardPage = lazy(() => import("./pages/AnalyticsDashboardPage"));
const InvitationsManagementPage = lazy(() => import("./pages/InvitationsManagementPage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SchoolDetailPage = lazy(() => import("./pages/SchoolDetailPage"));
const MyEnrollmentsPage = lazy(() => import("./pages/MyEnrollmentsPage"));
const MyChildrenPage = lazy(() => import("./pages/MyChildrenPage"));
const AcademicProgressPage = lazy(() => import("./pages/AcademicProgressPage"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage"));
const CoachAttendancePage = lazy(() => import("./pages/CoachAttendancePage"));
const ResultsPage = lazy(() => import("./pages/ResultsPage"));
const TrainingPlansPage = lazy(() => import("./pages/TrainingPlansPage"));
const CoachReportsPage = lazy(() => import("./pages/CoachReportsPage"));
const AnnouncementsPage = lazy(() => import("./pages/AnnouncementsPage"));
const StudentsPage = lazy(() => import("./pages/StudentsPage"));
const StaffPage = lazy(() => import("./pages/StaffPage"));
const ProgramsManagementPage = lazy(() => import("./pages/ProgramsManagementPage"));
const AttendanceSupervisionPage = lazy(() => import("./pages/AttendanceSupervisionPage"));
const ResultsOverviewPage = lazy(() => import("./pages/ResultsOverviewPage"));
const FinancesPage = lazy(() => import("./pages/FinancesPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SchoolFacilitiesPage = lazy(() => import("./pages/SchoolFacilitiesPage"));
const SchoolOnboardingPage = lazy(() => import("./pages/SchoolOnboardingPage"));
const SchoolStudentsManagementPage = lazy(() => import("./pages/SchoolStudentsManagementPage"));
const SchoolCoachesManagementPage = lazy(() => import("./pages/SchoolCoachesManagementPage"));
const CoachOnboardingPage = lazy(() => import("./pages/CoachOnboardingPage"));
const AthleteOnboardingPage = lazy(() => import("./pages/AthleteOnboardingPage"));
const WellnessOnboardingPage = lazy(() => import("./pages/WellnessOnboardingPage"));
const StoreOwnerOnboardingPage = lazy(() => import("./pages/StoreOwnerOnboardingPage"));
const WellnessPage = lazy(() => import("./pages/WellnessPage"));
const AthletesListPage = lazy(() => import("./pages/AthletesListPage"));
const WellnessSchedulePage = lazy(() => import("./pages/WellnessSchedulePage"));
const NutritionPage = lazy(() => import("./pages/NutritionPage"));
const MedicalHistoryPage = lazy(() => import("./pages/MedicalHistoryPage"));
const StorePage = lazy(() => import("./pages/StorePage"));
const AdminPanelPage = lazy(() => import("./pages/AdminPanelPage"));
const GoalsPage = lazy(() => import("./pages/GoalsPage"));
const TrainingPage = lazy(() => import("./pages/TrainingPage"));
const ShopPage = lazy(() => import("./pages/ShopPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const ChildAttendancePage = lazy(() => import("./pages/ChildAttendancePage"));
const ChildProgressPage = lazy(() => import("./pages/ChildProgressPage"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Index />} />
                  <Route path="/explore" element={<ExplorePage />} />
                  <Route path="/schools/:id" element={<SchoolDetailPage />} />
                  <Route path="/shop" element={<ShopPage />} />
                  <Route path="/product/:id" element={<ProductDetailPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
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
                    <Route path="goals" element={<GoalsPage />} />
                    <Route path="training" element={<TrainingPage />} />
                    <Route path="enrollments" element={<MyEnrollmentsPage />} />
                    <Route path="wellness" element={<WellnessPage />} />
                    <Route path="shop-marketplace" element={<StorePage />} />

                    {/* Parent routes */}
                    <Route path="children" element={<MyChildrenPage />} />
                    <Route path="children/:childId/attendance" element={<ChildAttendancePage />} />
                    <Route path="children/:childId/progress" element={<ChildProgressPage />} />
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
                    <Route path="wellness-dashboard" element={<WellnessPage />} />
                    <Route path="athletes" element={<AthletesListPage />} />
                    <Route path="schedule" element={<WellnessSchedulePage />} />
                    <Route path="evaluations/new" element={<WellnessPage />} />
                    <Route path="medical-history" element={<MedicalHistoryPage />} />
                    <Route path="follow-ups" element={<MedicalHistoryPage />} />
                    <Route path="nutrition" element={<NutritionPage />} />

                    {/* Store routes */}
                    <Route path="products" element={<StorePage />} />
                    <Route path="orders" element={<StorePage />} />
                    <Route path="inventory" element={<StorePage />} />
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
              </Suspense>
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
