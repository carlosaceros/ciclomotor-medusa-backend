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
      // 1. Skip items with empty SKU as Medusa requires unique SKUs
      if (!item.sku || item.sku.trim() === "") {
        console.warn(`Skipping Zoho Item ${item.item_id} (${item.name}) because it has no SKU.`)
        continue
      }

      console.log(`Processing Zoho Item: ${item.name} (SKU: ${item.sku})`)

      // 2. Lookup existing product
      // We check by external_id (Zoho item_id) first
      let existingProducts = await productModuleService.listProducts({
        external_id: item.item_id
      })
      
      let existingProduct = existingProducts[0]

      // Fallback: Check by SKU if not found by external_id
      if (!existingProduct) {
        const productsBySku = await productModuleService.listProducts({
          variants: { sku: item.sku }
        })
        existingProduct = productsBySku[0]
        
        if (existingProduct) {
          console.log(`Found existing product ${existingProduct.id} by SKU matching Zoho Item ${item.item_id}. Updating external_id.`)
        }
      }
      
      if (existingProduct) {
        // Update Product
        await productModuleService.updateProducts(existingProduct.id, {
          title: item.name,
          description: item.description,
          external_id: item.item_id, // Ensure external_id is linked
        })
        processedProductIds.push(existingProduct.id)
      } else {
        // Create Product
        try {
          const createdProduct = await productModuleService.createProducts([
            {
              title: item.name,
              description: item.description,
              external_id: item.item_id,
              options: [{ 
                title: "Default Option",
                values: ["Default"] 
              }],
              variants: [
                {
                  title: "Default",
                  sku: item.sku,
                  manage_inventory: true,
                  options: {
                    "Default Option": "Default"
                  }
                }
              ]
            }
          ])
          processedProductIds.push(createdProduct[0].id)
        } catch (error) {
          console.error(`Failed to create product for Zoho Item ${item.item_id} (${item.sku}):`, error.message)
          // We continue to next item instead of crashing the whole workflow
        }
      }
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
