import {
  EtsyApiError,
  EtsyAuthError,
  EtsyClient,
  EtsyRateLimitError,
  TokenManager,
  type EtsyTokens,
  type GetShopReceiptsParams,
  type ListingParams,
  type ListingState,
  type SearchParams,
} from "@profplum700/etsy-v3-api-client";

export interface TokenProvider {
  getAccessToken(): Promise<string>;
  getCurrentTokens?(): EtsyTokens | null;
  isTokenExpired?(): boolean;
  refreshToken?(): Promise<EtsyTokens>;
}

export interface EtsyApiClientConfig {
  apiKey: string;
  sharedSecret: string;
  refreshToken: string;
  tokenProvider?: TokenProvider;
}

export type ListingFullIncludes =
  | "Images"
  | "Inventory"
  | "Translations"
  | "Shop"
  | "Shipping"
  | "Videos";

export interface ListingQueryParams {
  state?: string;
  limit?: number;
  offset?: number;
}

export interface PublicListingSearchParams {
  keywords?: string;
  limit?: number;
  offset?: number;
  taxonomy_id?: number;
  min_price?: number;
  max_price?: number;
}

export interface ListingFullParams {
  includes?: ListingFullIncludes[];
}

export interface ReceiptListParams {
  limit?: number;
  offset?: number;
}

export interface EtsyMcpApiClient {
  tokenProvider: TokenProvider;
  searchPublicListings(params?: PublicListingSearchParams): Promise<unknown>;
  getMe(): Promise<unknown>;
  getShop(shopId: string): Promise<unknown>;
  getShopContext(shopId?: string): Promise<unknown>;
  getShopSections(shopId: string): Promise<unknown>;
  getListingsByShop(shopId: string, params?: ListingQueryParams): Promise<unknown>;
  getListingFull(listingId: string, params?: ListingFullParams): Promise<unknown>;
  getListingImages(listingId: string): Promise<unknown>;
  getListingFiles(listingId: string): Promise<unknown>;
  getListingInventory(listingId: string): Promise<unknown>;
  getReceipts(shopId: string, params?: ReceiptListParams): Promise<unknown>;
  getReceiptFull(shopId: string, receiptId: string): Promise<unknown>;
  getSellerTaxonomyNodes(): Promise<unknown>;
  getPropertiesByTaxonomyId(taxonomyId: string | number): Promise<unknown>;
  getShopShippingProfiles(shopId: string): Promise<unknown>;
}

const TOKEN_BOOTSTRAP_EXPIRES_AT = new Date(0);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type EtsyClientWithRawRequest = {
  makeRequest: (endpoint: string) => Promise<unknown>;
};

export class RefreshTokenProvider implements TokenProvider {
  private readonly tokenManager: TokenManager;

  constructor(config: EtsyApiClientConfig) {
    this.tokenManager = new TokenManager({
      keystring: config.apiKey,
      sharedSecret: config.sharedSecret,
      accessToken: "bootstrap-token",
      refreshToken: config.refreshToken,
      expiresAt: TOKEN_BOOTSTRAP_EXPIRES_AT,
    });
  }

  getAccessToken(): Promise<string> {
    return this.tokenManager.getAccessToken();
  }

  getCurrentTokens(): EtsyTokens | null {
    return this.tokenManager.getCurrentTokens();
  }

  isTokenExpired(): boolean {
    return this.tokenManager.isTokenExpired();
  }

  refreshToken(): Promise<EtsyTokens> {
    return this.tokenManager.refreshToken();
  }
}

class EtsyApiClientAdapter implements EtsyMcpApiClient {
  readonly tokenProvider: TokenProvider;
  private readonly apiKey: string;
  private readonly sharedSecret: string;
  private readonly fallbackRefreshToken: string;

  constructor(config: EtsyApiClientConfig) {
    this.apiKey = config.apiKey;
    this.sharedSecret = config.sharedSecret;
    this.fallbackRefreshToken = config.refreshToken;
    this.tokenProvider = config.tokenProvider ?? new RefreshTokenProvider(config);
  }

  async searchPublicListings(params?: PublicListingSearchParams): Promise<unknown> {
    const searchParams: SearchParams = {};
    if (params?.keywords !== undefined) searchParams.keywords = params.keywords;
    if (params?.limit !== undefined) searchParams.limit = params.limit;
    if (params?.offset !== undefined) searchParams.offset = params.offset;
    if (params?.taxonomy_id !== undefined) searchParams.taxonomy_id = params.taxonomy_id;
    if (params?.min_price !== undefined) searchParams.min_price = params.min_price;
    if (params?.max_price !== undefined) searchParams.max_price = params.max_price;
    return this.withClient((client) => client.findAllListingsActive(searchParams));
  }

  async getMe(): Promise<unknown> {
    return this.withClient((client) => client.getUser());
  }

  async getShop(shopId: string): Promise<unknown> {
    return this.withClient((client) => client.getShop(shopId));
  }

