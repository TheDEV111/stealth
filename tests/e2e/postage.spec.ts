import { test, expect, ACTOR, SENDER, MSG_ID, PAYMENT_HASH } from "./fixtures";

// API-level tests – no UI navigation required. The dev server must be running
// so that the TanStack Start API routes are reachable at /api/v1/…

test.describe("postage API", () => {
  test("quotes zero postage for an explicitly allowed sender", async ({ api }) => {
    // Allow the sender first
    await api.putPolicy(ACTOR, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    });
    await api.setSenderRule(ACTOR, SENDER, "allow");

    const res = await api.quotePostage(ACTOR, SENDER);
    expect(res.status()).toBe(200);

    const { data } = await res.json();
    expect(data.amount).toBe("0");
    expect(data.trusted).toBe(true);
    expect(data.eligible).toBe(true);
  });

  test("quote marks blocked sender as ineligible", async ({ api }) => {
    await api.setSenderRule(ACTOR, SENDER, "block");

    const res = await api.quotePostage(ACTOR, SENDER);
    expect(res.status()).toBe(200);

    const { data } = await res.json();
    expect(data.eligible).toBe(false);
    expect(data.reason).toBe("sender_blocked");
  });

  test("submits postage and then settles it", async ({ page, api }) => {
    await api.putPolicy(ACTOR, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    });

    const submitRes = await api.submitPostage(MSG_ID, PAYMENT_HASH, "100");
    expect(submitRes.status()).toBe(201);
    const { data: pending } = await submitRes.json();
    expect(pending.status).toBe("pending");

    // Settle as recipient (ACTOR)
    const settleRes = await page.request.post(`/api/v1/postage/${MSG_ID}/settle`, {
      headers: {
        "Content-Type": "application/json",
        "x-stealth-address": ACTOR,
      },
    });
    expect(settleRes.status()).toBe(200);
    const { data: settled } = await settleRes.json();
    expect(settled.status).toBe("settled");
  });

  test("submits postage and then refunds it", async ({ page, api }) => {
    // Use different IDs to avoid collision with other tests
    const msgId = "c".repeat(64);
    const payHash = "d".repeat(64);

    await api.putPolicy(ACTOR, { allowUnknown: true, minimumPostage: "0", requireVerified: false });

    const submitRes = await page.request.post("/api/v1/postage/", {
      headers: { "Content-Type": "application/json", "x-stealth-address": SENDER },
      data: {
        amount: "50",
        messageId: msgId,
        paymentHash: payHash,
        recipient: ACTOR,
        sender: SENDER,
      },
    });
    expect(submitRes.status()).toBe(201);

    const refundRes = await page.request.post(`/api/v1/postage/${msgId}/refund`, {
      headers: { "Content-Type": "application/json", "x-stealth-address": ACTOR },
    });
    expect(refundRes.status()).toBe(200);
    const { data } = await refundRes.json();
    expect(data.status).toBe("refunded");
  });

  test("rejects duplicate postage submission with 409", async ({ api }) => {
    const msgId = "e".repeat(64);
    const payHash = "f".repeat(64);

    await api.putPolicy(ACTOR, { allowUnknown: true, minimumPostage: "0", requireVerified: false });

    const first = await api.submitPostage(msgId, payHash, "0");
    expect(first.status()).toBe(201);

    const second = await api.submitPostage(msgId, payHash, "0");
    expect(second.status()).toBe(409);
  });

  test("rejects postage below mailbox minimum with 422", async ({ api }) => {
    await api.putPolicy(ACTOR, {
      allowUnknown: true,
      minimumPostage: "1000",
      requireVerified: false,
    });

    const msgId = "9".repeat(64);
    const payHash = "8".repeat(64);
    const res = await api.submitPostage(msgId, payHash, "1");
    expect(res.status()).toBe(422);
  });
});
