/*
  D-TEK GT Web OS v9 — Supabase Monster Config
  Propiedad de D-TEK GT / Dominic Morales.
  Configuración pública segura: aquí SOLO va Supabase URL y ANON KEY.
  Nunca poner contraseñas, service_role key, tokens privados ni webhook secreto aquí.
*/

window.DTEK_CONFIG = {
  whatsappNumber: "50247082329",
  ownerEmail: "rgdominicm@gmail.com",

  // Opcional: dejalo vacío para usar automáticamente cliente.html en el dominio actual.
  // Solo llenalo si querés forzar una URL específica de retorno después de Google.
  authRedirectUrl: "",

  // Supabase: pegar aquí los datos del proyecto cuando lo creemos.
  supabaseUrl: "https://bsgvtlkgvjixrhoxxbhl.supabase.co", // Ejemplo: "https://xxxxx.supabase.co"
  supabaseAnonKey: "sb_publishable_9z0XkAZO6_SyUx61WMjRpw_MuCCkzn9", // Ejemplo: "eyJhbGciOi..."

  // Modo de operación:
  // false = usar memoria local / demo
  // true = intentar usar Supabase para login, clientes, citas y panel.
  useSupabase: true
};
