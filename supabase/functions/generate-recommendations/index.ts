import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userProfile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating recommendations for user:", userProfile.name);

    const systemPrompt = `Eres un asistente experto en deportes y bienestar que genera recomendaciones personalizadas para usuarios de SportMaps.
Tu objetivo es sugerir escuelas deportivas, deportes nuevos y servicios de bienestar basados en el perfil del usuario.
Genera exactamente 3 recomendaciones variadas y personalizadas.`;

    const userPrompt = `Genera recomendaciones deportivas y de bienestar para:
Nombre: ${userProfile.name}
Nivel: ${userProfile.level}
Actividades completadas: ${userProfile.completedActivities}
Puntos: ${userProfile.points}

Para cada recomendación, proporciona:
1. Título llamativo
2. Tipo (Escuela, Deporte, o Bienestar)
3. Razón personalizada (por qué es relevante para este usuario)
4. Beneficios específicos

Formato: Responde ÚNICAMENTE con un objeto JSON válido con un array "recommendations" que contenga 3 objetos, cada uno con: title, type, reason, benefits (array de strings).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido, intenta de nuevo más tarde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Pago requerido, por favor agrega fondos a tu workspace de Lovable AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI Response received");
    
    const content = data.choices[0].message.content;
    
    // Parse the JSON response
    let recommendations;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        recommendations = parsed.recommendations;
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      // Fallback recommendations
      recommendations = [
        {
          title: "Yoga para Deportistas",
          type: "Bienestar",
          reason: "Perfecto para mejorar tu flexibilidad y recuperación",
          benefits: ["Mejora la flexibilidad", "Reduce lesiones", "Aumenta concentración"]
        },
        {
          title: "Escuela de Natación AquaTech",
          type: "Escuela",
          reason: "Excelente complemento a tu entrenamiento actual",
          benefits: ["Ejercicio de bajo impacto", "Mejora resistencia cardiovascular", "Fortalece todo el cuerpo"]
        },
        {
          title: "Nutrición Deportiva Personalizada",
          type: "Bienestar",
          reason: "Optimiza tu rendimiento con una dieta adecuada",
          benefits: ["Planes personalizados", "Mejora energía", "Recuperación más rápida"]
        }
      ];
    }

    return new Response(
      JSON.stringify({ recommendations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in generate-recommendations:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
