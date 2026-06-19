import { useState } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  FormLayout,
  TextField,
  Checkbox,
  Button,
  Banner,
  Text,
  Divider,
  List,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import db from "../db.server";
import { resetTransporterCache, sendOrderNotificationEmail } from "../utils/mailer.server";
import { AVAILABLE_TEMPLATE_VARIABLES } from "../utils/template.server";
import {
  DEFAULT_BODY_TEMPLATE,
  DEFAULT_SUBJECT_TEMPLATE,
} from "../utils/defaultTemplate.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let settings = await db.settings.findUnique({ where: { shop } });

  if (!settings) {
    settings = await db.settings.create({
      data: {
        shop,
        subjectTemplate: DEFAULT_SUBJECT_TEMPLATE,
        bodyTemplateHtml: DEFAULT_BODY_TEMPLATE,
      },
    });
  }

  // Resolve fallbacks here (server-only) so the component never needs to
  // import the .server template module itself - it just reads plain
  // strings off the loader payload.
  const resolvedSettings = {
    ...settings,
    subjectTemplate: settings.subjectTemplate || DEFAULT_SUBJECT_TEMPLATE,
    bodyTemplateHtml: settings.bodyTemplateHtml || DEFAULT_BODY_TEMPLATE,
  };

  return json({ settings: resolvedSettings, variables: AVAILABLE_TEMPLATE_VARIABLES });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  const data = {
    recipientEmail: String(formData.get("recipientEmail") || "").trim(),
    matchTag: String(formData.get("matchTag") || "HyperLocal").trim(),
    matchShippingMethod: String(
      formData.get("matchShippingMethod") || "HyperLocal (Prepaid)",
    ).trim(),
    smtpHost: String(formData.get("smtpHost") || "").trim(),
    smtpPort: Number(formData.get("smtpPort") || 587),
    smtpSecure: formData.get("smtpSecure") === "true",
    smtpUser: String(formData.get("smtpUser") || "").trim(),
    smtpFrom: String(formData.get("smtpFrom") || "").trim(),
    subjectTemplate: String(formData.get("subjectTemplate") || DEFAULT_SUBJECT_TEMPLATE),
    bodyTemplateHtml: String(formData.get("bodyTemplateHtml") || DEFAULT_BODY_TEMPLATE),
  };

  // Only overwrite the stored password if the merchant actually typed a new
  // one - the field is always rendered blank for security, so an empty
  // submit should keep the existing secret rather than wiping it out.
  const newPassword = String(formData.get("smtpPass") || "");
  if (newPassword) {
    data.smtpPass = newPassword;
  }

  const settings = await db.settings.upsert({
    where: { shop },
    update: data,
    create: { shop, ...data },
  });

  resetTransporterCache();

  if (intent === "test") {
    try {
      await sendOrderNotificationEmail({
        shop,
        order: SAMPLE_ORDER,
        settings,
      });
      return json({ ok: true, message: `Settings saved. Test email sent to ${settings.recipientEmail}.` });
    } catch (error) {
      return json(
        { ok: false, message: `Settings saved, but the test email failed: ${error.message}` },
        { status: 400 },
      );
    }
  }

  return json({ ok: true, message: "Settings saved." });
};

