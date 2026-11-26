// vitest 用(*.vitest.ts)。bun test は *.test.ts を拾うので、名前で分ける。
import { describe, expect, test } from "vitest";
import { greet, handler } from "./index";

describe("hello (vitest)", () => {
  test("greet", () => {
    expect(greet()).toBe("hello, world");
  });
  test("handler", async () => {
    const res = await handler({});
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    console.log("vitest runtime:", JSON.stringify(body.runtime));
    expect(body.message).toBe("hello, world");
  });
});
