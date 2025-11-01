import { test, expect } from "@playwright/test";

async function getPlayer(page: any) {
  return await page.evaluate(() => window.playerState);
}

test.describe("Collision and movement across cake tiers", () => {
  test("move forward, turn, jump, and validate ground contact changes", async ({
    page,
  }) => {
    await page.goto("/");

    // Focus the page to receive keyboard events
    await page.click("canvas");

    // Wait for player state to be available
    await page.waitForFunction(() => !!window.playerState);

    // Initial ground state should become true shortly after landing
    await expect
      .poll(async () => (await getPlayer(page)).onGround, {
        message: "Player should be on ground after spawn",
      })
      .toBeTruthy();

    // Hold W to move forward for 1.5s
    await page.keyboard.down("w");
    await page.waitForTimeout(1500);
    await page.keyboard.up("w");

    const afterForward = await getPlayer(page);
    expect(typeof afterForward.position.x).toBe("number");

    // Turn right while on ground for 0.8s
    await page.keyboard.down("d");
    await page.waitForTimeout(800);
    await page.keyboard.up("d");

    // Move again for 1s
    await page.keyboard.down("w");
    await page.waitForTimeout(1000);
    await page.keyboard.up("w");

    // Jump
    await page.keyboard.press("space");

    // Ensure we leave the ground briefly
    await expect.poll(async () => (await getPlayer(page)).onGround).toBeFalsy();

    // Wait to land back
    await expect
      .poll(async () => (await getPlayer(page)).onGround)
      .toBeTruthy();

    // Sanity: y should be around one of our tiers (-4,-2.5,-1,1.5,3)
    const y = (await getPlayer(page)).position.y;
    expect(y).toBeGreaterThan(-10);
    expect(y).toBeLessThan(10);
  });

  test("test tipping physics when moving to edge", async ({ page }) => {
    await page.goto("/");

    // Focus the page to receive keyboard events
    await page.click("canvas");

    // Wait for player state to be available
    await page.waitForFunction(() => !!window.playerState);

    // Wait for landing
    await expect
      .poll(async () => (await getPlayer(page)).onGround, {
        message: "Player should be on ground after spawn",
      })
      .toBeTruthy();

    // Move to edge of tier (forward for 2s to reach edge)
    await page.keyboard.down("w");
    await page.waitForTimeout(2000);
    await page.keyboard.up("w");

    // Check if player has tilt values (indicating tipping physics is working)
    const playerState = await getPlayer(page);
    expect(playerState.tilt).toBeDefined();
    expect(typeof playerState.tilt.x).toBe("number");
    expect(typeof playerState.tilt.z).toBe("number");

    // If player is still on ground, try moving more to trigger tipping
    if (playerState.onGround) {
      await page.keyboard.down("w");
      await page.waitForTimeout(1000);
      await page.keyboard.up("w");

      // Check if player fell off (tipping should cause falling)
      const finalState = await getPlayer(page);
      // Either player should have fallen or have significant tilt
      const hasSignificantTilt =
        Math.abs(finalState.tilt.x) > 0.1 || Math.abs(finalState.tilt.z) > 0.1;
      const hasFallen = !finalState.onGround;

      expect(hasSignificantTilt || hasFallen).toBeTruthy();
    }
  });
});
