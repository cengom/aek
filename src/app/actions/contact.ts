"use server";
import { headers } from "next/headers";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { areas } from "@/content/areas";

export type ContactState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<"name" | "phone" | "email" | "area" | "message" | "consent", string>>;
  values?: Record<string, string>;
};

// Basit, örnek başına bellek içi sınır: 10 dakikada IP başına 5 talep.
// Birden fazla sunucu örneğinde kalıcı bir çözüm için Upstash Redis / Vercel KV önerilir (README).
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;
// Ek olarak örnek başına toplam üst sınır: çok sayıda farklı IP'den gelen bot dalgası
// Resend kotasını tüketip gelen kutusunu doldurmasın.
const GLOBAL_LIMIT = 40;
const hits = new Map<string, number[]>();
let globalHits: number[] = [];
function rateLimited(key: string) {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < WINDOW_MS);
  if (globalHits.length >= GLOBAL_LIMIT) return true;
  // Haritayı tamamen silmek yerine yalnızca süresi geçmiş kayıtları temizle
  // (tamamen silmek, sınırı sıfırlamanın bir yolu olurdu).
  if (hits.size > 5000) {
    for (const [k, ts] of hits) if (!ts.some((t) => now - t < WINDOW_MS)) hits.delete(k);
    if (hits.size > 5000) return true;
  }
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= LIMIT) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  globalHits.push(now);
  return false;
}

// Tek satırlık alanlardan satır sonu ve kontrol karakterlerini temizle
// (e-posta konu satırına/başlıklarına satır enjekte edilmesini önler).
// eslint-disable-next-line no-control-regex
const oneLine = (s: string) => s.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();
// Çok satırlı mesajda satır sonları kalsın, diğer kontrol karakterleri gitsin.
// eslint-disable-next-line no-control-regex
const multiLine = (s: string) => s.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendContact(_prev: ContactState, form: FormData): Promise<ContactState> {
  const locale = String(form.get("locale") || "tr") === "en" ? "en" : "tr";
  const t = await getTranslations({ locale, namespace: "contact.form" });

  const v = {
    name: oneLine(String(form.get("name") ?? "")).slice(0, 120),
    phone: oneLine(String(form.get("phone") ?? "")).slice(0, 40),
    email: oneLine(String(form.get("email") ?? "")).slice(0, 160),
    area: oneLine(String(form.get("area") ?? "")).slice(0, 60),
    message: multiLine(String(form.get("message") ?? "")).slice(0, 4000),
  };
  const consent = form.get("consent") === "on";

  // Honeypot: gerçek kullanıcı bu alanı görmez. Doluysa sessizce başarı döndür.
  if (String(form.get("company") ?? "") !== "") return { status: "success", message: t("success") };

  const errors: ContactState["errors"] = {};
  if (!v.name) errors.name = t("required");
  if (!v.phone) errors.phone = t("required");
  else if (!/^[+()\d\s-]{7,20}$/.test(v.phone)) errors.phone = t("invalidPhone");
  if (!v.email) errors.email = t("required");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) errors.email = t("invalidEmail");
  if (!v.area) errors.area = t("required");
  else if (v.area !== "diger" && !areas.some((a) => a.id === v.area)) errors.area = t("required");
  if (!v.message) errors.message = t("required");
  else if (v.message.length < 20) errors.message = t("tooShort");
  if (!consent) errors.consent = t("consentRequired");
  if (Object.keys(errors).length) return { status: "error", errors, values: v };

  // Çok hızlı gönderim (2 sn altı) bot göstergesidir.
  const started = Number(form.get("started") ?? 0);
  if (started && Date.now() - started < 2000) return { status: "success", message: t("success") };

  const h = await headers();
  // Vercel'de x-vercel-forwarded-for / x-real-ip, istemcinin değiştiremediği gerçek IP'dir.
  const ip =
    h.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown";
  if (rateLimited(ip)) return { status: "error", message: t("rateLimited"), values: v };

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !to || !from) {
    console.error("[contact] RESEND_API_KEY / CONTACT_TO_EMAIL / CONTACT_FROM_EMAIL eksik");
    return { status: "error", message: t("error"), values: v };
  }

  const areaName = areas.find((a) => a.id === v.area)?.name.tr ?? "Diğer / emin değil";
  const when = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const rows: [string, string][] = [
    ["Ad Soyad", v.name],
    ["Telefon", v.phone],
    ["E-posta", v.email],
    ["Hukuk alanı", areaName],
    ["Dil", locale.toUpperCase()],
    ["Açık rıza", `Verildi (${when})`],
  ];

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: v.email,
      subject: `Randevu talebi — ${areaName} — ${v.name}`,
      text: `${rows.map(([k, val]) => `${k}: ${val}`).join("\n")}\n\nMesaj:\n${v.message}`,
      html: `<table style="font-family:sans-serif;font-size:14px">${rows
        .map(([k, val]) => `<tr><td style="padding:4px 12px 4px 0;color:#5b5f68">${esc(k)}</td><td>${esc(val)}</td></tr>`)
        .join("")}</table><p style="font-family:sans-serif;font-size:14px;white-space:pre-wrap">${esc(v.message)}</p>`,
    });
    if (error) throw error;
  } catch (e) {
    console.error("[contact] gönderim hatası", e);
    return { status: "error", message: t("error"), values: v };
  }
  return { status: "success", message: t("success") };
}
