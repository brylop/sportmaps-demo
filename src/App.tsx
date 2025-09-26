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
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="profile" element={<div>Perfil - En construcción</div>} />
              <Route path="calendar" element={<div>Calendario - En construcción</div>} />
              <Route path="stats" element={<div>Estadísticas - En construcción</div>} />
              <Route path="teams" element={<div>Equipos - En construcción</div>} />
              <Route path="my-teams" element={<div>Mis Equipos - En construcción</div>} />
              <Route path="players" element={<div>Jugadores - En construcción</div>} />
              <Route path="matches" element={<div>Partidos - En construcción</div>} />
              <Route path="children" element={<div>Mis Hijos - En construcción</div>} />
              <Route path="activities" element={<div>Actividades - En construcción</div>} />
              <Route path="notifications" element={<div>Notificaciones - En construcción</div>} />
              <Route path="settings" element={<div>Configuración - En construcción</div>} />
              
              {/* Admin routes */}
              <Route path="admin/users" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <div>Gestión de Usuarios - En construcción</div>
                </ProtectedRoute>
              } />
              <Route path="admin/clubs" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <div>Gestión de Clubs - En construcción</div>
                </ProtectedRoute>
              } />
              <Route path="admin/system" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <div>Sistema - En construcción</div>
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
