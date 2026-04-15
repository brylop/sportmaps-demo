import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  Ticket,
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  event_date: string;
  city: string;
  sport: string;
  status: string;
  slug: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  published: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  closed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  completed: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

export default function OrganizerCalendarPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await bffClient.get<CalendarEvent[]>('/api/v1/events/mine');
      setEvents(data);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = lastDay.getDate();

    const days: { date: number | null; dateStr: string; events: CalendarEvent[] }[] = [];

    // Empty cells before first day
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ date: null, dateStr: '', events: [] });
    }

    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.event_date === dateStr);
      days.push({ date: d, dateStr, events: dayEvents });
    }

    return days;
  }, [year, month, events]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const today = new Date().toISOString().split('T')[0];

  // Events in the selected month
  const monthEvents = events.filter(e => {
    const d = new Date(e.event_date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-6xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/organizer/dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Calendario</h1>
          <p className="text-muted-foreground">{events.length} evento(s) programados</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        {/* Calendar Grid */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="text-lg">
                {MONTH_NAMES[month]} {year}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToday}>Hoy</Button>
                <Button variant="ghost" size="icon" onClick={nextMonth}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {d}
                </div>
              ))}
            </div>
            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => (
                <div
                  key={idx}
                  className={`min-h-[80px] p-1 rounded-md border text-sm ${
                    day.date === null
                      ? 'bg-transparent border-transparent'
                      : day.dateStr === today
                        ? 'bg-primary/5 border-primary'
                        : 'bg-background border-border hover:bg-accent/30'
                  }`}
                >
                  {day.date && (
                    <>
                      <span className={`text-xs font-medium ${day.dateStr === today ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                        {day.date}
                      </span>
                      <div className="space-y-0.5 mt-1">
                        {day.events.slice(0, 2).map(ev => (
                          <button
                            key={ev.id}
                            onClick={() => navigate(`/organizer/event/${ev.id}`)}
                            className={`w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded truncate ${STATUS_COLORS[ev.status] || STATUS_COLORS.draft}`}
                            title={ev.title}
                          >
                            {ev.title}
                          </button>
                        ))}
                        {day.events.length > 2 && (
                          <span className="text-[10px] text-muted-foreground px-1">
                            +{day.events.length - 2} más
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar: Events this month */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Eventos en {MONTH_NAMES[month]}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {monthEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sin eventos este mes</p>
              ) : (
                monthEvents
                  .sort((a, b) => a.event_date.localeCompare(b.event_date))
                  .map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => navigate(`/organizer/event/${ev.id}`)}
                      className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <p className="font-medium text-sm line-clamp-1">{ev.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(ev.event_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {ev.city}
                      </div>
                    </button>
                  ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
