import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { HallTicketCustomization, HallTicketBorderStyle, HallTicketHeaderLayout } from "@/components/print/hall-ticket";

// Every print call site (student self-print, student group print, admin
// print-on-behalf single and bulk) needs the same org-level customization
// row plus freshly signed signature URLs — centralized here so a future
// customization field only needs updating once.
export async function getHallTicketCustomization(
  service: ReturnType<typeof createAdminClient>,
  organizationId: string,
): Promise<HallTicketCustomization | null> {
  const { data: org } = await service
    .from("organizations")
    .select(
      "address, hall_ticket_header_text, hall_ticket_footer_note, hall_ticket_letter, hall_ticket_show_address, hall_ticket_primary_color, hall_ticket_font, hall_ticket_border_style, hall_ticket_header_layout, hall_ticket_logo_size, hall_ticket_header_bg_color, hall_ticket_header_bg_gradient_to, hall_ticket_org_name_color, hall_ticket_signature1_url, hall_ticket_signature1_label, hall_ticket_signature2_url, hall_ticket_signature2_label",
    )
    .eq("id", organizationId)
    .maybeSingle();
  if (!org) return null;

  const signedUrl = async (path: string | null) => {
    if (!path) return null;
    const { data } = await service.storage.from("hall-ticket-signatures").createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  };

  const [sig1Url, sig2Url] = await Promise.all([
    signedUrl(org.hall_ticket_signature1_url),
    signedUrl(org.hall_ticket_signature2_url),
  ]);

  const signatures = [
    { url: sig1Url, label: org.hall_ticket_signature1_label ?? "" },
    { url: sig2Url, label: org.hall_ticket_signature2_label ?? "" },
  ].filter((s) => s.url || s.label);

  return {
    headerText: org.hall_ticket_header_text,
    footerNote: org.hall_ticket_footer_note,
    letterText: org.hall_ticket_letter,
    showAddress: org.hall_ticket_show_address,
    address: org.address,
    primaryColor: org.hall_ticket_primary_color,
    font: org.hall_ticket_font,
    borderStyle: org.hall_ticket_border_style as HallTicketBorderStyle | null,
    headerLayout: org.hall_ticket_header_layout as HallTicketHeaderLayout | null,
    logoSize: org.hall_ticket_logo_size,
    headerBgColor: org.hall_ticket_header_bg_color,
    headerBgGradientTo: org.hall_ticket_header_bg_gradient_to,
    orgNameColor: org.hall_ticket_org_name_color,
    signatures,
  };
}
