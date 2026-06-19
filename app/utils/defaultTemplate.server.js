export const DEFAULT_SUBJECT_TEMPLATE = "New HyperLocal order #{{order_number}}";

export const DEFAULT_BODY_TEMPLATE = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <h2 style="color:#0b6e4f;margin-bottom:4px;">HyperLocal (Prepaid) order received</h2>
  <p style="margin-top:0;color:#555;">Order {{order_name}} just came in and matched the HyperLocal delivery rule.</p>

  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr>
      <td style="padding:4px 0;color:#666;">Order</td>
      <td style="padding:4px 0;font-weight:bold;">{{order_name}}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;color:#666;">Customer</td>
      <td style="padding:4px 0;">{{customer_name}} ({{customer_email}})</td>
    </tr>
    <tr>
      <td style="padding:4px 0;color:#666;">Delivery method</td>
      <td style="padding:4px 0;">{{delivery_method}}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;color:#666;">Tags</td>
      <td style="padding:4px 0;">{{tags}}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;color:#666;">Total</td>
      <td style="padding:4px 0;font-weight:bold;">{{total_price}} {{currency}}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;color:#666;vertical-align:top;">Shipping address</td>
      <td style="padding:4px 0;">{{shipping_name}}<br/>{{shipping_address_full}}</td>
    </tr>
  </table>

  <h3 style="margin-bottom:4px;">Items</h3>
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th align="left" style="padding:4px 8px;border:1px solid #ddd;background:#f5f5f5;">Item</th>
        <th align="center" style="padding:4px 8px;border:1px solid #ddd;background:#f5f5f5;">Qty</th>
        <th align="right" style="padding:4px 8px;border:1px solid #ddd;background:#f5f5f5;">Price</th>
      </tr>
    </thead>
    <tbody>
      {{line_items_html}}
    </tbody>
  </table>

  <p style="margin-top:24px;">
    <a href="{{order_status_url}}" style="background:#0b6e4f;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none;">View order status</a>
  </p>

  <p style="color:#999;font-size:12px;margin-top:32px;">Sent automatically by the HyperLocal Mailer app for {{shop}}.</p>
</div>`;
