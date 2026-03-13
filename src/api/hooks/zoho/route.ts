import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { syncZohoItemsWorkflow } from "../../../workflows/sync-zoho-items"

/**
 * Endpoint: POST /hooks/zoho
 * Purpose: Allows Zoho Inventory to trigger a Medusa sync via Webhook.
 * E.g. configure Zoho to hit https://your-railway-url.com/hooks/zoho on item.created or item.updated
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  // In a more advanced implementation, req.body would contain the specific item ID 
  // that changed, so we don't have to sync everything. 
  // For this MVP, receiving the webhook triggers the entire sync.

  console.log("Received Zoho Webhook. Triggering sync workflow...")

  try {
    // req.scope is the DI container for the request context
    const { result } = await syncZohoItemsWorkflow(req.scope).run()

    res.status(200).json({
      success: true,
      message: "Sync workflow executed.",
      processedProductIds: result.processedProductIds
    })
  } catch (error) {
    console.error("Error processing Zoho Webhook:", error)

    res.status(500).json({
      success: false,
      message: "Internal Server Error executing sync workflow."
    })
  }
}