export default function Settings() {
  const { settings, variables } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSaving = navigation.state === "submitting";

  const [form, setForm] = useState({
    recipientEmail: settings.recipientEmail || "",
    matchTag: settings.matchTag || "HyperLocal",
    matchShippingMethod: settings.matchShippingMethod || "HyperLocal (Prepaid)",
    smtpHost: settings.smtpHost || "",
    smtpPort: String(settings.smtpPort || 587),
    smtpSecure: settings.smtpSecure || false,
    smtpUser: settings.smtpUser || "",
    smtpPass: "",
    smtpFrom: settings.smtpFrom || "",
    subjectTemplate: settings.subjectTemplate,
    bodyTemplateHtml: settings.bodyTemplateHtml,
  });

  const update = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  // Building FormData explicitly (rather than a native <Form>) keeps this
  // robust regardless of how Polaris's controlled inputs render under the
  // hood, and lets one "intent" cleanly drive two different buttons.
  const handleSubmit = (intent) => {
    const formData = new FormData();
    formData.set("intent", intent);
    Object.entries(form).forEach(([key, value]) => {
      formData.set(key, typeof value === "boolean" ? (value ? "true" : "false") : String(value));
    });
    submit(formData, { method: "post" });
  };

  return (
    <Page title="Settings" backAction={{ url: "/app" }}>
      <BlockStack gap="400">
        {actionData?.message && (
          <Banner tone={actionData.ok ? "success" : "critical"}>
            {actionData.message}
          </Banner>
        )}

        <BlockStack gap="400">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Recipient & matching rule
              </Text>
              <FormLayout>
                <TextField
                  label="Send notification email to"
                  type="email"
                  autoComplete="off"
                  value={form.recipientEmail}
                  onChange={update("recipientEmail")}
                  helpText="You can change this any time - it takes effect on the very next order."
                  requiredIndicator
                />
                <FormLayout.Group>
                  <TextField
                    label="Required order tag"
                    autoComplete="off"
                    value={form.matchTag}
                    onChange={update("matchTag")}
                  />
                  <TextField
                    label="Required delivery method"
                    autoComplete="off"
                    value={form.matchShippingMethod}
                    onChange={update("matchShippingMethod")}
                    helpText="Matches the shipping method title or code, e.g. HyperLocal (Prepaid)"
                  />
                </FormLayout.Group>
              </FormLayout>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                SMTP (how the mail is sent)
              </Text>
              <FormLayout>
                <FormLayout.Group>
                  <TextField
                    label="SMTP host"
                    autoComplete="off"
                    placeholder="smtp.gmail.com"
                    value={form.smtpHost}
                    onChange={update("smtpHost")}
                  />
                  <TextField
                    label="Port"
                    type="number"
                    autoComplete="off"
                    value={form.smtpPort}
                    onChange={update("smtpPort")}
                  />
                </FormLayout.Group>
                <FormLayout.Group>
                  <TextField
                    label="SMTP username"
                    autoComplete="off"
                    value={form.smtpUser}
                    onChange={update("smtpUser")}
                  />
                  <TextField
                    label="SMTP password"
                    type="password"
                    autoComplete="off"
                    value={form.smtpPass}
                    onChange={update("smtpPass")}
                    placeholder={settings.smtpHost ? "•••••••• (unchanged)" : ""}
                    helpText="Leave blank to keep the currently saved password."
                  />
                </FormLayout.Group>
                <TextField
                  label="From address"
                  autoComplete="off"
                  placeholder="orders@yourstore.com"
                  value={form.smtpFrom}
                  onChange={update("smtpFrom")}
                  helpText="Defaults to the SMTP username if left blank."
                />
                <Checkbox
                  label="Use SSL (port 465)"
                  checked={form.smtpSecure}
                  onChange={update("smtpSecure")}
                />
              </FormLayout>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Email template
              </Text>
              <FormLayout>
                <TextField
                  label="Subject"
                  autoComplete="off"
                  value={form.subjectTemplate}
                  onChange={update("subjectTemplate")}
                />
                <TextField
                  label="Body (HTML)"
                  autoComplete="off"
                  value={form.bodyTemplateHtml}
                  onChange={update("bodyTemplateHtml")}
                  multiline={14}
                  monospaced
                />
              </FormLayout>
              <Divider />
              <Text as="h3" variant="headingSm">
                Available placeholders
              </Text>
              <List type="bullet">
                {variables.map((v) => (
                  <List.Item key={v.key}>
                    <code>{`{{${v.key}}}`}</code> — {v.description}
                  </List.Item>
                ))}
              </List>
            </BlockStack>
          </Card>

          <InlineStack gap="200">
            <Button variant="primary" loading={isSaving} onClick={() => handleSubmit("save")}>
              Save settings
            </Button>
            <Button loading={isSaving} onClick={() => handleSubmit("test")}>
              Save & send test email
            </Button>
          </InlineStack>
        </BlockStack>
      </BlockStack>
    </Page>
  );
}

// Used only for the "send test email" button so a merchant can preview the
// template without needing to place a real order.
const SAMPLE_ORDER = {
  id: 0,
  order_number: 1042,
  name: "#1042",
  email: "customer@example.com",
  phone: "+91 98765 43210",
  total_price: "1499.00",
  currency: "INR",
  tags: "HyperLocal, Test",
  created_at: new Date().toISOString(),
  order_status_url: "https://example.com/orders/test",
  customer: { first_name: "Test", last_name: "Customer", email: "customer@example.com" },
  shipping_address: {
    name: "Test Customer",
    address1: "123 Sample Street",
    address2: "",
    city: "Delhi",
    province: "Delhi",
    zip: "110001",
    country: "India",
  },
  shipping_lines: [{ title: "HyperLocal (Prepaid)", code: "HyperLocal (Prepaid)" }],
  line_items: [
    { name: "Sample Product A", quantity: 2, price: "499.00" },
    { name: "Sample Product B", quantity: 1, price: "501.00" },
  ],
};
