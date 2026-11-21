import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyPushSubscription } from "../../supabase/functions/_shared/apns.mjs";
import {
  apnsSubscriptionRow,
  canWriteOwnPushSubscription,
  createIosPushRegistration,
  type ApnsSubscriptionRow,
  type IosPushBridge,
} from "./iosPushRegistration.ts";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const TOKEN = "AB".repeat(32);

interface Harness {
  bridge: IosPushBridge;
  logs: unknown[][];
  permissions: () => number;
  registers: () => number;
  listenerAdds: () => number;
  saves: ApnsSubscriptionRow[];
  deliverToken: (value: string) => Promise<void>;
  failRegistration: (message: string) => void;
}

function harness(overrides: Partial<IosPushBridge> = {}): Harness {
  const logs: unknown[][] = [];
  const saves: ApnsSubscriptionRow[] = [];
  let permissions = 0;
  let registers = 0;
  let listenerAdds = 0;
  let onToken: ((token: { value: string }) => Promise<void> | void) | null = null;
  let onError: ((err: { error: string }) => void) | null = null;

  const bridge: IosPushBridge = {
    getPlatform: () => "ios",
    requestPermissions: async () => {
      permissions += 1;
      return { receive: "granted" };
    },
    addRegistrationListener: async (handler) => {
      listenerAdds += 1;
      onToken = handler;
    },
    addRegistrationErrorListener: async (handler) => {
      listenerAdds += 1;
      onError = handler;
    },
    register: async () => {
      registers += 1;
    },
    saveSubscription: async (row) => {
      saves.push(row);
      return null;
    },
    ...overrides,
  };

  return {
    bridge,
    logs,
    permissions: () => permissions,
    registers: () => registers,
    listenerAdds: () => listenerAdds,
    saves,
    deliverToken: async (value: string) => {
      assert.ok(onToken, "registration listener was not attached");
      await onToken({ value });
    },
    failRegistration: (message: string) => {
      assert.ok(onError, "registration error listener was not attached");
      onError({ error: message });
    },
  };
}

function logged(logs: unknown[][], message: string): boolean {
  return logs.some((entry) => entry[0] === message);
}

describe("push subscription write", () => {
  it("builds an apns row the sender can deliver", () => {
    const row = apnsSubscriptionRow(USER, `  ${TOKEN}  `);
    assert.ok(row);
    assert.deepEqual(row, {
      user_id: USER,
      endpoint: `apns:${TOKEN}`,
      p256dh: "apns",
      auth: "apns",
      platform: "apns",
      user_agent: "capacitor-ios",
    });
    assert.deepEqual(classifyPushSubscription(row.platform, row.endpoint), {
      channel: "apns",
      action: "send",
      token: TOKEN,
    });
  });

  it("rejects a token that is not hex", () => {
    assert.equal(apnsSubscriptionRow(USER, "not a token"), null);
    assert.equal(apnsSubscriptionRow("", TOKEN), null);
  });

  it("allows a normal user to insert and update only their own row", () => {
    assert.equal(canWriteOwnPushSubscription(USER, USER), true);
    assert.equal(canWriteOwnPushSubscription(OTHER, USER), false);
    assert.equal(canWriteOwnPushSubscription(null, USER), false);
    assert.equal(canWriteOwnPushSubscription(undefined, USER), false);
    assert.equal(canWriteOwnPushSubscription("", USER), false);
  });
});

