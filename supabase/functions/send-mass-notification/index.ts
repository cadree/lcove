import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MassNotificationRequest {
  title: string;
  message: string;
  targetAudience: {
    type: "all" | "mindset_level" | "city";
    value?: string | number;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create user client to verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    console.log(`Mass notification request from user: ${user.id}`);

    // Verify admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      console.error("Admin check failed:", roleError);
      throw new Error("Access denied: Admin role required");
    }

    const { title, message, targetAudience }: MassNotificationRequest = await req.json();

    if (!title || !message) {
      throw new Error("Title and message are required");
    }

    console.log(`Sending mass notification: "${title}" to ${targetAudience.type}`);

    // Build query for target users
    let query = supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("is_suspended", false);

    if (targetAudience.type === "mindset_level" && targetAudience.value) {
      query = query.eq("mindset_level", targetAudience.value);
    } else if (targetAudience.type === "city" && targetAudience.value) {
      query = query.ilike("city", `%${targetAudience.value}%`);
    }

    const { data: targetUsers, error: usersError } = await query;

    if (usersError) {
      console.error("Error fetching target users:", usersError);
      throw new Error("Failed to fetch target users");
    }

    if (!targetUsers || targetUsers.length === 0) {
      console.log("No users match the target criteria");
      return new Response(
        JSON.stringify({ success: true, recipientCount: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${targetUsers.length} target users`);

    // Create notifications for all target users
    const notifications = targetUsers.map((u) => ({
      user_id: u.user_id,
      type: "announcement",
      title,
      body: message,
      data: { from: "admin", sent_at: new Date().toISOString() },
    }));

    // Insert notifications in batches of 100
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const { error: insertError } = await supabaseAdmin
        .from("notifications")
        .insert(batch);
      
      if (insertError) {
        console.error(`Error inserting notification batch ${i / batchSize}:`, insertError);
      } else {
        insertedCount += batch.length;
      }
    }

    console.log(`Created ${insertedCount} notifications`);

    // Log the announcement in admin_announcements
    const { error: announcementError } = await supabaseAdmin
      .from("admin_announcements")
      .insert({
        title,
        message,
        target_audience: targetAudience,
        sent_by: user.id,
        recipient_count: insertedCount,
      });

    if (announcementError) {
      console.error("Error logging announcement:", announcementError);
    }

    // Log admin action
    await supabaseAdmin.from("admin_actions").insert({
      admin_id: user.id,
      action_type: "mass_notification",
      target_user_id: user.id, // Self-reference for mass actions
      metadata: {
        title,
        target_audience: targetAudience,
        recipient_count: insertedCount,
      },
    });

    console.log(`Mass notification sent successfully to ${insertedCount} users`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipientCount: insertedCount,
        message: `Notification sent to ${insertedCount} users` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in send-mass-notification:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: errorMessage === "Unauthorized" ? 401 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});