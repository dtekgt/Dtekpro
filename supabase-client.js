/*
  D-TEK GT Web OS v30.3.1 — Supabase Client Layer
  Propiedad de D-TEK GT / Dominic Morales.
  Capa de conexión preparada para base de datos real.
*/

const DtekBackend = (() => {
  function config() {
    return window.DTEK_CONFIG || {};
  }

  const LOCAL_LOGIN_DOMAIN = "login.dtekgt.com";

  function normalizeUsername(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._]+/g, "")
      .replace(/[._]{2,}/g, ".")
      .replace(/^\.+|\.+$/g, "");
  }

  function validUsername(value) {
    return /^[a-z0-9][a-z0-9._]{2,29}$/.test(normalizeUsername(value));
  }

  function validOptionalEmail(value) {
    const email = String(value || "").trim();
    return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function localLoginEmail(username) {
    return `${normalizeUsername(username)}@${LOCAL_LOGIN_DOMAIN}`;
  }

  function isLocalLoginEmail(email) {
    return String(email || "").toLowerCase().endsWith(`@${LOCAL_LOGIN_DOMAIN}`);
  }

  function isConfigured() {
    const cfg = config();
    return Boolean(cfg.useSupabase && cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  }

  function client() {
    if (!isConfigured()) return null;
    if (!window.__dtekSupabaseClient) {
      window.__dtekSupabaseClient = window.supabase.createClient(config().supabaseUrl, config().supabaseAnonKey);
    }
    return window.__dtekSupabaseClient;
  }

  async function getSession() {
    const sb = client();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session;
  }

  async function resolveLoginIdentifier(identifier) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const clean = String(identifier || "").trim().toLowerCase();
    if (!clean) throw new Error("Escribí tu correo o usuario.");

    const { data, error } = await sb.rpc("dtek_public_resolve_login", { p_identifier: clean });
    if (error) {
      // Compatibilidad mientras se aplica database/14_v30_3_local_access.sql.
      if (clean.includes("@")) return clean;
      const setupError = new Error("El acceso por usuario todavía no está activo.");
      setupError.code = "USERNAME_LOGIN_NOT_READY";
      throw setupError;
    }
    if (!data) {
      const notFound = new Error("Usuario no encontrado.");
      notFound.code = "LOGIN_IDENTIFIER_NOT_FOUND";
      throw notFound;
    }
    return String(data).trim().toLowerCase();
  }

  async function signIn(identifier, password) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const email = await resolveLoginIdentifier(identifier);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  function clientPortalRedirectUrl() {
    const configured = String(config().authRedirectUrl || "").trim();
    if (configured) return configured;
    return new URL("cliente.html", window.location.href).toString().split("#")[0].split("?")[0];
  }

  function passwordResetRedirectUrl() {
    return new URL("reset-password.html", window.location.href).toString().split("#")[0].split("?")[0];
  }

  async function requestPasswordReset(identifier) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const email = await resolveLoginIdentifier(identifier);
    if (isLocalLoginEmail(email)) {
      const noEmail = new Error("Esta cuenta no tiene un correo real para recibir el enlace. Pedí a D-TEK una contraseña temporal nueva.");
      noEmail.code = "PASSWORD_RESET_EMAIL_UNAVAILABLE";
      throw noEmail;
    }
    const { data, error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetRedirectUrl()
    });
    if (error) throw error;
    return data;
  }

  async function signUp(email, password, metadata = {}) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: clientPortalRedirectUrl()
      }
    });
    if (error) throw error;
    return data;
  }


  async function usernameAvailable(username) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const normalized = normalizeUsername(username);
    if (!validUsername(normalized)) return false;
    const { data, error } = await sb.rpc("dtek_public_username_available", { p_username: normalized });
    if (error) throw error;
    return Boolean(data);
  }

  async function contactEmailAvailable(email) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const clean = String(email || "").trim().toLowerCase();
    if (!clean) return true;
    if (!validOptionalEmail(clean)) return false;
    const { data, error } = await sb.rpc("dtek_public_contact_email_available", { p_email: clean });
    if (error) throw error;
    return Boolean(data);
  }

  async function signUpLocal(payload = {}) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const username = normalizeUsername(payload.username);
    const contactEmail = String(payload.contactEmail || "").trim().toLowerCase();
    const password = String(payload.password || "");

    if (!validUsername(username)) {
      const error = new Error("El usuario debe tener entre 3 y 30 caracteres válidos.");
      error.code = "USERNAME_INVALID";
      throw error;
    }
    if (!validOptionalEmail(contactEmail)) {
      const error = new Error("Revisá el correo opcional.");
      error.code = "EMAIL_INVALID";
      throw error;
    }
    if (password.length < 6) {
      const error = new Error("La contraseña debe tener al menos 6 caracteres.");
      error.code = "PASSWORD_TOO_SHORT";
      throw error;
    }
    if (!(await usernameAvailable(username))) {
      const error = new Error("Ese usuario ya está ocupado.");
      error.code = "USERNAME_TAKEN";
      throw error;
    }
    if (contactEmail && !(await contactEmailAvailable(contactEmail))) {
      const error = new Error("Ese correo ya tiene una cuenta.");
      error.code = "EMAIL_ALREADY_REGISTERED";
      throw error;
    }

    const authEmail = localLoginEmail(username);
    const { data, error } = await sb.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: {
          role: "client",
          username,
          contact_email: contactEmail || null,
          full_name: String(payload.fullName || "").trim() || null,
          phone: String(payload.phone || "").trim() || null,
          access_mode: "local",
          must_change_password: Boolean(payload.mustChangePassword)
        }
      }
    });
    if (error) throw error;
    if (Array.isArray(data?.user?.identities) && data.user.identities.length === 0) {
      const duplicate = new Error("Ese usuario ya existe.");
      duplicate.code = "USERNAME_TAKEN";
      throw duplicate;
    }
    return { ...data, username, contactEmail, authEmail };
  }

  async function updateMyAccess(username, contactEmail = "") {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const normalized = normalizeUsername(username);
    if (normalized && !validUsername(normalized)) {
      const error = new Error("Usá de 3 a 30 caracteres: letras, números, punto o guion bajo.");
      error.code = "USERNAME_INVALID";
      throw error;
    }
    if (!validOptionalEmail(contactEmail)) {
      const error = new Error("Revisá el correo opcional.");
      error.code = "EMAIL_INVALID";
      throw error;
    }
    const { data, error } = await sb.rpc("dtek_client_update_access", {
      p_username: normalized || null,
      p_contact_email: String(contactEmail || "").trim().toLowerCase() || null
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function updateMyPassword(password) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    if (String(password || "").length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
    const { data, error } = await sb.auth.updateUser({ password });
    if (error) throw error;
    const marked = await sb.rpc("dtek_client_mark_password_changed");
    if (marked.error) console.warn("No se pudo limpiar el aviso de contraseña temporal.", marked.error);
    return data;
  }

  async function createClientAccessAsAdmin(payload = {}) {
    const sb = client();
    const session = await getSession();
    if (!sb || !session?.user?.id) throw new Error("Iniciá sesión como administrador.");
    const profile = await currentProfile();
    if (profile?.role !== "admin") throw new Error("Solo una cuenta admin puede crear accesos.");

    const username = normalizeUsername(payload.username);
    const contactEmail = String(payload.contactEmail || "").trim().toLowerCase();
    const password = String(payload.password || "");
    if (!validUsername(username)) throw new Error("El usuario no es válido.");
    if (!validOptionalEmail(contactEmail)) throw new Error("El correo opcional no es válido.");
    if (password.length < 6) throw new Error("La contraseña temporal necesita al menos 6 caracteres.");
    if (!(await usernameAvailable(username))) throw new Error("Ese usuario ya está ocupado.");
    if (contactEmail && !(await contactEmailAvailable(contactEmail))) throw new Error("Ese correo ya tiene una cuenta.");

    const isolated = window.supabase.createClient(config().supabaseUrl, config().supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const authEmail = localLoginEmail(username);
    const { data: created, error: createError } = await isolated.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: {
          role: "client",
          username,
          contact_email: contactEmail || null,
          full_name: String(payload.fullName || "").trim() || null,
          phone: String(payload.phone || "").trim() || null,
          access_mode: "local",
          must_change_password: true
        }
      }
    });
    if (createError) throw createError;
    if (!created?.user?.id || (Array.isArray(created.user.identities) && created.user.identities.length === 0)) {
      throw new Error("No se pudo crear el acceso. El usuario puede existir o la confirmación de correo sigue activa.");
    }

    const ownerId = created.user.id;
    const warnings = [];
    const profileUpdate = await sb.from("profiles").update({
      username,
      contact_email: contactEmail || null,
      full_name: String(payload.fullName || "").trim() || null,
      phone: String(payload.phone || "").trim() || null,
      access_mode: "local",
      must_change_password: true,
      credentials_issued_at: new Date().toISOString()
    }).eq("id", ownerId).select("*").single();
    if (profileUpdate.error) warnings.push(`Perfil: ${profileUpdate.error.message}`);

    let vehicle = null;
    let appointment = null;
    const hasVehicle = String(payload.vehicleBrand || "").trim() && String(payload.vehicleLine || "").trim();
    if (hasVehicle) {
      const vehicleInsert = await sb.from("vehicles").insert({
        owner_id: ownerId,
        brand: String(payload.vehicleBrand).trim(),
        line: String(payload.vehicleLine).trim(),
        year: payload.vehicleYear ? Number(payload.vehicleYear) : null,
        plate: String(payload.vehiclePlate || "").trim() || null,
        mileage: payload.vehicleMileage ? Number(payload.vehicleMileage) : null,
        nickname: String(payload.vehicleNickname || "").trim() || null,
        notes: String(payload.vehicleNotes || "").trim() || null
      }).select("*").single();
      if (vehicleInsert.error) warnings.push(`Vehículo: ${vehicleInsert.error.message}`);
      else vehicle = vehicleInsert.data;
    }

    const serviceDescription = String(payload.serviceDescription || "").trim();
    if (vehicle?.id && serviceDescription) {
      const serviceDate = payload.serviceDate ? new Date(`${payload.serviceDate}T12:00:00-06:00`) : new Date();
      const end = new Date(serviceDate.getTime() + 60 * 60 * 1000);
      const blockStart = new Date(serviceDate.getTime() - 15 * 60 * 1000);
      const blockEnd = new Date(end.getTime() + 15 * 60 * 1000);
      const appointmentInsert = await sb.from("appointments").insert({
        client_id: ownerId,
        vehicle_id: vehicle.id,
        service_id: null,
        client_name: String(payload.fullName || "Cliente D-TEK").trim(),
        client_email: contactEmail || authEmail,
        client_phone: String(payload.phone || "").trim() || null,
        vehicle_brand: vehicle.brand,
        vehicle_line: vehicle.line,
        vehicle_year: vehicle.year,
        vehicle_moves: "Sí, arranca y se mueve",
        location: "Registrado por D-TEK",
        city: null,
        symptom: serviceDescription,
        scheduled_start: serviceDate.toISOString(),
        scheduled_end: end.toISOString(),
        block_start: blockStart.toISOString(),
        block_end: blockEnd.toISOString(),
        status: "completed",
        source: "admin-provisioning"
      }).select("*").single();
      if (appointmentInsert.error) warnings.push(`Servicio: ${appointmentInsert.error.message}`);
      else {
        appointment = appointmentInsert.data;
        const workOrderInsert = await sb.from("work_orders").insert({
          appointment_id: appointment.id,
          diagnosis: serviceDescription,
          recommendations: String(payload.serviceRecommendations || "").trim() || null,
          labor_total: payload.laborTotal !== "" && payload.laborTotal != null ? Number(payload.laborTotal) : null,
          parts_total: payload.partsTotal !== "" && payload.partsTotal != null ? Number(payload.partsTotal) : null,
          grand_total: (payload.laborTotal !== "" || payload.partsTotal !== "")
            ? Number(payload.laborTotal || 0) + Number(payload.partsTotal || 0)
            : null,
          status: "completed"
        }).select("*").single();
        if (workOrderInsert.error) warnings.push(`Reporte: ${workOrderInsert.error.message}`);
      }
    }

    return {
      user: created.user,
      profile: profileUpdate.data || null,
      vehicle,
      appointment,
      username,
      temporaryPassword: password,
      contactEmail,
      warnings
    };
  }

  async function signInWithGoogle() {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: clientPortalRedirectUrl(),
        queryParams: {
          access_type: "offline",
          prompt: "select_account"
        }
      }
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const sb = client();
    if (!sb) return;
    await sb.auth.signOut();
  }

  async function currentProfile() {
    const sb = client();
    const session = await getSession();
    if (!sb || !session?.user?.id) return null;
    const { data, error } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
    if (error) throw error;
    return data;
  }

  async function listAppointmentsForAdmin() {
    const sb = client();
    if (!sb) return [];
    const { data, error } = await sb
      .from("appointments_view")
      .select("*")
      .order("scheduled_start", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function listAppointmentsRawForAdmin() {
    const sb = client();
    if (!sb) return [];
    const { data, error } = await sb
      .from("appointments")
      .select("*")
      .order("scheduled_start", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function updateAppointmentStatus(appointmentId, status, note = "") {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_admin_update_appointment_status", {
      p_appointment_id: appointmentId,
      p_status: status,
      p_note: note
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function createBlockedTime(startIso, endIso, reason = "") {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_admin_create_blocked_time", {
      p_start_time: startIso,
      p_end_time: endIso,
      p_reason: reason
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function deleteBlockedTime(blockId) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_admin_delete_blocked_time", {
      p_block_id: blockId
    });
    if (error) throw error;
    return data;
  }

  async function listBlockedTimes() {
    const sb = client();
    if (!sb) return [];
    const { data, error } = await sb
      .from("blocked_times")
      .select("*")
      .order("start_time", { ascending: true });
    if (error) throw error;
    return data || [];
  }



  async function getBusyBlocks(startIso, endIso) {
    const sb = client();
    if (!sb) return [];
    const { data, error } = await sb.rpc("dtek_get_busy_blocks", {
      p_start: startIso,
      p_end: endIso
    });
    if (error) throw error;
    return data || [];
  }

  async function lookupByPhone(phone) {
    const sb = client();
    if (!sb) return { found: false };
    const { data, error } = await sb.rpc("dtek_lookup_by_phone", { p_phone: phone });
    if (error) throw error;
    return data || { found: false };
  }

  async function createPublicAppointment(payload) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_create_public_appointment", {
      p_service_id: payload.service_id,
      p_client_name: payload.client_name,
      p_client_email: payload.client_email,
      p_client_phone: payload.client_phone,
      p_vehicle_brand: payload.vehicle_brand,
      p_vehicle_line: payload.vehicle_line,
      p_vehicle_year: payload.vehicle_year,
      p_vehicle_moves: payload.vehicle_moves,
      p_location: payload.location,
      p_city: payload.city,
      p_symptom: payload.symptom,
      p_scheduled_start: payload.scheduled_start,
      p_scheduled_end: payload.scheduled_end,
      p_block_start: payload.block_start,
      p_block_end: payload.block_end,
      p_source: payload.source || "web"
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function createPublicReferral(payload) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_public_create_referral", {
      p_referrer_name: payload.referrer_name,
      p_referrer_phone: payload.referrer_phone,
      p_referred_name: payload.referred_name,
      p_referred_phone: payload.referred_phone,
      p_referred_vehicle: payload.referred_vehicle || null,
      p_notes: payload.notes || null,
      p_source: payload.source || "public-referral"
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function createMyReferral(payload) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_client_create_referral", {
      p_referred_name: payload.referred_name,
      p_referred_phone: payload.referred_phone,
      p_referred_vehicle: payload.referred_vehicle || null,
      p_notes: payload.notes || null
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function claimMyReferrals() {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_client_claim_referrals");
    if (error) throw error;
    return data ?? 0;
  }

  async function listMyReferrals() {
    const sb = client();
    const session = await getSession();
    if (!sb || !session?.user?.id) return [];
    const { data, error } = await sb.rpc("dtek_client_list_referrals");
    if (error) throw error;
    return data || [];
  }

  async function getMyLoyaltySummary() {
    const sb = client();
    const session = await getSession();
    if (!sb || !session?.user?.id) return null;
    const { data, error } = await sb.rpc("dtek_client_get_loyalty_summary");
    if (error) throw error;
    return Array.isArray(data) ? (data[0] || null) : data;
  }

  async function getMyPointsSummary() {
    const sb = client();
    const session = await getSession();
    if (!sb || !session?.user?.id) return null;
    const { data, error } = await sb.rpc("dtek_client_get_points_summary");
    if (error) throw error;
    return Array.isArray(data) ? (data[0] || null) : data;
  }

  async function listMyRewards() {
    const sb = client();
    const session = await getSession();
    if (!sb || !session?.user?.id) return [];
    const { data, error } = await sb.rpc("dtek_client_list_rewards");
    if (error) throw error;
    return data || [];
  }

  async function listMyPointsActivity(limit = 12) {
    const sb = client();
    const session = await getSession();
    if (!sb || !session?.user?.id) return [];
    const { data, error } = await sb.rpc("dtek_client_list_points_activity", { p_limit: Number(limit || 12) });
    if (error) throw error;
    return data || [];
  }

  async function listMyRedemptions() {
    const sb = client();
    const session = await getSession();
    if (!sb || !session?.user?.id) return [];
    const { data, error } = await sb.rpc("dtek_client_list_redemptions");
    if (error) throw error;
    return data || [];
  }

  async function redeemReward(rewardId) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_client_redeem_reward", { p_reward_id: rewardId });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function listRedemptionsForAdmin() {
    const sb = client();
    if (!sb) return [];
    const { data, error } = await sb.rpc("dtek_admin_list_redemptions");
    if (error) throw error;
    return data || [];
  }

  async function updateRedemptionStatus(redemptionId, status, notes = "") {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_admin_update_redemption_status", {
      p_redemption_id: redemptionId,
      p_status: status,
      p_notes: notes || null
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function adjustPoints(ownerId, points, description) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_admin_adjust_points", {
      p_owner_id: ownerId,
      p_points: Number(points),
      p_description: description
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function listReferralsForAdmin() {
    const sb = client();
    if (!sb) return [];
    const { data, error } = await sb.rpc("dtek_admin_list_referrals");
    if (error) throw error;
    return data || [];
  }

  async function updateReferralStatus(referralId, status, rewardAmount = 100, convertedAppointmentId = null) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_admin_update_referral_status", {
      p_referral_id: referralId,
      p_status: status,
      p_reward_amount: Number(rewardAmount || 0),
      p_converted_appointment_id: convertedAppointmentId || null
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function adjustLoyalty(ownerId, amount, description) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_admin_adjust_loyalty", {
      p_owner_id: ownerId,
      p_amount: Number(amount),
      p_description: description
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function listMyVehicles() {
    const sb = client();
    const session = await getSession();
    if (!sb || !session?.user?.id) return [];
    const { data, error } = await sb
      .from("vehicles")
      .select("*")
      .eq("owner_id", session.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function updateMyProfile(fullName, phone, preferences = {}) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");

    const extendedPayload = {
      p_full_name: fullName,
      p_phone: phone,
      p_default_location: preferences.default_location || null,
      p_default_city: preferences.default_city || null,
      p_preferred_time_window: preferences.preferred_time_window || null,
      p_contact_preference: preferences.contact_preference || null
    };

    const extended = await sb.rpc("dtek_client_update_profile", extendedPayload);
    if (!extended.error) return Array.isArray(extended.data) ? extended.data[0] : extended.data;

    console.warn("Perfil avanzado no disponible todavía; usando actualización básica.", extended.error);
    const basic = await sb.rpc("dtek_client_update_profile", {
      p_full_name: fullName,
      p_phone: phone
    });
    if (basic.error) throw basic.error;
    return Array.isArray(basic.data) ? basic.data[0] : basic.data;
  }

  async function claimMyAppointments() {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_client_claim_appointments");
    if (error) throw error;
    return data ?? 0;
  }

  async function createMyVehicle(payload) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");

    const extendedPayload = {
      p_brand: payload.brand,
      p_line: payload.line,
      p_year: payload.year ? Number(payload.year) : null,
      p_plate: payload.plate || null,
      p_vin: payload.vin || null,
      p_notes: payload.notes || null,
      p_nickname: payload.nickname || null,
      p_mileage: payload.mileage ? Number(payload.mileage) : null,
      p_engine: payload.engine || null,
      p_transmission: payload.transmission || null,
      p_use_type: payload.use_type || null
    };

    const extended = await sb.rpc("dtek_client_create_vehicle", extendedPayload);
    if (!extended.error) return Array.isArray(extended.data) ? extended.data[0] : extended.data;

    console.warn("Vehículo enriquecido no disponible todavía; usando creación básica.", extended.error);
    const basic = await sb.rpc("dtek_client_create_vehicle", {
      p_brand: payload.brand,
      p_line: payload.line,
      p_year: payload.year ? Number(payload.year) : null,
      p_plate: payload.plate || null,
      p_vin: payload.vin || null,
      p_notes: payload.notes || null
    });
    if (basic.error) throw basic.error;
    return Array.isArray(basic.data) ? basic.data[0] : basic.data;
  }

  async function updateMyVehicleCare(payload) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_client_update_vehicle_care", {
      p_vehicle_id: payload.vehicle_id,
      p_nickname: payload.nickname || null,
      p_mileage: payload.mileage ? Number(payload.mileage) : null,
      p_engine: payload.engine || null,
      p_transmission: payload.transmission || null,
      p_use_type: payload.use_type || null,
      p_notes: payload.notes || null
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function getMyVehicle(vehicleId) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_client_get_vehicle", {
      p_vehicle_id: vehicleId
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function listMyVehicleHistory(vehicleId) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_client_list_vehicle_history", {
      p_vehicle_id: vehicleId
    });
    if (error) throw error;
    return data || [];
  }

  async function listMyVehicleHealth(vehicleId) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_client_list_vehicle_health", {
      p_vehicle_id: vehicleId
    });
    if (error) throw error;
    return data || [];
  }

  async function saveVehicleInspections(appointmentId, inspections = []) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    if (!inspections.length) return [];
    const { data, error } = await sb.rpc("dtek_admin_save_vehicle_inspections", {
      p_appointment_id: appointmentId,
      p_inspections: inspections
    });
    if (error) throw error;
    return data || [];
  }

  const BUCKET_INSPECCIONES = "vehicle-inspections";

  async function uploadInspectionPhoto(path, blob) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { error } = await sb.storage.from(BUCKET_INSPECCIONES).upload(path, blob, {
      contentType: "image/jpeg",
      upsert: false,
      cacheControl: "3600"
    });
    if (error) throw error;
    return path;
  }

  async function listWorkOrderInspections(appointmentId) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_client_work_order_inspections", {
      p_appointment_id: appointmentId
    });
    if (error) throw error;
    return data || [];
  }

  async function createInspectionPhotoUrls(paths = []) {
    const sb = client();
    if (!sb || !paths.length) return {};
    const { data, error } = await sb.storage.from(BUCKET_INSPECCIONES).createSignedUrls(paths, 3600);
    if (error) throw error;
    const urls = {};
    (data || []).forEach((row) => { if (row?.path && row.signedUrl) urls[row.path] = row.signedUrl; });
    return urls;
  }

  async function createAppointmentForVehicle(payload) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_client_create_appointment_for_vehicle", {
      p_vehicle_id: payload.vehicle_id,
      p_service_id: payload.service_id,
      p_client_name: payload.client_name,
      p_client_email: payload.client_email,
      p_client_phone: payload.client_phone,
      p_vehicle_moves: payload.vehicle_moves,
      p_location: payload.location,
      p_city: payload.city,
      p_symptom: payload.symptom,
      p_scheduled_start: payload.scheduled_start,
      p_scheduled_end: payload.scheduled_end,
      p_block_start: payload.block_start,
      p_block_end: payload.block_end,
      p_source: payload.source || "client-portal-vehicle"
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function saveWorkOrderReport(payload) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_admin_upsert_work_order_report", {
      p_appointment_id: payload.appointment_id,
      p_diagnosis: payload.diagnosis || null,
      p_recommendations: payload.recommendations || null,
      p_parts_notes: payload.parts_notes || null,
      p_labor_total: payload.labor_total !== "" && payload.labor_total != null ? Number(payload.labor_total) : null,
      p_parts_total: payload.parts_total !== "" && payload.parts_total != null ? Number(payload.parts_total) : null,
      p_status: payload.status || "completed"
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  // Cierra el trabajo completo: reporte, lineas del recibo, kilometraje del dia
  // y la cita, todo en una transaccion. Reemplaza a saveWorkOrderReport, que
  // guardaba el reporte y dejaba la cita abierta.
  async function cerrarTrabajo(payload) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_admin_cerrar_trabajo", {
      p_appointment_id: payload.appointment_id,
      p_diagnosis: payload.diagnosis || null,
      p_recommendations: payload.recommendations || null,
      p_parts_notes: payload.parts_notes || null,
      p_mileage: payload.mileage != null && payload.mileage !== "" ? Number(payload.mileage) : null,
      p_items: payload.items || [],
      p_cerrar_cita: payload.cerrar_cita !== false
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function lookupClientByPhoneAdmin(phone) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_admin_lookup_client_by_phone", { p_phone: phone });
    if (error) throw error;
    return data || { found: false };
  }

  async function logCompletedJob(payload) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_admin_log_completed_job", {
      p_client_id: payload.client_id,
      p_vehicle_id: payload.vehicle_id || null,
      p_job_description: payload.job_description,
      p_service_date: payload.service_date || null,
      p_mileage: payload.mileage != null && payload.mileage !== "" ? Number(payload.mileage) : null,
      p_recommendations: payload.recommendations || null,
      p_parts_notes: payload.parts_notes || null,
      p_items: payload.items || [],
      p_vehicle_brand: payload.vehicle_brand || null,
      p_vehicle_line: payload.vehicle_line || null,
      p_vehicle_year: payload.vehicle_year ? Number(payload.vehicle_year) : null
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function obtenerRecibo(appointmentId) {
    const sb = client();
    if (!sb) throw new Error("Supabase no está configurado todavía.");
    const { data, error } = await sb.rpc("dtek_recibo", { p_appointment_id: appointmentId });
    if (error) throw error;
    return data;
  }

  async function listMyAppointments() {
    const sb = client();
    const session = await getSession();
    if (!sb || !session?.user?.id) return [];
    const { data, error } = await sb.rpc("dtek_client_list_my_appointments");
    if (error) throw error;
    return data || [];
  }

  async function listMyWorkOrders() {
    const sb = client();
    const session = await getSession();
    if (!sb || !session?.user?.id) return [];
    const { data, error } = await sb.rpc("dtek_client_list_my_work_orders");
    if (error) throw error;
    return data || [];
  }

  return {
    isConfigured,
    client,
    getSession,
    signIn,
    resolveLoginIdentifier,
    signUp,
    signUpLocal,
    usernameAvailable,
    contactEmailAvailable,
    updateMyAccess,
    updateMyPassword,
    requestPasswordReset,
    passwordResetRedirectUrl,
    createClientAccessAsAdmin,
    normalizeUsername,
    isLocalLoginEmail,
    signInWithGoogle,
    signOut,
    currentProfile,
    listAppointmentsForAdmin,
    listAppointmentsRawForAdmin,
    listMyAppointments,
    updateAppointmentStatus,
    createBlockedTime,
    deleteBlockedTime,
    listBlockedTimes,
    getBusyBlocks,
    lookupByPhone,
    createPublicAppointment,
    createPublicReferral,
    createMyReferral,
    claimMyReferrals,
    listMyReferrals,
    getMyLoyaltySummary,
    getMyPointsSummary,
    listMyRewards,
    listMyPointsActivity,
    listMyRedemptions,
    redeemReward,
    listReferralsForAdmin,
    listRedemptionsForAdmin,
    updateRedemptionStatus,
    adjustPoints,
    updateReferralStatus,
    adjustLoyalty,
    listMyVehicles,
    updateMyProfile,
    claimMyAppointments,
    createMyVehicle,
    updateMyVehicleCare,
    getMyVehicle,
    listMyVehicleHistory,
    listMyVehicleHealth,
    saveVehicleInspections,
    uploadInspectionPhoto,
    listWorkOrderInspections,
    createInspectionPhotoUrls,
    createAppointmentForVehicle,
    saveWorkOrderReport,
    cerrarTrabajo,
    lookupClientByPhoneAdmin,
    logCompletedJob,
    obtenerRecibo,
    listMyWorkOrders
  };
})();

// Exponer capa backend para páginas que validan window.DtekBackend.
window.DtekBackend = DtekBackend;
