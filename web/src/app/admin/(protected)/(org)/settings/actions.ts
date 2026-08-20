"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAdmin } from "@/lib/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";

const LOGO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export type UploadLogoResult = { ok: true; signedUrl: string } | { ok: false; error: string };

export async function uploadOrgLogo(formData: FormData): Promise<UploadLogoResult> {
  const admin = await requireOrgAdmin();

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file selected." };
  }
  const ext = LOGO_EXTENSIONS[file.type];
  if (!ext) {
    return { ok: false, error: "Only JPEG, PNG, WebP, or SVG images are allowed." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: "Image must be under 2MB." };
  }

  const service = createAdminClient();

  // One logo file per org — upsert overwrites whatever extension was there
  // before, but a prior upload under a *different* extension would
  // otherwise linger as an orphaned object, so clear any existing one
  // first rather than just overwriting the new path.
  const { data: existing } = await service
    .from("organizations")
    .select("logo_url")
    .eq("id", admin.organizationId)
    .maybeSingle();
  if (existing?.logo_url && existing.logo_url !== `${admin.organizationId}/logo.${ext}`) {
    await service.storage.from("org-logos").remove([existing.logo_url]);
  }

  const path = `${admin.organizationId}/logo.${ext}`;
  const { error: uploadError } = await service.storage
    .from("org-logos")
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { error: updateError } = await service
    .from("organizations")
    .update({ logo_url: path })
    .eq("id", admin.organizationId);
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const { data: signed, error: signError } = await service.storage
    .from("org-logos")
    .createSignedUrl(path, 300);
  if (signError || !signed) {
    return { ok: false, error: signError?.message ?? "Uploaded, but couldn't preview it." };
  }

  revalidatePath("/admin", "layout");

  return { ok: true, signedUrl: signed.signedUrl };
}

export async function removeOrgLogo(): Promise<{ error?: string }> {
  const admin = await requireOrgAdmin();
  const service = createAdminClient();

  const { data: existing } = await service
    .from("organizations")
    .select("logo_url")
    .eq("id", admin.organizationId)
    .maybeSingle();

  if (existing?.logo_url) {
    await service.storage.from("org-logos").remove([existing.logo_url]);
  }

  const { error } = await service.from("organizations").update({ logo_url: null }).eq("id", admin.organizationId);
  if (error) return { error: error.message };

  revalidatePath("/admin", "layout");
  return {};
}

export type OrgDetailsResult = { error?: string };

