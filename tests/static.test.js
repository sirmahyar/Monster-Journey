import { describe, expect, it } from "vitest";
import { handleRequest } from "../src/server/http/handler.js";
import { staticResponse } from "../src/server/http/static.js";
import { apiConfig } from "./helpers.js";

const assets = {
  "/index.html": {
    type: "text/html; charset=utf-8",
    cache: "no-cache",
    body: "<div id=\"root\">سفر</div>",
  },
  "/assets/app.js": {
    type: "text/javascript; charset=utf-8",
    cache: "public, max-age=31536000, immutable",
    body: "console.log(1)",
  },
};

describe("embedded game page", () => {
  it("returns the page for GET / and still rejects GET on the API", async () => {
    const config = { ...apiConfig(), assets };
    const page = await handleRequest(new Request("https://monster.example/"), config);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(page.headers.get("cache-control")).toBe("no-cache");
    expect(await page.text()).toContain("root");

    const head = await handleRequest(new Request("https://monster.example/", { method: "HEAD" }), config);
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");

    const script = await handleRequest(new Request("https://monster.example/assets/app.js"), config);
    expect(script.status).toBe(200);
    expect(await script.text()).toBe("console.log(1)");

    const api = await handleRequest(new Request("https://monster.example/api/game/start"), config);
    expect(api.status).toBe(405);

    const missing = await handleRequest(new Request("https://monster.example/missing"), config);
    expect(missing.status).toBe(405);
    expect(staticResponse("/../index.html", "GET", assets)).toBeNull();
    expect(staticResponse("/..\\index.html", "GET", assets)).toBeNull();

    const bare = await handleRequest(new Request("https://monster.example/"), apiConfig());
    expect(bare.status).toBe(405);
  });
});