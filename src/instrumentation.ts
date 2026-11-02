import { captureServerError } from "./lib/observability/error-logger";

export async function register() {
  // Server runtime initialization
}

export async function onRequestError(
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
    renderSource?: string;
  }
) {
  captureServerError(err, {
    path: request.path,
    method: request.method,
    metadata: {
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    },
  });
}
