import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface School {
  name: string;
  description: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  sports: string[];
  amenities: string[];
  rating: number;
  total_reviews: number;
  verified: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Demo schools data
    const demoSchools: School[] = [
      {
        name: 'Academia Deportiva SportMaps',
        description: 'Centro deportivo líder con más de 15 años de experiencia formando campeones en múltiples disciplinas',
        city: 'Bogotá',
        address: 'Calle 100 #15-20, Bogotá',
        phone: '+57 1 234 5678',
        email: 'info@sportmaps.com',
        sports: ['Fútbol', 'Baloncesto', 'Voleibol', 'Natación'],
        amenities: ['Cancha sintética', 'Piscina olímpica', 'Gimnasio', 'Cafetería', 'Parqueadero'],
        rating: 4.8,
        total_reviews: 127,
        verified: true
      },
      {
        name: 'Club Deportivo Los Campeones',
        description: 'Formación integral para niños y jóvenes con entrenadores certificados',
        city: 'Medellín',
        address: 'Carrera 43A #15-31, Medellín',
        phone: '+57 4 567 8901',
        email: 'contacto@loscampeones.com',
        sports: ['Fútbol', 'Tenis', 'Natación'],
        amenities: ['Canchas de fútbol', 'Canchas de tenis', 'Vestuarios', 'Enfermería'],
        rating: 4.6,
        total_reviews: 89,
        verified: true
      },
      {
        name: 'Centro Deportivo Élite',
        description: 'Instalaciones de primer nivel para el desarrollo deportivo profesional',
        city: 'Cali',
        address: 'Avenida 6 Norte #26-50, Cali',
        phone: '+57 2 345 6789',
        email: 'info@elite-sports.com',
        sports: ['Baloncesto', 'Voleibol', 'Gimnasia', 'Karate'],
        amenities: ['Coliseo cubierto', 'Gimnasio', 'Sala de fisioterapia', 'Parqueadero'],
        rating: 4.7,
        total_reviews: 104,
        verified: true
      },
      {
        name: 'Escuela de Natación AquaMasters',
        description: 'Especialistas en natación para todas las edades desde bebés hasta adultos mayores',
        city: 'Barranquilla',
        address: 'Calle 85 #50-12, Barranquilla',
        phone: '+57 5 678 9012',
        email: 'info@aquamasters.com',
        sports: ['Natación', 'Waterpolo', 'Clavados'],
        amenities: ['Piscina semi-olímpica', 'Piscina para niños', 'Vestuarios', 'Cafetería'],
        rating: 4.9,
        total_reviews: 156,
        verified: true
      },
      {
        name: 'Academia de Fútbol Futuros Cracks',
        description: 'Formación deportiva especializada en fútbol con metodología europea',
        city: 'Bogotá',
        address: 'Calle 127 #45-78, Bogotá',
        phone: '+57 1 456 7890',
        email: 'info@futuroscracks.com',
        sports: ['Fútbol'],
        amenities: ['Cancha reglamentaria', 'Cancha sintética', 'Gimnasio', 'Sala de video análisis'],
        rating: 4.5,
        total_reviews: 92,
        verified: true
      },
      {
        name: 'Club de Tenis Raqueta de Oro',
        description: 'Escuela de tenis con entrenadores ATP y WTA',
        city: 'Medellín',
        address: 'Carrera 25 #10-50, Medellín',
        phone: '+57 4 789 0123',
        email: 'contacto@raquetadeoro.com',
        sports: ['Tenis', 'Padel'],
        amenities: ['Canchas de arcilla', 'Canchas duras', 'Pro shop', 'Restaurante'],
        rating: 4.8,
        total_reviews: 78,
        verified: true
      },
      {
        name: 'Centro Deportivo Integral Olympia',
        description: 'Múltiples disciplinas deportivas bajo un mismo techo',
        city: 'Cali',
        address: 'Calle 70 #4B-35, Cali',
        phone: '+57 2 234 5678',
        email: 'info@olympia.com',
        sports: ['Fútbol', 'Baloncesto', 'Natación', 'Artes Marciales', 'Yoga'],
        amenities: ['Canchas múltiples', 'Piscina', 'Dojo', 'Gimnasio', 'Spa'],
        rating: 4.7,
        total_reviews: 143,
        verified: true
      },
      {
        name: 'Academia de Baloncesto HoopsNation',
        description: 'Entrenamiento de baloncesto de alto rendimiento',
        city: 'Bogotá',
        address: 'Carrera 7 #142-56, Bogotá',
        phone: '+57 1 567 8901',
        email: 'info@hoopsnation.com',
        sports: ['Baloncesto'],
        amenities: ['Canchas NBA standard', 'Gimnasio de alto rendimiento', 'Sala de análisis'],
        rating: 4.6,
        total_reviews: 67,
        verified: false
      },
      {
        name: 'Gimnasio Deportivo FitSports',
        description: 'Centro de acondicionamiento físico y deportes',
        city: 'Cartagena',
        address: 'Avenida Santander #25-30, Cartagena',
        phone: '+57 5 890 1234',
        email: 'info@fitsports.com',
        sports: ['Gimnasia', 'Crossfit', 'Yoga', 'Pilates'],
        amenities: ['Gimnasio completo', 'Salas de clases', 'Spa', 'Nutricionista'],
        rating: 4.4,
        total_reviews: 112,
        verified: false
      },
      {
        name: 'Club de Artes Marciales Samurái',
        description: 'Enseñanza tradicional de artes marciales orientales',
        city: 'Bucaramanga',
        address: 'Calle 36 #28-45, Bucaramanga',
        phone: '+57 7 901 2345',
        email: 'info@samurai.com',
        sports: ['Karate', 'Judo', 'Taekwondo', 'Aikido'],
        amenities: ['Dojo tradicional', 'Sala de meditación', 'Vestidores'],
        rating: 4.9,
        total_reviews: 85,
        verified: true
      }
    ];

    // Check if schools already exist
    const { data: existingSchools } = await supabase
      .from('schools')
      .select('name')
      .limit(1);

    if (existingSchools && existingSchools.length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Schools already exist in database',
          count: existingSchools.length
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Insert demo schools
    const { data, error } = await supabase
      .from('schools')
      .insert(demoSchools)
      .select();

    if (error) {
      console.error('Error inserting schools:', error);
      throw error;
    }

    console.log(`Successfully seeded ${data.length} schools`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully seeded ${data.length} schools`,
        schools: data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in seed-schools function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
