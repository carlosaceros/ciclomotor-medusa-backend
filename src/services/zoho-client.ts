import axios, { AxiosInstance } from "axios"

export type ZohoItem = {
  item_id: string
  sku: string
  name: string
  rate: number
  description: string
  actual_available_stock: number
}

export type ZohoItemsResponse = {
  code: number
  message: string
  items: ZohoItem[]
}

/**
 * Service to interact with Zoho Inventory API
 */
export class ZohoClientService {
  private client: AxiosInstance
  private accessToken: string | null = null

  constructor() {
    this.client = axios.create({
      baseURL: "https://www.zohoapis.com/inventory/v1",
      headers: {
        "Content-Type": "application/json",
      },
    })

    // Setup interceptor for auto token refresh
    this.client.interceptors.request.use(async (config) => {
      if (!this.accessToken) {
        await this.refreshAccessToken()
      }
      config.headers.Authorization = `Zoho-oauthtoken ${this.accessToken}`
      return config
    })

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config
        // If unauthorized and we haven't already retried
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true
          await this.refreshAccessToken()
          originalRequest.headers.Authorization = `Zoho-oauthtoken ${this.accessToken}`
          return this.client(originalRequest)
        }
        return Promise.reject(error)
      }
    )
  }

  private async refreshAccessToken() {
    const clientId = process.env.ZOHO_CLIENT_ID
    const clientSecret = process.env.ZOHO_CLIENT_SECRET
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN
    
    // In production, Zoho has different DCs: .com, .eu, .in etc.
    // Ensure the domain matches your account's DC
    const authUrl = "https://accounts.zoho.com/oauth/v2/token"

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("Zoho credentials missing from environment variables.")
    }

    try {
      const response = await axios.post(
        `${authUrl}?refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}&grant_type=refresh_token`
      )
      
      this.accessToken = response.data.access_token
      if (!this.accessToken) {
        throw new Error("Failed to retrieve access token from Zoho")
      }
    } catch (error) {
      console.error("Error refreshing Zoho access token:", error)
      throw error
    }
  }

  /**
   * Fetches all items from Zoho Inventory.
   * Note: This fetches the first page. For production with many items, implement pagination.
   */
  async fetchItems(organizationId?: string): Promise<ZohoItem[]> {
    try {
      // organization_id is required by Zoho Inventory API. It can also be passed via header X-com-zoho-inventory-organizationid
      const defaultOrgId = process.env.ZOHO_ORGANIZATION_ID
      const orgId = organizationId || defaultOrgId

      const response = await this.client.get<ZohoItemsResponse>("/items", {
        params: {
          organization_id: orgId,
        },
      })

      if (response.data.code !== 0) {
        throw new Error(`Zoho API Error: ${response.data.message}`)
      }

      return response.data.items || []
    } catch (error) {
      console.error("Failed to fetch items from Zoho:", error)
      throw error
    }
  }
}
