import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const PASSWORD = process.env.SEED_PASSWORD ?? "";
const EMPLOYEE = "employee@demo.selorax.test";
const HR = "hr@demo.selorax.test";

/** Browser errors and CSP violations on the page; a smoke test fails on any of them. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error")
      errors.push(`console: ${message.text()} (${message.location().url})`);
  });
  return errors;
}

/** No serious or critical WCAG 2 A/AA problems on the page as it is now. */
async function expectAccessible(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map(
      (v) =>
        `${where}: ${v.id} (${v.impact}) ${v.help} — ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(", ")}`,
    ),
  ).toEqual([]);
}

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** The next working day (Friday is the weekend) after `date`. */
function nextWorkingDay(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  do next.setUTCDate(next.getUTCDate() + 1);
  while (next.getUTCDay() === 5);
  return next.toISOString().slice(0, 10);
}

test.describe.serial("smoke", () => {
  test.skip(!PASSWORD, "Set SEED_PASSWORD to the demo password");
  let reason = "";

  test("an employee checks in and requests leave", async ({ page }, info) => {
    const errors = watchErrors(page);
    reason = `Smoke test ${info.project.name} ${Date.now()}`;
    await signIn(page, EMPLOYEE);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAccessible(page, "employee dashboard");

    await page.goto("/attendance");
    const checkIn = page.getByRole("button", { name: "Check in" });
    if (await checkIn.isVisible()) {
      await checkIn.click();
      await expect(
        page.getByRole("button", { name: "Check out" }),
      ).toBeVisible();
    }
    await expectAccessible(page, "attendance");

    await page.goto("/leave");
    await page.getByLabel("Reason").fill(reason);
    // Two months ahead, then the first day without leave already (earlier runs leave theirs behind)
    let day = nextWorkingDay(
      new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10),
    );
    for (let tries = 0; ; tries++) {
      await page.getByLabel("First day").fill(day);
      await page.getByLabel("Last day").fill(day);
      await expect(page.getByText("1 day of leave")).toBeVisible();
      if (
        !(await page
          .getByText(
            "You already have leave requested or approved on some of these days",
          )
          .isVisible())
      )
        break;
      expect(tries).toBeLessThan(60);
      day = nextWorkingDay(day);
    }
    await expectAccessible(page, "leave form with preview");
    await page.getByRole("button", { name: "Request leave" }).click();
    await expect(
      page.getByText(
        "Leave requested. Your manager will be asked to approve it.",
      ),
    ).toBeVisible();
    await expect(page.getByText(reason, { exact: false })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("HR sees the dashboard and profile, and approves that request", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await signIn(page, HR);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAccessible(page, "HR dashboard");

    await page.goto("/employees?q=Rahim");
    await page.getByRole("link", { name: "Rahim Ahmed" }).first().click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Rahim Ahmed" }),
    ).toBeVisible();
    await expectAccessible(page, "employee profile");

    await page.goto("/leave/requests");
    const request = page.locator("article").filter({ hasText: reason });
    await expect(request).toBeVisible();
    await expectAccessible(page, "leave review queue");
    await request.getByRole("button", { name: "Approve" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Approve" })
      .click();
    await expect(
      page.getByText("Leave approved for Rahim Ahmed"),
    ).toBeVisible();

    expect(errors).toEqual([]);
  });
});
