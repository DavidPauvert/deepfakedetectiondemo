import { serve } from "bun";
import index from "./index.html";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const server = serve({
    routes: {
        // Demo / test endpoint
        "/api/hello": {
            GET() {
                return Response.json({
                    message: "Hello from Deepfake Detector",
                    method: "GET",
                });
            },
        },

        // Proxy all /api/* calls to FastAPI backend
        "/api/*": async (req) => {
            const url = new URL(req.url);
            const targetUrl = `${BACKEND_URL}${url.pathname}${url.search}`;

            try {
                const headers = new Headers(req.headers);
                // Remove host header so backend receives its expected host
                headers.delete("host");

                // Forward request to FastAPI backend
                const fetchOptions: RequestInit = {
                    method: req.method,
                    headers,
                    // Forward body for POST/PUT requests
                    body:
                        req.method !== "GET" && req.method !== "HEAD"
                            ? req.body
                            : undefined,
                    // @ts-expect-error duplex is required in node/bun fetch for streaming bodies
                    duplex: "half",
                };

                const backendResponse = await fetch(targetUrl, fetchOptions);

                // Forward response back to browser
                return new Response(backendResponse.body, {
                    status: backendResponse.status,
                    statusText: backendResponse.statusText,
                    headers: backendResponse.headers,
                });
            } catch (err) {
                return Response.json(
                    {
                        status: "degraded",
                        detail: `FastAPI backend is unreachable at ${BACKEND_URL}`,
                        error: err instanceof Error ? err.message : String(err),
                    },
                    { status: 502 },
                );
            }
        },

        // Serve index.html for all other routes
        "/*": index,
    },

    development: process.env.NODE_ENV !== "production" && {
        // Enable browser hot reloading in development
        hmr: true,

        // Echo console logs from the browser to the server
        console: true,
    },
});

console.log(`Deepfake Detector running at ${server.url}`);
console.log(`Backend proxy target: ${BACKEND_URL}`);
