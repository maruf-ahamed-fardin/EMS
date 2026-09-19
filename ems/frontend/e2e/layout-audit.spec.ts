// TEMPORARY audit script (not committed): every page at many widths, looking for horizontal overflow,
// small touch targets and browser errors. Run with EMS_BASE_URL and SEED_PASSWORD.
import { expect, type Page, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const PASSWORD = process.env.SEED_PASSWORD ?? "";
const OUT = process.env.AUDIT_OUT ?? "audit-out";
const WIDTHS = [320, 375, 390, 414, 768, 1024, 1280, 1440, 1920];
const STATIC = [
  "/dashboard", "/employees", "/employees/new", "/departments", "/positions", "/attendance", "/leave",
  "/leave/requests", "/leave/types", "/documents", "/documents/types", "/notifications", "/reports",
  "/audit-logs", "/users", "/roles", "/settings", "/profile", "/profile/security",
];

async function problems(page: Page, narrow: boolean) {
  return page.evaluate((narrow) => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.getAttribute("class") ?? "").split(" ").slice(0, 4).join(".")} "${(el.textContent ?? "").trim().slice(0, 30)}"`;
    if (document.documentElement.scrollWidth > vw + 1)
      out.push(`PAGE SCROLLS HORIZONTALLY ${document.documentElement.scrollWidth} > ${vw}`);
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden") continue;
      if (r.right > vw + 1 || r.left < -1) {
        let p = el.parentElement;
        let clipped = false;
        while (p && p !== document.body) {
          if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) { clipped = true; break; }
          p = p.parentElement;
        }
        if (!clipped && !el.closest("[aria-hidden=true], [inert]"))
          out.push(`overflow ${Math.round(r.left)}..${Math.round(r.right)} ${describe(el)}`);
      }
      // Text clipped inside its own box without an ellipsis or scroll
      if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 2 && style.overflowX === "visible" && (el.textContent ?? "").trim())
        out.push(`text wider than box ${el.scrollWidth}>${el.clientWidth} ${describe(el)}`);
    }
    if (narrow)
      for (const el of document.querySelectorAll("button, [role=button], input:not([type=hidden]), select, [role=combobox], [role=tab], [role=checkbox], [role=switch]")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < 24 || r.width < 24) out.push(`small target ${Math.round(r.width)}x${Math.round(r.height)} ${describe(el)}`);
      }
    return [...new Set(out)];
  }, narrow);
}

test("layout audit", async ({ browser }) => {
  test.setTimeout(30 * 60_000);
  fs.mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()} page error: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${page.url()} console: ${m.text()}`); });

  await page.goto("/login");
  await page.getByLabel("Work email").fill("superadmin@demo.selorax.test");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  const hrefOf = async (from: string, pattern: RegExp) => {
    await page.goto(from);
    const links = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    return links.find((h) => pattern.test(h));
  };
  const dynamic = [
    await hrefOf("/employees", /^\/employees\/[^/?]+$/),
    await hrefOf("/departments", /^\/departments\/[^/?]+$/),
    await hrefOf("/audit-logs", /^\/audit-logs\/[^/?]+$/),
  ].filter((h): h is string => !!h && !h.endsWith("/new"));
  const employee = dynamic.find((h) => h.startsWith("/employees/"));
  const pages = [...STATIC, ...dynamic, ...(employee ? [`${employee}/edit`] : [])];

  const report: Record<string, Record<number, string[]>> = {};
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    for (const url of pages) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const found = await problems(page, width <= 414);
      if (found.length) (report[url] ??= {})[width] = found;
      if (width === 320 || width === 768 || width === 1440)
        await page.screenshot({ path: path.join(OUT, `${width}${url.replace(/\//g, "_")}.png`), fullPage: true });
    }
  }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ pages, report, errors }, null, 2));
});
