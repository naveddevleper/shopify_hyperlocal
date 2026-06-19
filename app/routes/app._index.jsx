import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Banner,
  DataTable,
  Button,
  InlineStack,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const settings = await db.settings.findUnique({ where: { shop } });
  const recentMail = await db.mailLog.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const isConfigured = Boolean(
    settings?.recipientEmail && settings?.smtpHost && settings?.smtpUser,
  );

  return json({ isConfigured, settings, recentMail });
};

export default function Index() {
  const { isConfigured, settings, recentMail } = useLoaderData();

  const rows = recentMail.map((row) => [
    row.orderNumber,
    row.recipientEmail,
    statusBadge(row.status),
    new Date(row.createdAt).toLocaleString(),
    row.error || "",
  ]);

  return (
    <Page title="HyperLocal Mailer">
      <BlockStack gap="400">
        {!isConfigured && (
          <Banner title="Setup needed" tone="warning">
            <p>
              Add a recipient email and SMTP details on the Settings page
              before this app can send any mail.
            </p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">
                How this works
              </Text>
              <Button url="/app/settings" variant="primary">
                Open settings
              </Button>
            </InlineStack>
            <Text as="p" tone="subdued">
              Every time an order is created, Shopify calls this app's
              webhook instantly. If the order is tagged "
              {settings?.matchTag || "HyperLocal"}" and its delivery method
              is "{settings?.matchShippingMethod || "HyperLocal (Prepaid)"}",
              an email is sent immediately to{" "}
              <strong>{settings?.recipientEmail || "(no recipient set)"}</strong>{" "}
              using the template configured on the Settings page.
            </Text>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Recent activity
            </Text>
            {rows.length === 0 ? (
              <Text as="p" tone="subdued">
                No matching orders yet. Once a HyperLocal (Prepaid) order
                comes in, it'll show up here.
              </Text>
            ) : (
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text"]}
                headings={["Order", "Sent to", "Status", "When", "Notes"]}
                rows={rows}
              />
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

function statusBadge(status) {
  if (status === "SENT") return "Sent";
  if (status === "FAILED") return "Failed";
  return "Skipped";
}
