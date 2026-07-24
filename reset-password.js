/* D-TEK WEB v30.3.3 — Recuperación de contraseña */
(() => {
  const form = document.querySelector("#resetPasswordForm");
  const status = document.querySelector("#resetPasswordStatus");
  const doneActions = document.querySelector("#resetDoneActions");
  const submit = document.querySelector("#resetPasswordSubmit");
  const initialHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const initialQuery = new URLSearchParams(window.location.search);
  const hadRecoveryMarker = initialHash.get("type") === "recovery"
    || initialQuery.get("type") === "recovery"
    || initialQuery.has("code")
    || initialHash.has("access_token");
  let recoveryReady = false;

  function showStatus(message, type = "info") {
    if (!status) return;
    status.textContent = message;
    status.className = `status-box ${type}`;
  }

  function showForm() {
    recoveryReady = true;
    form?.classList.remove("reset-hidden");
    showStatus("Enlace validado. Ya podés elegir tu contraseña nueva.", "ok");
    document.querySelector("#resetNewPassword")?.focus();
  }

  function showLinkError(message) {
    form?.classList.add("reset-hidden");
    showStatus(message, "error");
  }

  async function initializeRecovery() {
    const errorDescription = initialHash.get("error_description") || initialQuery.get("error_description");
    if (errorDescription) {
      showLinkError(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
      return;
    }

    const sb = DtekBackend?.client?.();
    if (!sb) {
      showLinkError("No se pudo conectar con el sistema de acceso.");
      return;
    }

    sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) showForm();
    });

    // Supabase procesa el código o fragmento al inicializar el cliente.
    await new Promise(resolve => setTimeout(resolve, 350));
    const { data, error } = await sb.auth.getSession();
    if (error) {
      showLinkError(error.message);
      return;
    }

    if (data?.session && hadRecoveryMarker) {
      showForm();
      return;
    }

    showLinkError("Este enlace no es válido, ya fue usado o venció. Solicitá uno nuevo desde el acceso admin.");
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.querySelector("#resetNewPassword")?.value || "";
    const confirmation = document.querySelector("#resetConfirmPassword")?.value || "";

    if (!recoveryReady) {
      showLinkError("El enlace todavía no ha sido validado.");
      return;
    }
    if (password.length < 8) {
      showStatus("La contraseña necesita al menos 8 caracteres.", "error");
      return;
    }
    if (password !== confirmation) {
      showStatus("Las contraseñas no coinciden.", "error");
      return;
    }

    try {
      submit.disabled = true;
      submit.textContent = "Guardando...";
      showStatus("Actualizando tu contraseña...", "info");
      const sb = DtekBackend.client();
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      try { await sb.rpc("dtek_client_mark_password_changed"); } catch (_) {}
      await sb.auth.signOut();
      form.classList.add("reset-hidden");
      doneActions?.classList.remove("reset-hidden");
      showStatus("Contraseña cambiada correctamente. Ya podés iniciar sesión.", "ok");
    } catch (error) {
      showStatus(error.message || "No se pudo cambiar la contraseña.", "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Guardar contraseña nueva";
    }
  });

  initializeRecovery().catch(error => showLinkError(error.message || "No se pudo validar el enlace."));
})();
