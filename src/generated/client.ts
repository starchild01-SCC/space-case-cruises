import type { paths } from "./api-types.js";

type HttpMethod = "get" | "post" | "patch" | "put" | "delete";

type OperationFor<
  P extends keyof paths,
  M extends HttpMethod,
> = paths[P][M] extends never ? never : Exclude<paths[P][M], undefined>;

type PathParamsFor<Op> = Op extends { parameters: infer Params }
  ? Params extends { path: infer PathParams }
    ? PathParams extends never
      ? undefined
      : PathParams
    : undefined
  : undefined;

type QueryParamsFor<Op> = Op extends { parameters: infer Params }
  ? Params extends { query: infer QueryParams }
    ? QueryParams extends never
      ? undefined
      : QueryParams
    : undefined
  : undefined;

type JsonBodyFor<Op> = Op extends {
  requestBody: { content: { "application/json": infer Body } };
}
  ? Body
  : undefined;

type JsonFromResponse<Resp> = Resp extends {
  content: { "application/json": infer Json };
}
  ? Json
  : unknown;

type SuccessResponseFor<Op> = Op extends { responses: infer Responses }
  ? Responses extends Record<number, unknown>
    ? 200 extends keyof Responses
      ? JsonFromResponse<Responses[200]>
      : 201 extends keyof Responses
        ? JsonFromResponse<Responses[201]>
        : unknown
    : unknown
  : unknown;

export interface ApiClientOptions {
  baseUrl: string;
  headers?: HeadersInit;
}

interface RequestInput<P extends keyof paths, M extends HttpMethod> {
  path: P;
  method: M;
  pathParams?: PathParamsFor<OperationFor<P, M>>;
  query?: QueryParamsFor<OperationFor<P, M>>;
  body?: JsonBodyFor<OperationFor<P, M>>;
  headers?: HeadersInit;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: HeadersInit;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.defaultHeaders = options.headers ?? {};
  }

  setDefaultHeaders(headers: HeadersInit): ApiClient {
    return new ApiClient({
      baseUrl: this.baseUrl,
      headers,
    });
  }

  async request<P extends keyof paths, M extends HttpMethod>(
    input: RequestInput<P, M>,
  ): Promise<SuccessResponseFor<OperationFor<P, M>>> {
    const pathWithParams = this.applyPathParams(input.path, input.pathParams);
    const url = new URL(pathWithParams, `${this.baseUrl}/`);

    if (input.query && typeof input.query === "object") {
      for (const [key, rawValue] of Object.entries(input.query as Record<string, unknown>)) {
        if (rawValue === undefined || rawValue === null) {
          continue;
        }

        url.searchParams.set(key, String(rawValue));
      }
    }

    const headers = new Headers(this.defaultHeaders);
    if (input.headers) {
      new Headers(input.headers).forEach((value, key) => headers.set(key, value));
    }

    const hasBody = input.body !== undefined;
    if (hasBody && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const response = await fetch(url, {
      method: input.method.toUpperCase(),
      headers,
      body: hasBody ? JSON.stringify(input.body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API ${input.method.toUpperCase()} ${String(input.path)} failed (${response.status}): ${text}`);
    }

    if (response.status === 204) {
      return undefined as SuccessResponseFor<OperationFor<P, M>>;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return undefined as SuccessResponseFor<OperationFor<P, M>>;
    }

    return (await response.json()) as SuccessResponseFor<OperationFor<P, M>>;
  }

  getSession() {
    return this.request({
      path: "/api/v1/auth/session",
      method: "get",
    });
  }

  getCadre(query?: QueryParamsFor<OperationFor<"/api/v1/cadre", "get">>) {
    return this.request({
      path: "/api/v1/cadre",
      method: "get",
      query,
    });
  }

  getCruises(query?: QueryParamsFor<OperationFor<"/api/v1/cruises", "get">>) {
    return this.request({
      path: "/api/v1/cruises",
      method: "get",
      query,
    });
  }

  toggleCommitment(body: JsonBodyFor<OperationFor<"/api/v1/commitments/toggle", "post">>) {
    return this.request({
      path: "/api/v1/commitments/toggle",
      method: "post",
      body,
    });
  }

  patchCruiseMapBatch(
    cruiseId: string,
    body: JsonBodyFor<OperationFor<"/api/v1/admin/cruises/{cruiseId}/map/batch", "patch">>,
  ) {
    return this.request({
      path: "/api/v1/admin/cruises/{cruiseId}/map/batch",
      method: "patch",
      pathParams: { cruiseId },
      body,
    });
  }

  private applyPathParams<P extends keyof paths>(
    path: P,
    pathParams: unknown,
  ): string {
    const asString = String(path);
    if (!pathParams || typeof pathParams !== "object") {
      return asString;
    }

    return asString.replace(/\{([^}]+)\}/g, (_match, key: string) => {
      const value = (pathParams as Record<string, unknown>)[key];
      if (value === undefined || value === null) {
        throw new Error(`Missing path parameter: ${key}`);
      }
      return encodeURIComponent(String(value));
    });
  }
}

export const createApiClient = (options: ApiClientOptions): ApiClient => new ApiClient(options);
