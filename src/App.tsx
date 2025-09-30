import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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
import UnauthorizedPage from "./pages/UnauthorizedPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
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
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              
              {/* Athlete routes */}
              <Route path="teams" element={<div className="p-6"><h1 className="text-2xl font-bold">Mis Equipos - En construcción</h1></div>} />
              <Route path="stats" element={<div className="p-6"><h1 className="text-2xl font-bold">Estadísticas - En construcción</h1></div>} />
              <Route path="goals" element={<div className="p-6"><h1 className="text-2xl font-bold">Objetivos - En construcción</h1></div>} />
              <Route path="training" element={<div className="p-6"><h1 className="text-2xl font-bold">Entrenamientos - En construcción</h1></div>} />
              <Route path="explore" element={<div className="p-6"><h1 className="text-2xl font-bold">Explorar Escuelas - En construcción</h1></div>} />
              <Route path="shop" element={<div className="p-6"><h1 className="text-2xl font-bold">Tienda - En construcción</h1></div>} />
              <Route path="wellness" element={<div className="p-6"><h1 className="text-2xl font-bold">Bienestar - En construcción</h1></div>} />
              
              {/* Parent routes */}
              <Route path="children" element={<div className="p-6"><h1 className="text-2xl font-bold">Mis Hijos - En construcción</h1></div>} />
              <Route path="academic-progress" element={<div className="p-6"><h1 className="text-2xl font-bold">Progreso Académico - En construcción</h1></div>} />
              <Route path="attendance" element={<div className="p-6"><h1 className="text-2xl font-bold">Asistencias - En construcción</h1></div>} />
              <Route path="payments" element={<div className="p-6"><h1 className="text-2xl font-bold">Pagos - En construcción</h1></div>} />
              <Route path="messages" element={<div className="p-6"><h1 className="text-2xl font-bold">Mensajes - En construcción</h1></div>} />
              
              {/* Coach routes */}
              <Route path="results" element={<div className="p-6"><h1 className="text-2xl font-bold">Resultados - En construcción</h1></div>} />
              <Route path="training-plans" element={<div className="p-6"><h1 className="text-2xl font-bold">Planes de Entrenamiento - En construcción</h1></div>} />
              <Route path="reports" element={<div className="p-6"><h1 className="text-2xl font-bold">Reportes - En construcción</h1></div>} />
              <Route path="announcements" element={<div className="p-6"><h1 className="text-2xl font-bold">Anuncios - En construcción</h1></div>} />
              
              {/* School routes */}
              <Route path="students" element={<div className="p-6"><h1 className="text-2xl font-bold">Estudiantes - En construcción</h1></div>} />
              <Route path="coaches" element={<div className="p-6"><h1 className="text-2xl font-bold">Entrenadores - En construcción</h1></div>} />
              <Route path="programs" element={<div className="p-6"><h1 className="text-2xl font-bold">Programas - En construcción</h1></div>} />
              <Route path="finances" element={<div className="p-6"><h1 className="text-2xl font-bold">Finanzas - En construcción</h1></div>} />
              <Route path="facilities" element={<div className="p-6"><h1 className="text-2xl font-bold">Instalaciones - En construcción</h1></div>} />
              
              {/* Wellness routes */}
              <Route path="athletes" element={<div className="p-6"><h1 className="text-2xl font-bold">Mis Atletas - En construcción</h1></div>} />
              <Route path="schedule" element={<div className="p-6"><h1 className="text-2xl font-bold">Agenda - En construcción</h1></div>} />
              <Route path="evaluations/new" element={<div className="p-6"><h1 className="text-2xl font-bold">Nueva Evaluación - En construcción</h1></div>} />
              <Route path="medical-history" element={<div className="p-6"><h1 className="text-2xl font-bold">Historial Médico - En construcción</h1></div>} />
              <Route path="follow-ups" element={<div className="p-6"><h1 className="text-2xl font-bold">Seguimientos - En construcción</h1></div>} />
              <Route path="nutrition" element={<div className="p-6"><h1 className="text-2xl font-bold">Planes Nutricionales - En construcción</h1></div>} />
              
              {/* Store routes */}
              <Route path="products" element={<div className="p-6"><h1 className="text-2xl font-bold">Productos - En construcción</h1></div>} />
              <Route path="orders" element={<div className="p-6"><h1 className="text-2xl font-bold">Pedidos - En construcción</h1></div>} />
              <Route path="inventory" element={<div className="p-6"><h1 className="text-2xl font-bold">Inventario - En construcción</h1></div>} />
              <Route path="suppliers" element={<div className="p-6"><h1 className="text-2xl font-bold">Proveedores - En construcción</h1></div>} />
              <Route path="categories" element={<div className="p-6"><h1 className="text-2xl font-bold">Categorías - En construcción</h1></div>} />
              <Route path="customers" element={<div className="p-6"><h1 className="text-2xl font-bold">Clientes - En construcción</h1></div>} />
              <Route path="promotions" element={<div className="p-6"><h1 className="text-2xl font-bold">Promociones - En construcción</h1></div>} />
              
              {/* Admin routes */}
              <Route path="admin/users" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <div className="p-6"><h1 className="text-2xl font-bold">Gestión de Usuarios - En construcción</h1></div>
                </ProtectedRoute>
              } />
              <Route path="admin/clubs" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <div className="p-6"><h1 className="text-2xl font-bold">Gestión de Clubs - En construcción</h1></div>
                </ProtectedRoute>
              } />
              <Route path="admin/reports" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <div className="p-6"><h1 className="text-2xl font-bold">Reportes del Sistema - En construcción</h1></div>
                </ProtectedRoute>
              } />
              <Route path="admin/config" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <div className="p-6"><h1 className="text-2xl font-bold">Configuración del Sistema - En construcción</h1></div>
                </ProtectedRoute>
              } />
              <Route path="admin/logs" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <div className="p-6"><h1 className="text-2xl font-bold">Logs del Sistema - En construcción</h1></div>
                </ProtectedRoute>
              } />
            </Route>
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
