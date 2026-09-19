import { expect, test } from "@playwright/test";
test("measure", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  await page.getByLabel("Work email").fill("superadmin@demo.selorax.test");
  await page.getByLabel("Password").fill(process.env.SEED_PASSWORD ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/dashboard/);
  for (const [url, w] of [["/documents", 375], ["/dashboard", 320], ["/profile", 320]] as const) {
    await page.setViewportSize({ width: w, height: 812 });
    await page.goto(url); await page.waitForLoadState("networkidle");
    console.log(url, w, await page.evaluate(() => {
      const vw = document.documentElement.clientWidth; const out: string[] = [];
      // deepest elements wider than the viewport whose children all fit: the culprits
      for (const el of document.querySelectorAll("main *")) {
        const r = el.getBoundingClientRect(); if (r.right <= vw + 1) continue;
        const kids = [...el.children].some((c) => c.getBoundingClientRect().right > vw + 1);
        if (!kids) out.push(`${el.tagName} ${el.getAttribute("class")} w=${Math.round(r.width)} sw=${el.scrollWidth} "${(el.textContent ?? "").slice(0, 40)}"`);
      }
      const grid = document.querySelector("main > div");
      return { track: grid && getComputedStyle(grid).gridTemplateColumns, culprits: out.slice(0, 8) };
    }));
  }
});
