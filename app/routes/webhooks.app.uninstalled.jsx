import db from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, session } = await authenticate.webhook(request);

  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // Keep MailLog history but drop the live settings/credentials so a
  // stale SMTP password doesn't linger if the app is reinstalled later
  // under different settings. Comment this out if you'd rather keep it.
  await db.settings.deleteMany({ where: { shop } });

  return new Response();
};