describe("iOS push registration", () => {
  it("does nothing off the native iOS app", async () => {
    const fake = harness({ getPlatform: () => "web" });
    const registration = createIosPushRegistration(fake.bridge, (...entry) => fake.logs.push(entry));
    await registration.register(USER);
    assert.equal(fake.permissions(), 0);
    assert.equal(fake.registers(), 0);
    assert.equal(fake.saves.length, 0);
  });

  it("logs a denied permission and does not throw", async () => {
    const fake = harness({
      requestPermissions: async () => {
        return { receive: "denied" };
      },
    });
    const registration = createIosPushRegistration(fake.bridge, (...entry) => fake.logs.push(entry));
    await registration.register(USER);
    assert.equal(logged(fake.logs, "APNs permission not granted"), true);
    assert.equal(fake.registers(), 0);
    assert.equal(fake.saves.length, 0);
    assert.equal(fake.listenerAdds(), 0);
  });

  it("logs a thrown registration failure and does not throw", async () => {
    const fake = harness({
      register: async () => {
        throw new Error("plugin missing");
      },
    });
    const registration = createIosPushRegistration(fake.bridge, (...entry) => fake.logs.push(entry));
    await registration.register(USER);
    assert.equal(logged(fake.logs, "iOS push registration failed"), true);
    assert.equal(fake.saves.length, 0);
  });

  it("logs the registration error callback", async () => {
    const fake = harness();
    const registration = createIosPushRegistration(fake.bridge, (...entry) => fake.logs.push(entry));
    await registration.register(USER);
    fake.failRegistration("registration unavailable");
    assert.equal(logged(fake.logs, "APNs registration failed"), true);
    assert.equal(
      fake.logs.find((entry) => entry[0] === "APNs registration failed")?.[1],
      "registration unavailable",
    );
  });

  it("saves one apns row for the signed-in user and skips a repeat call", async () => {
    const fake = harness();
    const registration = createIosPushRegistration(fake.bridge, (...entry) => fake.logs.push(entry));
    await registration.register(USER);
    await fake.deliverToken(TOKEN);
    assert.equal(fake.saves.length, 1);
    assert.equal(fake.saves[0].platform, "apns");
    assert.equal(fake.saves[0].user_id, USER);
    assert.equal(fake.saves[0].endpoint, `apns:${TOKEN}`);
    assert.equal(JSON.stringify(fake.logs).includes(TOKEN), false);

    await registration.register(USER);
    assert.equal(fake.permissions(), 1);
    assert.equal(fake.registers(), 1);
    assert.equal(fake.saves.length, 1);
  });

  it("does not prompt again while the first registration is still in flight", async () => {
    let release: (permission: { receive: string }) => void = () => {};
    let permissions = 0;
    const fake = harness({
      requestPermissions: () => {
        permissions += 1;
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    });
    const registration = createIosPushRegistration(fake.bridge, (...entry) => fake.logs.push(entry));
    const first = registration.register(USER);
    const second = registration.register(USER);
    release({ receive: "denied" });
    await Promise.all([first, second]);
    assert.equal(permissions, 1);
    assert.equal(logged(fake.logs, "APNs permission not granted"), true);
  });

  it("does not ask again after the system registration has started", async () => {
    const fake = harness();
    const registration = createIosPushRegistration(fake.bridge, (...entry) => fake.logs.push(entry));
    await registration.register(USER);
    await registration.register(USER);
    assert.equal(fake.permissions(), 1);
    assert.equal(fake.registers(), 1);
    assert.equal(fake.listenerAdds(), 2);
  });

  it("retries after a rejected token or a failed save", async () => {
    let saveError: string | null = "new row violates row-level security policy";
    const fake = harness({
      saveSubscription: async (row) => {
        fake.saves.push(row);
        return saveError;
      },
    });
    const registration = createIosPushRegistration(fake.bridge, (...entry) => fake.logs.push(entry));

    await registration.register(USER);
    await fake.deliverToken("not a token");
    assert.equal(fake.saves.length, 0);
    assert.equal(logged(fake.logs, "APNs token rejected before save"), true);

    await registration.register(USER);
    await fake.deliverToken(TOKEN);
    assert.equal(logged(fake.logs, "Failed to store APNs token"), true);
    assert.equal(fake.permissions(), 2);

    saveError = null;
    await registration.register(USER);
    await fake.deliverToken(TOKEN);
    assert.equal(fake.saves.at(-1)?.platform, "apns");
    assert.equal(fake.saves.at(-1)?.user_id, USER);
    assert.equal(fake.permissions(), 3);
  });

  it("attaches listeners once when a second account signs in", async () => {
    const fake = harness();
    const registration = createIosPushRegistration(fake.bridge, (...entry) => fake.logs.push(entry));
    await registration.register(USER);
    await fake.deliverToken(TOKEN);
    const addsAfterFirst = fake.listenerAdds();
    await registration.register(OTHER);
    await fake.deliverToken(TOKEN);
    assert.equal(fake.listenerAdds(), addsAfterFirst);
    assert.equal(fake.saves[1].user_id, OTHER);
    assert.equal(fake.saves[1].platform, "apns");
  });
});
