"use server";

import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";
import { getSiteUrl } from "@/lib/site-url";

export type CreateCheckoutState = { error: string | null; url: string | null };

/**
 * Creates a Stripe Checkout Session for an invoice's remaining balance. Does
 * NOT record a payment itself — the webhook handler (app/api/webhooks/stripe)
 * does that on checkout.session.completed, once Stripe confirms the charge.
 */
export async function createInvoiceCheckoutSessionAction(
  invoiceId: string,
): Promise<CreateCheckoutState> {
  const supabase = await createClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, tenant_id, contact_id, balance_due, currency, status")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    return { error: "Invoice not found.", url: null };
  }
  if (invoice.status === "draft" || invoice.status === "void") {
    return { error: "This invoice can't be paid yet.", url: null };
  }
  if (!(invoice.balance_due > 0)) {
    return { error: "This invoice has no balance due.", url: null };
  }

  const siteUrl = await getSiteUrl();

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: invoice.currency.toLowerCase(),
          unit_amount: Math.round(invoice.balance_due * 100),
          product_data: { name: `Invoice ${invoice.invoice_number}` },
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoiceId: invoice.id,
      tenantId: invoice.tenant_id,
      contactId: invoice.contact_id,
    },
    success_url: `${siteUrl}/sales/${invoice.id}?paid=1`,
    cancel_url: `${siteUrl}/sales/${invoice.id}`,
  });

  if (!session.url) {
    return { error: "Stripe did not return a checkout URL.", url: null };
  }

  return { error: null, url: session.url };
}
