import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas no servidor." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { email, campos } = body;

    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) {
      return new Response(
        JSON.stringify({ error: "E-mail não informado para atualização." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Obtém os dados atuais de admin_users
    const { data: currentDoc } = await adminClient
      .from("admin_users")
      .select("data")
      .eq("id", cleanEmail)
      .maybeSingle();

    const previousData = currentDoc?.data || {};
    const updatedData = {
      ...previousData,
      ...(campos || {}),
      atualizadoEm: new Date().toISOString(),
    };

    // 2. Atualiza admin_users e usuarios_sistema via service_role
    await adminClient
      .from("admin_users")
      .upsert({ id: cleanEmail, data: updatedData });

    await adminClient
      .from("usuarios_sistema")
      .upsert({ id: cleanEmail, data: updatedData });

    // 3. Verifica se nivel_acesso, role ou canteiro_sede mudou para atualizar auth.users e forçar sign out
    const oldRole = previousData.nivelAcesso || previousData.role;
    const newRole = updatedData.nivelAcesso || updatedData.role;
    const oldSede = previousData.sede || previousData.canteiroSede;
    const newSede = updatedData.sede || updatedData.canteiroSede;
    const oldStatus = previousData.status;
    const newStatus = updatedData.status;

    const roleOrSedeChanged = (oldRole && newRole && oldRole !== newRole) ||
      (oldSede && newSede && oldSede !== newSede) ||
      (oldStatus && newStatus && oldStatus !== newStatus);

    let signedOut = false;
    // Localiza o usuário no auth.users
    const { data: listData } = await adminClient.auth.admin.listUsers();
    const authUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail);

    if (authUser) {
      // Atualiza app_metadata no auth.users
      await adminClient.auth.admin.updateUserById(authUser.id, {
        app_metadata: {
          nivel_acesso: newRole || "GESTOR_RH",
          role: newRole || "GESTOR_RH",
          canteiro_sede: newSede || "TODAS",
          status: newStatus || "ativo",
        },
      });

      if (roleOrSedeChanged) {
        try {
          // Desconecta todas as sessões ativas do usuário para forçar emissão de novo JWT com claims atualizadas
          await adminClient.auth.admin.signOut(authUser.id);
          signedOut = true;
        } catch (signOutErr) {
          console.warn("Aviso ao forçar sign out de usuário:", signOutErr);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        signedOut,
        message: roleOrSedeChanged
          ? "Usuário e permissões atualizados. Sessões ativas foram deslogadas para renovação de token."
          : "Dados do usuário atualizados com sucesso.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Erro inesperado ao atualizar usuário." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
