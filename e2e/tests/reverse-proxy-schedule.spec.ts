import type { Page } from "@playwright/test";
import { deleteNetworksByPrefix, deleteServicesByPrefix } from "../helpers/api";
import { navigateTo } from "../helpers/auth";
import { expect, test } from "../helpers/fixtures";
import {
  CUSTOM_PORTS_DOMAIN,
  gotoReverseProxyPage,
  openServiceEdit,
  resetServiceFilters,
  selectProxyDomain,
} from "../helpers/reverse-proxy-l4";
import { generateRandomName } from "../helpers/utils";

let network = "";
let resource = "";
let subdomain = "";

const SERVICES_URL = "/api/reverse-proxies/services";

async function openSettingsTab(page: Page) {
  await page.getByTestId("proxy-tab-settings").click({ force: true });
}

async function saveEdit(page: Page, method: "POST" | "PUT") {
  const response = page.waitForResponse(
    (resp) =>
      resp.url().includes(SERVICES_URL) && resp.request().method() === method,
    { timeout: 30_000 },
  );
  await page
    .getByTestId(method === "POST" ? "submit-service" : "proxy-save")
    .click();
  // A service with no authentication asks for confirmation first.
  const confirm = page.getByTestId("confirmation.confirm");
  if (await confirm.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await confirm.click({ force: true });
  }
  return (await response).request().postDataJSON();
}

