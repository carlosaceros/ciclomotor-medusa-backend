import { 
  createWorkflow, 
  createStep, 
  StepResponse,
  WorkflowResponse
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { ZohoClientService } from "../services/zoho-client"
import type { ZohoItem } from "../services/zoho-client"

export const fetchZohoItemsStep = createStep(
  "fetch-zoho-items",
  async (_, { container }) => {
    // Instantiate custom service directly (bypassing DI limits for now to avoid resolution errors)
    const zohoClientService = new ZohoClientService()
    
    const items = await zohoClientService.fetchItems()
    return new StepResponse(items, null)
  }
)

export const upsertZohoProductsStep = createStep(
  "upsert-zoho-products",
  async (zohoItems: ZohoItem[], { container }) => {
    const productModuleService = container.resolve(Modules.PRODUCT)
    
    // We will collect the upserted IDs to return
    const processedProductIds: string[] = []

    for (const item of zohoItems) {
      // 1. Check if product already exists by external_id
      const existingProducts = await productModuleService.listProducts({
        external_id: item.item_id
      })
      const existingProduct = existingProducts[0]
      
      if (existingProduct) {
        // Ensure to cast or rely on Medusa core typing
        await productModuleService.updateProducts(existingProduct.id, {
          title: item.name,
          description: item.description,
        })
        processedProductIds.push(existingProduct.id)
      } else {
        // Create Product
        // In Medusa v2, you can create a product with its variant and price inline
        const createdProduct = await productModuleService.createProducts([
          {
            title: item.name,
            description: item.description,
            external_id: item.item_id, // Key joining logic
            options: [{ 
              title: "Default Option",
              values: ["Default"] 
            }],
            variants: [
              {
                title: "Default",
                sku: item.sku,
                manage_inventory: true,
                // The pricing data structure might vary depending on whether Pricing Module is used exclusively
                // but standard createProducts payload still often accepts prices
                options: {
                  "Default Option": "Default"
                }
              }
            ]
          }
        ])
        
        processedProductIds.push(createdProduct[0].id)
      }

      // NOTE: For true inventory sync (`actual_available_stock`) and prices (`rate`), 
      // Medusa v2 strictly isolates these to the Inventory and Pricing modules. 
      // You would dispatch further workflow steps or module calls here:
      //
      // e.g. inventoryModuleService.createInventoryLevels(...)
      // e.g. pricingModuleService.createPrices(...)
    }
    
    return new StepResponse({ processedProductIds }, null)
  }
)

export const syncZohoItemsWorkflow = createWorkflow(
  "sync-zoho-items",
  () => {
    const zohoItems = fetchZohoItemsStep()
    const result = upsertZohoProductsStep(zohoItems)
    
    return new WorkflowResponse(result)
  }
)