export async function saveOrgDetails(formData: FormData): Promise<OrgDetailsResult> {
  const admin = await requireOrgAdmin();

  const address = String(formData.get("address") ?? "").trim();
  const contactNumber = String(formData.get("contactNumber") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();

  const service = createAdminClient();
  const { error } = await service
    .from("organizations")
    .update({
      address: address || null,
      contact_number: contactNumber || null,
      contact_email: contactEmail || null,
    })
    .eq("id", admin.organizationId);
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return {};
}

const SIGNATURE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_SIGNATURE_BYTES = 1 * 1024 * 1024;

async function uploadSignature(
  service: ReturnType<typeof createAdminClient>,
  organizationId: string,
  slot: 1 | 2,
  file: File,
  previousPath: string | null,
): Promise<{ path: string } | { error: string }> {
  const ext = SIGNATURE_EXTENSIONS[file.type];
  if (!ext) {
    return { error: "Signatures must be JPEG, PNG, or WebP images." };
  }
  if (file.size > MAX_SIGNATURE_BYTES) {
    return { error: "Signature image must be under 1MB." };
  }

  const path = `${organizationId}/signature${slot}.${ext}`;
  if (previousPath && previousPath !== path) {
    await service.storage.from("hall-ticket-signatures").remove([previousPath]);
  }
  const { error } = await service.storage
    .from("hall-ticket-signatures")
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
  if (error) return { error: error.message };

  return { path };
}

export type HallTicketCustomizationResult =
  | { ok: false; error: string }
  | { ok: true; signature1Url: string | null; signature2Url: string | null };

// One combined save for every customization field — the settings page's
// live preview is pure client state until this runs, so nothing here needs
// its own separate persistence step; a signature file only reaches Storage
// once the admin actually hits Save, same as the text/color/font fields.
export async function saveHallTicketCustomization(formData: FormData): Promise<HallTicketCustomizationResult> {
  const admin = await requireOrgAdmin();
  const service = createAdminClient();

  const { data: org } = await service
    .from("organizations")
    .select("type, hall_ticket_signature1_url, hall_ticket_signature2_url")
    .eq("id", admin.organizationId)
    .maybeSingle();
  if (org?.type !== "SCHOOL") {
    return { ok: false, error: "Hall ticket customization is only available for school organizations." };
  }

  const headerText = String(formData.get("headerText") ?? "").trim();
  const footerNote = String(formData.get("footerNote") ?? "").trim();
  const letterText = String(formData.get("letterText") ?? "").trim();
  const showAddress = formData.get("showAddress") === "true";
  const primaryColor = String(formData.get("primaryColor") ?? "").trim();
  const font = String(formData.get("font") ?? "").trim();
  const borderStyle = String(formData.get("borderStyle") ?? "").trim();
  const headerLayout = String(formData.get("headerLayout") ?? "").trim();
  const logoSizeRaw = String(formData.get("logoSize") ?? "").trim();
  const headerBgColor = String(formData.get("headerBgColor") ?? "").trim();
  const headerBgGradientTo = String(formData.get("headerBgGradientTo") ?? "").trim();
  const orgNameColor = String(formData.get("orgNameColor") ?? "").trim();
  const signature1Label = String(formData.get("signature1Label") ?? "").trim();
  const signature2Label = String(formData.get("signature2Label") ?? "").trim();

  if (primaryColor && !/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
    return { ok: false, error: "Primary color must be a valid hex color (e.g. #1a3c6e)." };
  }
  if (borderStyle && !["solid", "double", "dashed", "none"].includes(borderStyle)) {
    return { ok: false, error: "Invalid border style." };
  }
  if (headerLayout && !["centered", "left"].includes(headerLayout)) {
    return { ok: false, error: "Invalid header layout." };
  }
  if (headerBgColor && !/^#[0-9a-fA-F]{6}$/.test(headerBgColor)) {
    return { ok: false, error: "Header background color must be a valid hex color." };
  }
  if (headerBgGradientTo && !/^#[0-9a-fA-F]{6}$/.test(headerBgGradientTo)) {
    return { ok: false, error: "Gradient end color must be a valid hex color." };
  }
  if (orgNameColor && !/^#[0-9a-fA-F]{6}$/.test(orgNameColor)) {
    return { ok: false, error: "Organization name color must be a valid hex color." };
  }

  let logoSize: number | null = null;
  if (logoSizeRaw) {
    const parsed = Number(logoSizeRaw);
    if (!Number.isFinite(parsed) || parsed < 24 || parsed > 96) {
      return { ok: false, error: "Logo size must be between 24 and 96 pixels." };
    }
    logoSize = Math.round(parsed);
  }

  const update: Record<string, string | boolean | number | null> = {
    hall_ticket_header_text: headerText || null,
    hall_ticket_footer_note: footerNote || null,
    hall_ticket_letter: letterText || null,
    hall_ticket_show_address: showAddress,
    hall_ticket_primary_color: primaryColor || null,
    hall_ticket_font: font || null,
    hall_ticket_border_style: borderStyle || null,
    hall_ticket_header_layout: headerLayout || null,
    hall_ticket_logo_size: logoSize,
    hall_ticket_header_bg_color: headerBgColor || null,
    // A gradient without a base color is meaningless — only persist the
    // end color when there's actually a start color to gradient from.
    hall_ticket_header_bg_gradient_to: headerBgColor ? headerBgGradientTo || null : null,
    hall_ticket_org_name_color: orgNameColor || null,
    hall_ticket_signature1_label: signature1Label || null,
    hall_ticket_signature2_label: signature2Label || null,
  };

  let signature1Path = org.hall_ticket_signature1_url;
  let signature2Path = org.hall_ticket_signature2_url;

  if (formData.get("removeSignature1") === "true") {
    if (signature1Path) await service.storage.from("hall-ticket-signatures").remove([signature1Path]);
    signature1Path = null;
    update.hall_ticket_signature1_url = null;
  } else {
    const file1 = formData.get("signature1");
    if (file1 instanceof File && file1.size > 0) {
      const result = await uploadSignature(service, admin.organizationId, 1, file1, signature1Path);
      if ("error" in result) return { ok: false, error: result.error };
      signature1Path = result.path;
      update.hall_ticket_signature1_url = signature1Path;
    }
  }

  if (formData.get("removeSignature2") === "true") {
    if (signature2Path) await service.storage.from("hall-ticket-signatures").remove([signature2Path]);
    signature2Path = null;
    update.hall_ticket_signature2_url = null;
  } else {
    const file2 = formData.get("signature2");
    if (file2 instanceof File && file2.size > 0) {
      const result = await uploadSignature(service, admin.organizationId, 2, file2, signature2Path);
      if ("error" in result) return { ok: false, error: result.error };
      signature2Path = result.path;
      update.hall_ticket_signature2_url = signature2Path;
    }
  }

  const { error } = await service.from("organizations").update(update).eq("id", admin.organizationId);
  if (error) return { ok: false, error: error.message };

  const signedUrl = async (path: string | null) => {
    if (!path) return null;
    const { data } = await service.storage.from("hall-ticket-signatures").createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  };
  const [signature1Url, signature2Url] = await Promise.all([signedUrl(signature1Path), signedUrl(signature2Path)]);

  revalidatePath("/admin/settings");
  revalidatePath("/student", "layout");

  return { ok: true, signature1Url, signature2Url };
}

// A saved template captures the *design* — text and style, not the
// specific signature image files, which stay whatever the org currently
// has uploaded regardless of which template is active. Signatures are
// tied to real uploaded assets rather than being part of a reusable style,
// so applying a template never touches hall_ticket_signature*.
export type HallTicketTemplateRow = {
  id: string;
  name: string;
  isDefault: boolean;
  headerText: string | null;
  footerNote: string | null;
  letterText: string | null;
  showAddress: boolean;
  primaryColor: string | null;
  font: string | null;
  borderStyle: string | null;
  headerLayout: string | null;
  logoSize: number | null;
  headerBgColor: string | null;
  headerBgGradientTo: string | null;
  orgNameColor: string | null;
};

const TEMPLATE_COLUMNS =
  "id, name, is_default, header_text, footer_note, letter, show_address, primary_color, font, border_style, header_layout, logo_size, header_bg_color, header_bg_gradient_to, org_name_color";

function toTemplateRow(t: {
  id: string;
  name: string;
  is_default: boolean;
  header_text: string | null;
  footer_note: string | null;
  letter: string | null;
  show_address: boolean;
  primary_color: string | null;
  font: string | null;
  border_style: string | null;
  header_layout: string | null;
  logo_size: number | null;
  header_bg_color: string | null;
  header_bg_gradient_to: string | null;
  org_name_color: string | null;
}): HallTicketTemplateRow {
  return {
    id: t.id,
    name: t.name,
    isDefault: t.is_default,
    headerText: t.header_text,
    footerNote: t.footer_note,
    letterText: t.letter,
    showAddress: t.show_address,
    primaryColor: t.primary_color,
    font: t.font,
    borderStyle: t.border_style,
    headerLayout: t.header_layout,
    logoSize: t.logo_size,
    headerBgColor: t.header_bg_color,
    headerBgGradientTo: t.header_bg_gradient_to,
    orgNameColor: t.org_name_color,
  };
}

export async function listHallTicketTemplates(): Promise<HallTicketTemplateRow[]> {
  const admin = await requireOrgAdmin();
  const service = createAdminClient();
  const { data } = await service
    .from("hall_ticket_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("organization_id", admin.organizationId)
    .order("created_at", { ascending: true });
  return (data ?? []).map(toTemplateRow);
}

export type SaveHallTicketTemplateResult = { ok: false; error: string } | { ok: true; template: HallTicketTemplateRow };

// Saves whatever the editor currently holds — the same fields
// saveHallTicketCustomization persists to the org row — as a new named,
// reusable row, independent of whether the admin has clicked Save on the
// live configuration yet. Nothing here touches the active hall ticket.
export async function saveHallTicketTemplate(formData: FormData): Promise<SaveHallTicketTemplateResult> {
  const admin = await requireOrgAdmin();
  const service = createAdminClient();

  const { data: org } = await service.from("organizations").select("type").eq("id", admin.organizationId).maybeSingle();
  if (org?.type !== "SCHOOL") {
    return { ok: false, error: "Hall ticket templates are only available for school organizations." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Template name is required." };

  const headerText = String(formData.get("headerText") ?? "").trim();
  const footerNote = String(formData.get("footerNote") ?? "").trim();
  const letterText = String(formData.get("letterText") ?? "").trim();
  const showAddress = formData.get("showAddress") === "true";
  const primaryColor = String(formData.get("primaryColor") ?? "").trim();
  const font = String(formData.get("font") ?? "").trim();
  const borderStyle = String(formData.get("borderStyle") ?? "").trim();
  const headerLayout = String(formData.get("headerLayout") ?? "").trim();
  const logoSizeRaw = String(formData.get("logoSize") ?? "").trim();
  const headerBgColor = String(formData.get("headerBgColor") ?? "").trim();
  const headerBgGradientTo = String(formData.get("headerBgGradientTo") ?? "").trim();
  const orgNameColor = String(formData.get("orgNameColor") ?? "").trim();

  for (const [label, value] of [
    ["Primary color", primaryColor],
    ["Header background color", headerBgColor],
    ["Gradient end color", headerBgGradientTo],
    ["Organization name color", orgNameColor],
  ]) {
    if (value && !/^#[0-9a-fA-F]{6}$/.test(value)) {
      return { ok: false, error: `${label} must be a valid hex color.` };
    }
  }
  if (borderStyle && !["solid", "double", "dashed", "none"].includes(borderStyle)) {
    return { ok: false, error: "Invalid border style." };
  }
  if (headerLayout && !["centered", "left"].includes(headerLayout)) {
    return { ok: false, error: "Invalid header layout." };
  }

  let logoSize: number | null = null;
  if (logoSizeRaw) {
    const parsed = Number(logoSizeRaw);
    if (!Number.isFinite(parsed) || parsed < 24 || parsed > 96) {
      return { ok: false, error: "Logo size must be between 24 and 96 pixels." };
    }
    logoSize = Math.round(parsed);
  }

  const { data: inserted, error } = await service
    .from("hall_ticket_templates")
    .insert({
      organization_id: admin.organizationId,
      name,
      header_text: headerText || null,
      footer_note: footerNote || null,
      letter: letterText || null,
      show_address: showAddress,
      primary_color: primaryColor || null,
      font: font || null,
      border_style: borderStyle || null,
      header_layout: headerLayout || null,
      logo_size: logoSize,
      header_bg_color: headerBgColor || null,
      header_bg_gradient_to: headerBgColor ? headerBgGradientTo || null : null,
      org_name_color: orgNameColor || null,
    })
    .select(TEMPLATE_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "You already have a template with that name." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/settings");
  return { ok: true, template: toTemplateRow(inserted) };
}

// "Set as default" — copies a saved template straight onto the live
// configuration every print call site actually reads from, and marks it as
// the org's current default so the settings page can show which saved
// template is the one in effect. This is deliberately immediate (unlike
// the editor's Save button) since it's the whole point of the action:
// swap the active design to a known-good saved one in one click.
export async function applyHallTicketTemplate(templateId: string): Promise<{ error?: string }> {
  const admin = await requireOrgAdmin();
  const service = createAdminClient();

  const { data: template } = await service
    .from("hall_ticket_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("id", templateId)
    .eq("organization_id", admin.organizationId)
    .maybeSingle();
  if (!template) return { error: "Template not found." };

  const { error: updateOrgError } = await service
    .from("organizations")
    .update({
      hall_ticket_header_text: template.header_text,
      hall_ticket_footer_note: template.footer_note,
      hall_ticket_letter: template.letter,
      hall_ticket_show_address: template.show_address,
      hall_ticket_primary_color: template.primary_color,
      hall_ticket_font: template.font,
      hall_ticket_border_style: template.border_style,
      hall_ticket_header_layout: template.header_layout,
      hall_ticket_logo_size: template.logo_size,
      hall_ticket_header_bg_color: template.header_bg_color,
      hall_ticket_header_bg_gradient_to: template.header_bg_gradient_to,
      hall_ticket_org_name_color: template.org_name_color,
    })
    .eq("id", admin.organizationId);
  if (updateOrgError) return { error: updateOrgError.message };

  // Only one template can be "the" default at a time — clear any earlier
  // one first so the badge in the UI always matches what's actually live.
  await service
    .from("hall_ticket_templates")
    .update({ is_default: false })
    .eq("organization_id", admin.organizationId)
    .neq("id", templateId);
  const { error: markError } = await service
    .from("hall_ticket_templates")
    .update({ is_default: true })
    .eq("id", templateId);
  if (markError) return { error: markError.message };

  revalidatePath("/admin/settings");
  revalidatePath("/student", "layout");

  return {};
}

export async function deleteHallTicketTemplate(templateId: string): Promise<{ error?: string }> {
  const admin = await requireOrgAdmin();
  const service = createAdminClient();

  const { error } = await service
    .from("hall_ticket_templates")
    .delete()
    .eq("id", templateId)
    .eq("organization_id", admin.organizationId);
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return {};
}
