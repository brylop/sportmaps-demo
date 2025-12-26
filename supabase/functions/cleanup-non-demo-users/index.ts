import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Allow CORS for development
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get all users
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      throw listError;
    }

    // Filter non-demo users (those without @demo.sportmaps.com email)
    const nonDemoUsers = users.filter(user => 
      !user.email?.endsWith('@demo.sportmaps.com')
    );

    console.log(`Found ${nonDemoUsers.length} non-demo users to delete`);

    // Delete each non-demo user
    const deletePromises = nonDemoUsers.map(user => 
      supabaseAdmin.auth.admin.deleteUser(user.id)
    );

    await Promise.all(deletePromises);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully deleted ${nonDemoUsers.length} non-demo users`,
        deletedCount: nonDemoUsers.length
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error cleaning up users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
