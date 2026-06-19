/**
 * Replaces {{variable}} placeholders in a template string with values from
 * the context object. Unknown placeholders are replaced with an empty
 * string rather than left in place, so a typo never leaks "{{oops}}" into
 * a merchant's inbox.
 */
export function renderTemplate(template, context) {
  if (!template) return "";
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key) => {
    const value = context[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

/** All placeholders available to merchants, shown on the Settings page. */
export const AVAILABLE_TEMPLATE_VARIABLES = [
  { key: "order_number", description: "Order number, e.g. 1042" },
  { key: "order_name", description: "Order name, e.g. #1042" },
  { key: "order_status_url", description: "Link to the order status page" },
  { key: "customer_name", description: "Customer full name" },
  { key: "customer_email", description: "Customer email" },
  { key: "customer_phone", description: "Customer phone number" },
  { key: "total_price", description: "Order total" },
  { key: "currency", description: "Order currency code" },
  { key: "tags", description: "Order tags, comma separated" },
  { key: "delivery_method", description: "Selected shipping/delivery method" },
  { key: "shipping_address_full", description: "Full shipping address, one line" },
  { key: "shipping_name", description: "Name on the shipping address" },
  { key: "shipping_address1", description: "Shipping address line 1" },
  { key: "shipping_address2", description: "Shipping address line 2" },
  { key: "shipping_city", description: "Shipping city" },
  { key: "shipping_zip", description: "Shipping postal/zip code" },
  { key: "shipping_province", description: "Shipping state/province" },
  { key: "shipping_country", description: "Shipping country" },
  { key: "line_items_html", description: "Pre-built HTML table rows of ordered items" },
  { key: "line_items_count", description: "Number of distinct line items" },
  { key: "created_at", description: "Order creation timestamp" },
  { key: "shop", description: "The shop's myshopify.com domain" },
];
