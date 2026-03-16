import { createClient } from 'jsr:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

Deno.serve(async (req) => {
  // Manejar CORS PREFLIGHT
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const { imageBase64, mimeType } = await req.json()

    if (!imageBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'Faltan datos de imagen' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurado' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const client = new Anthropic({
      apiKey: apiKey,
    })

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20240620', // Usamos sonnet 3.5 que es excelente para visión
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 }
          },
          {
            type: 'text',
            text: `Analiza este comprobante de pago y extrae SOLO:
1. La fecha de la transacción (formato YYYY-MM-DD)
2. El valor total transferido (solo número, sin puntos ni comas)

Responde ÚNICAMENTE con JSON así:
{"date": "2026-03-12", "amount": 90000}

Si no puedes leer algún campo, usa null.`
          }
        ]
      }]
    })

    const content = response.content[0]
    const text = content.type === 'text' ? content.text : '{}'
    const result = JSON.parse(text)

    return new Response(JSON.stringify({
      orc_date: result.date,
      orc_amount: result.amount
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (error) {
    console.error('Error analyzing receipt:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
