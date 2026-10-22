# Future Integrations & E-Commerce Architecture (Medusa Storefront)

> **Architectural Guardrail:** In accordance with Section 5.H of the Master Implementation Specification, all future external e-commerce integrations remain **DISABLED** in this local runtime version. Business OS operates completely offline and self-contained for Facebook, Instagram, WhatsApp, and manual orders.
> This document specifies the extension points, idempotency keys, and entity mappings for future activation.

---

## 1. Single Source of Truth Principle

When connecting AFK THEORY's Next.js / Medusa storefront:
- **Storefront / Shopping Cart:** Drives customer browsing, cart checkout, and payment gateway authorizations.
- **Business OS:** Authoritative source of truth for accounting general ledger, inventory lot valuation, purchasing, manufacturing, and partner reports.
- **Stock Decrements:** Only Business OS reserves and decrements inventory lots upon confirmed order ingestion. The storefront must not maintain independent divergent stock balances.

---

## 2. Ingestion Webhook Strategy

A future adapter module `src/server/integrations/medusa.ts` will ingest Medusa webhooks:

```typescript
export interface MedusaOrderEvent {
  id: string; // Remote Medusa order ID
  event: "order.placed" | "order.canceled" | "order.payment_captured";
  data: {
    id: string;
    display_id: number;
    email: string;
    currency_code: string;
    total: number;
    shipping_address: any;
    items: Array<{
      id: string;
      variant_id: string; // Medusa variant ID
      sku: string;        // AFK SKU (e.g. AFK-DS-T001-BLK-M)
      quantity: number;
      unit_price: number;
    }>;
  };
}
```

---

## 3. Webhook Idempotency & Replay Protection

To prevent network retries or duplicate webhook delivery from creating duplicate orders or stock reservations:

1. **Idempotency Guard:**
   Store `remoteOrderId` in `sales_orders.notes` as `IDEMPOTENCY:MEDUSA_${remoteOrderId}`.
2. If an order with this idempotency key exists, immediately return HTTP 200 without re-posting journals or decrements.
3. Use database unique constraint on `(source_module, source_id)`.

---

## 4. SKU Mapping & State Reconciliation

| Medusa Storefront State | Business OS State | Accounting Action |
|---|---|---|
| `order.placed` | `CONFIRMED` | Reserve stock lot via row-level lock |
| `order.fulfillment_created` | `SHIPPED` | Transfer stock to `TRANSIT`, assign waybill |
| `order.delivered` / COD paid | `DELIVERED` | Recognize sales revenue, post COGS |
| `order.canceled` | `CANCELLED` | Release reserved stock |
| `order.refund_created` | `RETURNED` | Post sales return contra-revenue & restock/defect journal |
