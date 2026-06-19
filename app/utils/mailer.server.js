import nodemailer from "nodemailer";
import { renderTemplate } from "./template.server";
import {
  DEFAULT_SUBJECT_TEMPLATE,
  DEFAULT_BODY_TEMPLATE,
} from "./defaultTemplate.server";

// Transporters are cheap to recreate, but caching one per shop avoids
// reconnecting to the SMTP server on every single order.
const transporterCache = new Map();

function getTransporter(settings) {
  const cacheKey = `${settings.smtpHost}:${settings.smtpPort}:${settings.smtpUser}`;

  if (transporterCache.has(cacheKey)) {
    return transporterCache.get(cacheKey);
  }

  const port = Number(settings.smtpPort) || 587;
  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port,
    secure: settings.smtpSecure ?? port === 465,
    auth: settings.smtpUser
      ? { user: settings.smtpUser, pass: settings.smtpPass }
      : undefined,
  });

  transporterCache.set(cacheKey, transporter);
  return transporter;
}

/** Clears the cached transporter, e.g. after SMTP settings are changed. */
export function resetTransporterCache() {
  transporterCache.clear();
}

export function buildTemplateContext({ shop, order }) {
  const shippingAddress = order.shipping_address || {};
  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];

  const lineItemsHtml = lineItems
    .map(
      (item) => `<tr>
        <td style="padding:4px 8px;border:1px solid #ddd;">${escapeHtml(item.name || item.title)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:center;">${escapeHtml(item.quantity)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right;">${escapeHtml(item.price)}</td>
      </tr>`,
    )
    .join("");

  const deliveryMethod = (order.shipping_lines || [])
    .map((line) => line.title)
    .filter(Boolean)
    .join(", ");

  return {
    shop,
    order_id: order.id,
    order_number: order.order_number ?? order.name,
    order_name: order.name,
    order_status_url: order.order_status_url || "",
    customer_name:
      [order.customer?.first_name, order.customer?.last_name]
        .filter(Boolean)
        .join(" ") || "Guest",
    customer_email: order.email || order.customer?.email || "",
    customer_phone: order.phone || order.customer?.phone || "",
    total_price: order.total_price,
    currency: order.currency,
    tags: order.tags || "",
    delivery_method: deliveryMethod,
    shipping_address_full: formatAddress(shippingAddress),
    shipping_name: shippingAddress.name || "",
    shipping_address1: shippingAddress.address1 || "",
    shipping_address2: shippingAddress.address2 || "",
    shipping_city: shippingAddress.city || "",
    shipping_zip: shippingAddress.zip || "",
    shipping_province: shippingAddress.province || "",
    shipping_country: shippingAddress.country || "",
    line_items_html: lineItemsHtml,
    line_items_count: lineItems.length,
    created_at: order.created_at,
  };
}

/**
 * Renders the merchant's subject/body templates against the order and
 * sends the email over SMTP. Throws on failure so the caller (the webhook
 * route) can decide how to log it / whether to ask Shopify to retry.
 */
export async function sendOrderNotificationEmail({ shop, order, settings }) {
  if (!settings.smtpHost || !settings.smtpUser) {
    throw new Error(
      "SMTP is not configured yet - set it on the app's Settings page.",
    );
  }
  if (!settings.recipientEmail) {
    throw new Error("No recipient email configured on the Settings page.");
  }

  const transporter = getTransporter(settings);
  const context = buildTemplateContext({ shop, order });

  const subject = renderTemplate(
    settings.subjectTemplate || DEFAULT_SUBJECT_TEMPLATE,
    context,
  );
  const html = renderTemplate(
    settings.bodyTemplateHtml || DEFAULT_BODY_TEMPLATE,
    context,
  );

  await transporter.sendMail({
    from: settings.smtpFrom || settings.smtpUser,
    to: settings.recipientEmail,
    subject,
    html,
  });
}

function formatAddress(address) {
  return [
    address.address1,
    address.address2,
    address.city,
    address.province,
    address.zip,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
