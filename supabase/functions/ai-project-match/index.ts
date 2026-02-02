import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Fetching user profile and skills for:", user.id);

    // Sanitize user input to prevent prompt injection attacks
    const sanitizeForPrompt = (text: string | null | undefined, maxLen = 500): string => {
      if (!text) return '';
      return text
        .replace(/[\r\n]+/g, ' ')     // Remove newlines
        .replace(/["'`]/g, '')        // Remove quotes
        .replace(/[{}\[\]]/g, '')     // Remove special chars
        .substring(0, maxLen)         // Limit length
        .trim();
    };

    // Get user's profile, skills, roles, and passions
    const [profileRes, skillsRes, rolesRes, passionsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("user_skills").select("skill_id, skills(name)").eq("user_id", user.id),
      supabase.from("user_creative_roles").select("role_id, creative_roles(name)").eq("user_id", user.id),
      supabase.from("user_passions").select("passion_id, passions(name)").eq("user_id", user.id),
    ]);

    const userSkills = skillsRes.data?.map((s: any) => s.skills?.name).filter(Boolean) || [];
    const userRoles = rolesRes.data?.map((r: any) => r.creative_roles?.name).filter(Boolean) || [];
    const userPassions = passionsRes.data?.map((p: any) => p.passions?.name).filter(Boolean) || [];
    const userCity = profileRes.data?.city || "";

    console.log("User data:", { userSkills, userRoles, userPassions, userCity });

    // Get open projects with roles
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select(`
        id, title, description, status, city, total_budget, currency,
        project_roles(id, role_name, description, payout_amount, slots_available, slots_filled, is_locked),
        profiles!projects_creator_id_fkey(display_name, avatar_url)
      `)
      .eq("status", "open")
      .neq("creator_id", user.id);

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      throw projectsError;
    }

    if (!projects || projects.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter projects with available roles
    const projectsWithRoles = projects.filter((p: any) => 
      p.project_roles?.some((r: any) => !r.is_locked && r.slots_filled < r.slots_available)
    );

    if (projectsWithRoles.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI to match projects
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `You are a project matching assistant for a creative community platform. 
Your job is to match creators with suitable project opportunities based on their skills, roles, and interests.

Analyze the user's profile and the available projects, then return the top matches with scores and reasons.`;

    // Sanitize user data to prevent prompt injection
    const safeSkills = userSkills.map(s => sanitizeForPrompt(s, 50)).join(", ") || "None specified";
    const safeRoles = userRoles.map(r => sanitizeForPrompt(r, 50)).join(", ") || "None specified";
    const safePassions = userPassions.map(p => sanitizeForPrompt(p, 50)).join(", ") || "None specified";
    const safeCity = sanitizeForPrompt(userCity, 100) || "Not specified";

    const userPrompt = `<user_profile>
Skills: ${safeSkills}
Creative Roles: ${safeRoles}
Interests: ${safePassions}
City: ${safeCity}
</user_profile>

<available_projects>
${projectsWithRoles.slice(0, 20).map((p: any, i: number) => `
<project index="${i + 1}">
Title: ${sanitizeForPrompt(p.title, 100)}
Description: ${sanitizeForPrompt(p.description, 300) || "No description"}
Budget: ${p.total_budget} ${p.currency}
Open Roles: ${p.project_roles?.filter((r: any) => !r.is_locked && r.slots_filled < r.slots_available)
  .slice(0, 5)
  .map((r: any) => `${sanitizeForPrompt(r.role_name, 50)} ($${r.payout_amount})`).join(", ")}
</project>
`).join("")}
</available_projects>

Return the best matching projects for this user.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_project_matches",
              description: "Return ranked project matches for the user",
              parameters: {
                type: "object",
                properties: {
                  matches: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        project_index: { type: "number", description: "1-based index of the project" },
                        match_score: { type: "number", description: "Match score from 0-100" },
                        best_role: { type: "string", description: "The role that best fits the user" },
                        reasons: {
                          type: "array",
                          items: { type: "string" },
                          description: "2-3 reasons why this is a good match"
                        },
                      },
                      required: ["project_index", "match_score", "best_role", "reasons"],
                    },
                  },
                },
                required: ["matches"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_project_matches" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    console.log("AI response:", JSON.stringify(aiData, null, 2));

    let matchResults: any[] = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        matchResults = parsed.matches || [];
      } catch (e) {
        console.error("Error parsing AI response:", e);
      }
    }

    // Map AI results to actual project data
    const finalMatches = matchResults
      .filter((m: any) => m.project_index > 0 && m.project_index <= projectsWithRoles.length)
      .map((m: any) => {
        const project = projectsWithRoles[m.project_index - 1];
        const role = project.project_roles?.find((r: any) => 
          r.role_name.toLowerCase().includes(m.best_role.toLowerCase()) ||
          m.best_role.toLowerCase().includes(r.role_name.toLowerCase())
        ) || project.project_roles?.find((r: any) => !r.is_locked && r.slots_filled < r.slots_available);

        return {
          project,
          role,
          match_score: m.match_score,
          reasons: m.reasons,
        };
      })
      .filter((m: any) => m.role)
      .slice(0, 5);

    // Store matches in database
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Clear old matches for this user
    await adminSupabase.from("ai_project_matches").delete().eq("user_id", user.id);

    // Insert new matches
    if (finalMatches.length > 0) {
      await adminSupabase.from("ai_project_matches").insert(
        finalMatches.map((m: any) => ({
          user_id: user.id,
          project_id: m.project.id,
          role_id: m.role?.id,
          match_score: m.match_score,
          match_reasons: m.reasons,
        }))
      );
    }

    console.log("Returning", finalMatches.length, "matches");

    return new Response(JSON.stringify({ matches: finalMatches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in ai-project-match:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