  async getShopContext(shopId?: string): Promise<unknown> {
    const user = await this.getMe();
    const resolvedShopId = shopId ?? (isRecord(user) ? user.shop_id : undefined);
    if (
      resolvedShopId === undefined ||
      resolvedShopId === null ||
      String(resolvedShopId).length === 0
    ) {
      throw new EtsyApiError("Authenticated user does not have a shop", 404);
    }
    const shop = await this.getShop(String(resolvedShopId));
    return { user, shop };
  }

  async getShopSections(shopId: string): Promise<unknown> {
    return this.withClient((client) => client.getShopSections(shopId));
  }

  async getListingsByShop(shopId: string, params?: ListingQueryParams): Promise<unknown> {
    const listingParams: ListingParams = {};
    if (params?.state !== undefined) listingParams.state = params.state as ListingState;
    if (params?.limit !== undefined) listingParams.limit = params.limit;
    if (params?.offset !== undefined) listingParams.offset = params.offset;
    return this.withClient((client) => client.getListingsByShop(shopId, listingParams));
  }

  async getListingFull(listingId: string, params?: ListingFullParams): Promise<unknown> {
    return this.withClient((client) =>
      client.getListing(listingId, params?.includes ? { includes: params.includes } : undefined)
    );
  }

  async getListingImages(listingId: string): Promise<unknown> {
    return this.withClient((client) => client.getListingImages(listingId));
  }

  async getListingFiles(listingId: string): Promise<unknown> {
    return this.withClient((client) =>
      (client as unknown as EtsyClientWithRawRequest).makeRequest(`/listings/${listingId}/files`)
    );
  }

  async getListingInventory(listingId: string): Promise<unknown> {
    return this.withClient((client) => client.getListingInventory(listingId));
  }

  async getReceipts(shopId: string, params?: ReceiptListParams): Promise<unknown> {
    const receiptParams: GetShopReceiptsParams = {};
    if (params?.limit !== undefined) receiptParams.limit = params.limit;
    if (params?.offset !== undefined) receiptParams.offset = params.offset;
    return this.withClient((client) => client.getShopReceipts(shopId, receiptParams));
  }

  async getReceiptFull(shopId: string, receiptId: string): Promise<unknown> {
    return this.withClient((client) => client.getShopReceipt(shopId, receiptId));
  }

  async getSellerTaxonomyNodes(): Promise<unknown> {
    return this.withClient((client) => client.getSellerTaxonomyNodes());
  }

  async getPropertiesByTaxonomyId(taxonomyId: string | number): Promise<unknown> {
    return this.withClient((client) => client.getPropertiesByTaxonomyId(Number(taxonomyId)));
  }

  async getShopShippingProfiles(shopId: string): Promise<unknown> {
    return this.withClient((client) => client.getShopShippingProfiles(shopId));
  }

  private async withClient<T>(operation: (client: EtsyClient) => Promise<T>): Promise<T> {
    let accessToken: string;
    try {
      accessToken = await this.tokenProvider.getAccessToken();
    } catch {
      throw new EtsyAuthError(
        "Token provider failed to supply an access token",
        "TOKEN_PROVIDER_FAILED"
      );
    }

    if (!accessToken) {
      throw new EtsyAuthError(
        "Token provider returned an empty access token",
        "TOKEN_PROVIDER_EMPTY_TOKEN"
      );
    }

    const currentTokens = this.tokenProvider.getCurrentTokens?.();

    const client = new EtsyClient({
      keystring: this.apiKey,
      sharedSecret: this.sharedSecret,
      accessToken,
      refreshToken: currentTokens?.refresh_token ?? this.fallbackRefreshToken,
      expiresAt: currentTokens?.expires_at ?? new Date(Date.now() + 60_000),
      rateLimiting: { enabled: false },
      caching: { enabled: false },
    });

    return operation(client);
  }
}

export function createEtsyApiClient(config: EtsyApiClientConfig): EtsyMcpApiClient {
  return new EtsyApiClientAdapter(config);
}

function redactSecretText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(
      /(access[_-]?token|refresh[_-]?token|api[_-]?key|shared[_-]?secret|bearer)(["'\s:=]+)[^\s"',}]+/gi,
      "$1$2[REDACTED]"
    )
    .replace(/eyJ[A-Za-z0-9._~+/=-]{20,}/g, "[JWT_REDACTED]");
}

export function formatEtsyFailure(error: unknown): string {
  if (error instanceof EtsyRateLimitError) {
    return "Etsy API rate limit error";
  }

  if (error instanceof EtsyAuthError) {
    return "Etsy API authentication error";
  }

  if (error instanceof EtsyApiError) {
    const status = error.statusCode ? ` (${error.statusCode})` : "";
    return `Etsy API error${status}: ${redactSecretText(error.message)}`;
  }

  if (error instanceof Error) {
    return `Error: ${redactSecretText(error.message)}`;
  }

  return "Error: Unknown failure";
}
