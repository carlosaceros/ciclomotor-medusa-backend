import { MedusaContainer } from "@medusajs/framework/types"
import { syncZohoItemsWorkflow } from "../workflows/sync-zoho-items"

/**
 * Scheduled job to sync Zoho Inventory items every 15 minutes.
 * When deployed on Railway, this node process will respect the cron schedules.
 */
export default async function syncInventoryJob(
  container: MedusaContainer
) {
  console.log("Starting Zoho Inventory Sync Workflow...")
  
  try {
    const { result } = await syncZohoItemsWorkflow(container).run()
    console.log(`Sync Workflow Finished. Processed IDs: ${result.processedProductIds.length}`)
  } catch (error) {
    console.error("Zoho Sync Workflow Failed:", error)
  }
}

export const config = {
  name: "sync-zoho-items-cron",
  schedule: "*/15 * * * *", // Runs every 15th minute
}
