// 最小の Lambda(API Gateway HTTP API の payload v2)。環境の確認用。
type Event = { rawPath?: string; queryStringParameters?: Record<string, string> };

export function greet(name?: string): string {
  return `hello, ${name ?? "world"}`;
}

export const handler = async (event: Event) => ({
  statusCode: 200,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    message: greet(event.queryStringParameters?.name),
    runtime: { node: process.versions.node, bun: process.versions.bun ?? null },
  }),
});
