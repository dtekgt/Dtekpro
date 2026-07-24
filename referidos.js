/* D-TEK GT Web OS v22 — Referidos públicos */

const referralQs = (selector) => document.querySelector(selector);

function referralSafe(value) {
  return String(value ?? "").replace(/[<>&"]/g, (char) => ({"<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;"}[char]));
}

function referralStatus(message, type = "info") {
  const box = referralQs("#publicReferralStatus");
  if (box) box.innerHTML = `<p class="status-${type}">${referralSafe(message)}</p>`;
}

function normalizeGtPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 8) return `502${digits}`;
  return digits;
}

function initPublicReferral() {
  const form = referralQs("#publicReferralForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    try {
      if (referralQs("#referralWebsite")?.value) return;
      if (!window.DtekBackend?.isConfigured?.()) throw new Error("El sistema todavía no está conectado. Escribinos por WhatsApp para registrar tu recomendación.");
      if (!referralQs("#referralConsent")?.checked) throw new Error("Confirmá que podemos contactar a la persona recomendada.");

      if (submit) { submit.disabled = true; submit.textContent = "Registrando..."; }
      referralStatus("Guardando tu recomendación...", "info");

      await DtekBackend.createPublicReferral({
        referrer_name: referralQs("#referrerName").value.trim(),
        referrer_phone: normalizeGtPhone(referralQs("#referrerPhone").value),
        referred_name: referralQs("#referredName").value.trim(),
        referred_phone: normalizeGtPhone(referralQs("#referredPhone").value),
        referred_vehicle: referralQs("#referredVehicle").value.trim(),
        notes: referralQs("#referralNotes").value.trim(),
        source: "referir.html"
      });

      form.reset();
      referralStatus("¡Listo! Cuando complete su primer trabajo, ganás 100 puntos D-TEK.", "ok");
    } catch (error) {
      const message = String(error?.message || error || "No se pudo registrar.");
      referralStatus(message.includes("dtek_public_create_referral") ? "Falta activar el SQL 12 de referidos en Supabase." : message, "error");
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = "Registrar recomendación"; }
    }
  });
}

document.addEventListener("DOMContentLoaded", initPublicReferral);
