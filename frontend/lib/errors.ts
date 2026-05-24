export type ApiErrorBody = {
  code: string;
  message: string;
  fields?: Array<{ field: string; error: string }>;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(body.message);
    this.name = "ApiError";
  }
}

export async function parseErrorBody(res: Response): Promise<ApiErrorBody> {
  try {
    const data = (await res.clone().json()) as Partial<ApiErrorBody> | null;
    if (data && typeof data.code === "string" && typeof data.message === "string") {
      return {
        code: data.code,
        message: data.message,
        fields: Array.isArray(data.fields) ? data.fields : undefined,
      };
    }
  } catch {
    // fall through
  }
  return { code: "UNKNOWN", message: res.statusText || "Request failed" };
}
