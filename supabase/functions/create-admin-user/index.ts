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
    const { email, nome, nivel_acesso, canteiro_sede, status, senha_temporaria } = body;

    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Endereço de e-mail corporativo inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetRole = nivel_acesso || "GESTOR_RH";
    const targetSede = canteiro_sede || "TODAS";
    const targetStatus = status || "ativo";
    const tempPassword = senha_temporaria || `Comara@${Math.floor(100000 + Math.random() * 900000)}`;

    // 1. Cria ou obtém o usuário no auth.users via Admin API
    let userId: string | null = null;
    let isNewUser = false;

    // Tenta criar o usuário com email confirmado
    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        nome: nome || cleanEmail.split("@")[0],
        full_name: nome || cleanEmail.split("@")[0],
        must_change_password: true,
      },
      app_metadata: {
        nivel_acesso: targetRole,
        role: targetRole,
        canteiro_sede: targetSede,
        status: targetStatus,
      },
    });

    if (createData?.user) {
      userId = createData.user.id;
      isNewUser = true;
    } else if (createError && (createError.message.includes("already") || createError.status === 422)) {
      // Se já existe no auth.users, localiza o id
      const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
      if (!listError && listData?.users) {
        const found = listData.users.find((u: any) => u.email?.toLowerCase() === cleanEmail);
        if (found) {
          userId = found.id;
          // Atualiza app_metadata
          await adminClient.auth.admin.updateUserById(userId, {
            app_metadata: {
              nivel_acesso: targetRole,
              role: targetRole,
              canteiro_sede: targetSede,
              status: targetStatus,
            },
          });
        }
      }
    } else if (createError) {
      return new Response(
        JSON.stringify({ error: `Erro ao criar usuário no Auth: ${createError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Insere/atualiza registro na tabela documental admin_users e usuarios_sistema
    const nowIso = new Date().toISOString();
    const adminRecord = {
      id: cleanEmail,
      email: cleanEmail,
      nome: nome || cleanEmail.split("@")[0],
      nivelAcesso: targetRole,
      role: targetRole,
      perfil: targetRole,
      sede: targetSede,
      canteiroSede: targetSede,
      status: targetStatus,
      ativo: targetStatus === "ativo",
      criadoEm: nowIso,
      atualizadoEm: nowIso,
    };

    const { error: upsertError } = await adminClient
      .from("admin_users")
      .upsert({ id: cleanEmail, data: adminRecord });

    if (upsertError) {
      console.warn("Aviso ao sincronizar admin_users:", upsertError);
    }

    await adminClient
      .from("usuarios_sistema")
      .upsert({ id: cleanEmail, data: adminRecord });

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        isNewUser,
        tempPassword: isNewUser ? tempPassword : null,
        message: isNewUser
          ? `Usuário criado no Auth com sucesso. Senha temporária: ${tempPassword}`
          : "Usuário atualizado no Auth com sucesso.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Erro inesperado ao processar criação de usuário." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
