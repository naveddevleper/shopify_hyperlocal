/**
 * Decides whether an incoming order should trigger the HyperLocal mail.
 *
 * Matches when BOTH are true:
 *   1. The order has a tag equal to settings.matchTag (default "HyperLocal")
 *   2. One of the order's shipping lines (the delivery method the customer
 *      picked at checkout) has a title OR code equal to
 *      settings.matchShippingMethod (default "HyperLocal (Prepaid)")
 *
 * Both comparisons are case-insensitive and whitespace-trimmed so small
 * differences in capitalization in Shopify don't silently break things.
 */
export function matchesHyperLocalCondition(order, settings) {
  const targetTag = normalize(settings?.matchTag || "HyperLocal");
  const targetMethod = normalize(
    settings?.matchShippingMethod || "HyperLocal (Prepaid)",
  );

  const tags = String(order?.tags || "")
    .split(",")
    .map(normalize)
    .filter(Boolean);

  const hasTag = tags.includes(targetTag);

  const shippingLines = Array.isArray(order?.shipping_lines)
    ? order.shipping_lines
    : [];

  const hasDeliveryMethod = shippingLines.some((line) => {
    const title = normalize(line?.title);
    const code = normalize(line?.code);
    return title === targetMethod || code === targetMethod;
  });

  return hasTag && hasDeliveryMethod;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}
