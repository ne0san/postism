// bun test 用(*.test.ts)。
import { describe, expect, test } from "bun:test";
import { greet, handler } from "./index";

describe("hello (bun test)", () => {
  test("greet", () => {
    expect(greet("bun")).toBe("hello, bun");
  });
  test("handler", async () => {
    const res = await handler({ queryStringParameters: { name: "bun" } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe("hello, bun");
  });
});
