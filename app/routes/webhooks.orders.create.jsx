import db from "../db.server";
import { authenticate } from "../shopify.server";
import { matchesHyperLocalCondition } from "../utils/orderMatch.server";
import { sendOrderNotificationEmail } from "../utils/mailer.server";

/**
 * Shopify calls this URL the instant an order is created - this is what
 * makes the mail "immediate" rather than on a polling/cron schedule.
 *
 * authenticate.webhook() verifies the HMAC signature (so random POSTs to
 * this URL from the internet are rejected) and gives us the parsed order
 * payload directly - no extra Admin API call needed for the fields we use.
 */
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[webhook] ${topic} for ${shop} - order ${payload?.id}`);

  const order = payload;

  try {
    const settings = await db.settings.findUnique({ where: { shop } });

    if (!settings) {
      console.log(`[webhook] no settings row for ${shop} yet - skipping`);
      return new Response();
    }

    if (!matchesHyperLocalCondition(order, settings)) {
      // Most orders will land here - not a HyperLocal (Prepaid) order, or
      // missing the HyperLocal tag. Nothing to do.
      return new Response();
    }

    if (!settings.recipientEmail || !settings.smtpHost) {
      await db.mailLog.create({
        data: {
          shop,
          orderId: String(order.id),
          orderNumber: String(order.order_number ?? order.name ?? ""),
          recipientEmail: settings.recipientEmail || "(not set)",
          status: "SKIPPED",
          error: "Recipient email or SMTP settings not configured yet.",
        },
      });
      return new Response();
    }

    await sendOrderNotificationEmail({ shop, order, settings });

    await db.mailLog.create({
      data: {
        shop,
        orderId: String(order.id),
        orderNumber: String(order.order_number ?? order.name ?? ""),
        recipientEmail: settings.recipientEmail,
        status: "SENT",
      },
    });

    console.log(`[webhook] mail sent for order ${order.id} (${shop})`);
  } catch (error) {
    console.error(`[webhook] failed to process order ${order?.id}:`, error);

    try {
      await db.mailLog.create({
        data: {
          shop,
          orderId: String(order?.id ?? "unknown"),
          orderNumber: String(order?.order_number ?? order?.name ?? ""),
          recipientEmail: "(unknown)",
          status: "FAILED",
          error: String(error?.message || error),
        },
      });
    } catch (logError) {
      console.error("[webhook] also failed to write MailLog:", logError);
    }

    // Return 500 so Shopify retries the webhook (e.g. if the SMTP server
    // was briefly down). Shopify retries with backoff for up to 48 hours.
    return new Response("Error processing order webhook", { status: 500 });
  }

  return new Response();
};