test.describe.serial("Reverse Proxy - Service schedule @reverse-proxy @test-env", () => {
  test("Should create a network with a resource", async ({
    dashboardAsOwner: page,
  }) => {
    await deleteServicesByPrefix(page, "schedule-svc-");
    await deleteNetworksByPrefix(page, "rp-schedule-net-");
    await navigateTo(page, "/networks");
    network = generateRandomName("rp-schedule-net-");
    await page.getByTestId("add-network").click();
    await page.getByTestId("network-name-input").fill(network);
    await page.getByTestId("submit-network").click();
    await page.getByTestId("confirmation.confirm").click({ force: true });

    resource = generateRandomName("rp-resource-");
    await page.getByTestId("resource-name-input").fill(resource);
    await page.getByTestId("resource-address-input").fill("10.99.99.50");
    await page.getByTestId("resource-continue").click();
    const resourcePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/networks/") &&
        resp.url().includes("/resources") &&
        resp.request().method() === "POST",
      { timeout: 30_000 },
    );
    await page.getByTestId("submit-resource").click();
    await page.getByTestId("confirmation.confirm").click({ force: true });
    await resourcePromise;
    await page.getByTestId("confirmation.cancel").click({ force: true });
  });

  test("Should send the schedule when creating an HTTP service", async ({
    dashboardAsOwner: page,
  }) => {
    test.setTimeout(90_000);
    await gotoReverseProxyPage(page, "/reverse-proxy/services");
    subdomain = generateRandomName("schedule-svc-");

    await page.getByTestId("add-service").first().click();
    await expect(page.getByTestId("proxy-subdomain-input")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("proxy-subdomain-input").fill(subdomain);
    await selectProxyDomain(page, CUSTOM_PORTS_DOMAIN);

    await page.getByTestId("add-target").scrollIntoViewIfNeeded();
    await page.getByTestId("add-target").click();
    await expect(page.getByTestId("group-selector-dropdown")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("group-selector-dropdown").click();
    await page
      .locator('[role="tab"]')
      .filter({ hasText: "Resources" })
      .click({ force: true });
    await page.getByTestId("group-selector-dropdown-search").fill(resource);
    await page.getByText(resource).click({ force: true, timeout: 15_000 });
    await page.getByTestId("target-port-input").fill("");
    await page.getByTestId("submit-target").click();

    // Service, Authentication and Access Control steps, then Advanced Settings.
    await page.getByTestId("proxy-continue").click();
    await page.getByTestId("proxy-continue").click();
    await page.getByTestId("proxy-continue").click();

    // The schedule is off until the toggle is switched on.
    await expect(page.getByTestId("schedule-editor")).toHaveCount(0);
    await page.getByTestId("toggle-schedule").click();
    await expect(page.getByTestId("schedule-editor")).toBeVisible();

    // The first window defaults to Monday to Friday, 08:00 to 17:00.
    await page.getByTestId("schedule-start-date").fill("2030-01-01");

    const payload = await saveEdit(page, "POST");

    expect(payload.schedule, "schedule should be in the payload").toBeTruthy();
    expect(payload.schedule.timezone).toBeTruthy();
    expect(payload.schedule.windows).toEqual([
      { days: ["mon", "tue", "wed", "thu", "fri"], start: "08:00", end: "17:00" },
    ]);
    expect(payload.schedule.start_date).toBe("2030-01-01");
    expect(payload.schedule).not.toHaveProperty("end_date");

    await resetServiceFilters(page);
    await expect(
      page.locator("tr").filter({ hasText: subdomain }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("Should show the saved schedule when the service is reopened", async ({
    dashboardAsOwner: page,
  }) => {
    test.setTimeout(60_000);
    await gotoReverseProxyPage(page, "/reverse-proxy/services");
    await resetServiceFilters(page);
    await openServiceEdit(page, subdomain);
    await openSettingsTab(page);

    await expect(page.getByTestId("schedule-editor")).toBeVisible({
      timeout: 10_000,
    });
    const firstWindow = page.getByTestId("schedule-window-0");
    await expect(firstWindow.getByTestId("schedule-window-start")).toHaveValue(
      "08:00",
    );
    await expect(firstWindow.getByTestId("schedule-window-end")).toHaveValue(
      "17:00",
    );
    await expect(page.getByTestId("schedule-start-date")).toHaveValue(
      "2030-01-01",
    );
    await expect(page.getByTestId("schedule-day-mon")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("schedule-day-sat")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await page.keyboard.press("Escape");
  });

  test("Should block saving an invalid window and accept midnight as the end", async ({
    dashboardAsOwner: page,
  }) => {
    test.setTimeout(60_000);
    await gotoReverseProxyPage(page, "/reverse-proxy/services");
    await resetServiceFilters(page);
    await openServiceEdit(page, subdomain);
    await openSettingsTab(page);

    const firstWindow = page.getByTestId("schedule-window-0");
    await firstWindow.getByTestId("schedule-window-end").fill("07:00");
    await expect(page.getByTestId("schedule-window-error")).toBeVisible();
    await expect(page.getByTestId("proxy-save")).toBeDisabled();

    // 00:00 means until midnight, which the API spells 24:00.
    await firstWindow.getByTestId("schedule-window-end").fill("00:00");
    await expect(page.getByTestId("schedule-window-error")).toHaveCount(0);
    await expect(page.getByTestId("proxy-save")).toBeEnabled();

    const payload = await saveEdit(page, "PUT");
    expect(payload.schedule.windows[0].end).toBe("24:00");
  });

  test("Should remove the schedule by switching it off", async ({
    dashboardAsOwner: page,
  }) => {
    test.setTimeout(60_000);
    await gotoReverseProxyPage(page, "/reverse-proxy/services");
    await resetServiceFilters(page);
    await openServiceEdit(page, subdomain);
    await openSettingsTab(page);

    await page.getByTestId("toggle-schedule").click();
    await expect(page.getByTestId("schedule-editor")).toHaveCount(0);

    // The PUT replaces the service, so leaving the field out clears it.
    const payload = await saveEdit(page, "PUT");
    expect(payload).not.toHaveProperty("schedule");
  });

  test("Should clean up the service and network", async ({
    dashboardAsOwner: page,
  }) => {
    await deleteServicesByPrefix(page, "schedule-svc-");
    await deleteNetworksByPrefix(page, network);
  });
});
