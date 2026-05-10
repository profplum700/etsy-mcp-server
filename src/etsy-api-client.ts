import {
  EtsyApiError,
  EtsyAuthError,
  EtsyClient,
  EtsyRateLimitError,
  TokenManager,
  type EtsyTokens,
  type ListingParams,
  type ListingState,
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

export interface EtsyMcpApiClient {
  tokenProvider: TokenProvider;
  getMe(): Promise<unknown>;
  getShop(shopId: string): Promise<unknown>;
  getShopSections(shopId: string): Promise<unknown>;
  getListingsByShop(shopId: string, params?: { state?: string }): Promise<unknown>;
  getListingImages(listingId: string): Promise<unknown>;
  getListingFiles(listingId: string): Promise<unknown>;
  getListingInventory(listingId: string): Promise<unknown>;
  getSellerTaxonomyNodes(): Promise<unknown>;
  getPropertiesByTaxonomyId(taxonomyId: string | number): Promise<unknown>;
  getShopShippingProfiles(shopId: string): Promise<unknown>;
}

const TOKEN_BOOTSTRAP_EXPIRES_AT = new Date(0);

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

  async getMe(): Promise<unknown> {
    return this.withClient((client) => client.getUser());
  }

  async getShop(shopId: string): Promise<unknown> {
    return this.withClient((client) => client.getShop(shopId));
  }

  async getShopSections(shopId: string): Promise<unknown> {
    return this.withClient((client) => client.getShopSections(shopId));
  }

  async getListingsByShop(shopId: string, params?: { state?: string }): Promise<unknown> {
    const listingParams: ListingParams | undefined = params?.state
      ? { state: params.state as ListingState }
      : undefined;
    return this.withClient((client) => client.getListingsByShop(shopId, listingParams));
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

export function formatEtsyFailure(error: unknown): string {
  if (error instanceof EtsyRateLimitError) {
    return "Etsy API rate limit error";
  }

  if (error instanceof EtsyAuthError) {
    return "Etsy API authentication error";
  }

  if (error instanceof EtsyApiError) {
    const status = error.statusCode ? ` (${error.statusCode})` : "";
    return `Etsy API error${status}: ${error.message}`;
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return "Error: Unknown failure";
}
