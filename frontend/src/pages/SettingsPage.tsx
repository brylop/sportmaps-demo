import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { NotificationsSection } from '@/components/settings/NotificationsSection';
import { SecuritySection } from '@/components/settings/SecuritySection';
import { PrivacySection } from '@/components/settings/PrivacySection';
import { ServicesSection } from '@/components/settings/ServicesSection';
import { BrandingSettingsForm } from '@/components/settings/BrandingSettingsForm';
import { SchoolInfoSection } from '@/components/settings/SchoolInfoSection';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  User, 
  Bell, 
  Shield, 
  Globe, 
  Palette, 
  Briefcase, 
  Building2,
  Settings as SettingsIcon,
  ChevronRight,
  Sparkles
} from 'lucide-react';


export default function SettingsPage() {
  const { profile } = useAuth();
  const { 
    loading, 
    saving, 
    data, 
    services, 
    updateProfile, 
    updateNotificationPreferences, 
    updatePrivacyPreferences,
    updateBranding,
    updateSchoolInfo,
    changePassword 
  } = useSettings();

  const { currentUserRole } = useSchoolContext();

  const [activeTab, setActiveTab] = useState('profile');

  // Role check for school-related tabs
  // Priority: Use currentUserRole from context (which handles multi-tenancy and switching),
  // Fallback: profile role from Auth
  const isSchoolAdmin = ['owner', 'admin', 'school_admin', 'school', 'super_admin'].includes(currentUserRole || profile?.role || '');

  useEffect(() => {
    document.title = "Configuración - SportMaps";
  }, []);

  if (loading) {
    return (
      <div className="container max-w-6xl py-8 space-y-8 animate-pulse">
        <div className="h-10 w-48 bg-muted rounded" />
        <div className="grid lg:grid-cols-[240px_1fr] gap-8">
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 w-full bg-muted rounded-lg" />)}
          </div>
          <div className="h-[400px] w-full bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-20">

      
      {/* Header Section */}
      <div className="bg-background border-b shadow-sm mb-8">
        <div className="container max-w-6xl py-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm uppercase tracking-wider">
                <SettingsIcon className="h-4 w-4" />
                Panel de Control
              </div>
              <h1 className="text-4xl font-black text-foreground tracking-tight">Configuración</h1>
              <p className="text-muted-foreground text-lg">
                Gestiona tu cuenta, preferencias y la identidad de tu academia.
              </p>
            </div>
            
            {isSchoolAdmin && data?.school && (
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-primary/5 border border-primary/10 shadow-sm">
                <div className="h-12 w-12 rounded-xl border bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {data.school.logo_url ? (
                    <img src={data.school.logo_url} alt="School Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Palette className="h-6 w-6 text-primary/40" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-primary uppercase">Escuela Activa</p>
                  <p className="font-semibold">{data.school.name}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container max-w-6xl">
        <Tabs defaultValue="profile" className="grid lg:grid-cols-[280px_1fr] gap-8 items-start" onValueChange={setActiveTab}>
          {/* Navigation Sidebar */}
          <aside className="sticky top-24">
            <TabsList className="flex flex-col h-auto bg-transparent border-none p-0 space-y-1 w-full">
              <TabsTrigger 
                value="profile" 
                className="justify-start gap-3 h-12 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200"
              >
                <User className="h-4 w-4" />
                <span>Perfil</span>
                <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${activeTab === 'profile' ? 'rotate-90' : ''}`} />
              </TabsTrigger>
              
              <TabsTrigger 
                value="notifications" 
                className="justify-start gap-3 h-12 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200"
              >
                <Bell className="h-4 w-4" />
                <span>Notificaciones</span>
                <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${activeTab === 'notifications' ? 'rotate-90' : ''}`} />
              </TabsTrigger>

              {isSchoolAdmin && (
                <>
                  <div className="pt-4 pb-2 px-4 text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-2">
                    <span className="h-px bg-muted flex-1" />
                    Academia
                    <span className="h-px bg-muted flex-1" />
                  </div>
                  
                  <TabsTrigger 
                    value="school-info" 
                    className="justify-start gap-3 h-12 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200"
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Información Academia</span>
                    <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${activeTab === 'school-info' ? 'rotate-90' : ''}`} />
                  </TabsTrigger>
                  
                  <TabsTrigger 
                    value="services" 
                    className="justify-start gap-3 h-12 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200"
                  >
                    <Briefcase className="h-4 w-4" />
                    <span>Servicios</span>
                    <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${activeTab === 'services' ? 'rotate-90' : ''}`} />
                  </TabsTrigger>

                  {/* Branding tab temporarily hidden as per user request
                  <TabsTrigger 
                    value="branding" 
                    className="justify-start gap-3 h-12 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200"
                  >
                    <Palette className="h-4 w-4" />
                    <span>Branding</span>
                    <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${activeTab === 'branding' ? 'rotate-90' : ''}`} />
                  </TabsTrigger>
                  */}
                </>
              )}

              <div className="pt-4 pb-2 px-4 text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-2">
                <span className="h-px bg-muted flex-1" />
                Seguridad
                <span className="h-px bg-muted flex-1" />
              </div>

              <TabsTrigger 
                value="privacy" 
                className="justify-start gap-3 h-12 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200"
              >
                <Globe className="h-4 w-4" />
                <span>Privacidad</span>
                <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${activeTab === 'privacy' ? 'rotate-90' : ''}`} />
              </TabsTrigger>

              <TabsTrigger 
                value="security" 
                className="justify-start gap-3 h-12 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200"
              >
                <Shield className="h-4 w-4" />
                <span>Seguridad</span>
                <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${activeTab === 'security' ? 'rotate-90' : ''}`} />
              </TabsTrigger>
            </TabsList>

            {/* Premium Upsell Card - Hidden for now as per user request */}
            {false && !isSchoolAdmin && (
              <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-primary-foreground shadow-lg shadow-primary/20 relative overflow-hidden group">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-white/20 rounded-lg">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">SportMaps Pro</span>
                  </div>
                  <h4 className="font-bold text-lg mb-1">Crea tu propia escuela</h4>
                  <p className="text-primary-foreground/80 text-xs mb-4">
                    Transforma tu pasión en un negocio. Gestiona clases, alumnos y pagos.
                  </p>
                  <Button variant="secondary" size="sm" className="w-full text-primary font-bold shadow-sm group-hover:bg-white transition-colors">
                    Empezar Gratis
                  </Button>
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12 transition-transform group-hover:rotate-0 duration-500">
                  <SettingsIcon size={120} />
                </div>
              </div>
            )}
          </aside>

          {/* Main Content Area */}
          <main className="min-h-[600px]">
            <TabsContent value="profile" className="mt-0">
              <ProfileSection data={data} saving={saving} onSave={updateProfile} />
            </TabsContent>
            
            <TabsContent value="notifications" className="mt-0">
              <NotificationsSection data={data} saving={saving} onSave={updateNotificationPreferences} />
            </TabsContent>

            {isSchoolAdmin && (
              <>
                <TabsContent value="school-info" className="mt-0">
                  <SchoolInfoSection data={data} saving={saving} onSave={updateSchoolInfo} />
                </TabsContent>

                <TabsContent value="services" className="mt-0">
                  <ServicesSection services={services} schoolName={data?.school?.name} />
                </TabsContent>
                
                {/* Branding tab content temporarily hidden
                <TabsContent value="branding" className="mt-0">
                    <BrandingSettingsForm />
                </TabsContent>
                */}
              </>
            )}

            <TabsContent value="privacy" className="mt-0">
              <PrivacySection data={data} saving={saving} onSave={updatePrivacyPreferences} />
            </TabsContent>

            <TabsContent value="security" className="mt-0">
              <SecuritySection saving={saving} onChangePassword={changePassword} />
            </TabsContent>
          </main>
        </Tabs>
      </div>
    </div>
  );
}
