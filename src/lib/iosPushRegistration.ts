/**
 * APNs device-token registration for the Capacitor iOS app.
 * The bridge is injectable so tests can cover permission denial, registration
 * failure, and the push_subscriptions write without a phone.
 */

export interface ApnsSubscriptionRow {
  user_id: string;
  endpoint: string;
  p256dh: "apns";
  auth: "apns";
  platform: "apns";
  user_agent: "capacitor-ios";
}

/**
 * Row stored for the send-push-notification APNs path.
 * Returns null when the token is not hex, so a bad callback is not written.
 */
export function apnsSubscriptionRow(userId: string, deviceToken: string): ApnsSubscriptionRow | null {
  const token = deviceToken.trim();
  if (!userId || !/^[0-9a-fA-F]+$/.test(token)) return null;
  return {
    user_id: userId,
    endpoint: `apns:${token}`,
    p256dh: "apns",
    auth: "apns",
    platform: "apns",
    user_agent: "capacitor-ios",
  };
}

/**
 * push_subscriptions row level security for a normal session.
 * INSERT checks auth.uid() = user_id. UPDATE for authenticated does too.
 * An upsert needs both. Anon has no uid, so the write fails closed.
 */
export function canWriteOwnPushSubscription(
  authUid: string | null | undefined,
  rowUserId: string,
): boolean {
  return typeof authUid === "string" && authUid.length > 0 && authUid === rowUserId;
}

export interface IosPushBridge {
  getPlatform(): string;
  /** Current permission without showing the system prompt. */
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  addRegistrationListener(handler: (token: { value: string }) => Promise<void> | void): Promise<void>;
  addRegistrationErrorListener(handler: (err: { error: string }) => void): Promise<void>;
  register(): Promise<void>;
  saveSubscription(row: ApnsSubscriptionRow): Promise<string | null>;
}

export interface IosPushRegisterOptions {
  /**
   * Show the iOS permission prompt when the user has not been asked yet.
   * False only registers when permission is already granted. A denied
   * permission never prompts again either way.
   */
  prompt?: boolean;
}

export interface IosPushRegistration {
  register(userId: string, options?: IosPushRegisterOptions): Promise<void>;
}

/** Permission states where iOS would still show its prompt. */
export function iosPushCanPrompt(receive: string): boolean {
  return receive === "prompt" || receive === "prompt-with-rationale";
}

export function createIosPushRegistration(
  bridge: IosPushBridge,
  log: (message: string, detail?: unknown) => void = console.error,
): IosPushRegistration {
  let listenersReady: Promise<void> | null = null;
  let savedForUserId: string | null = null;
  let startedForUserId: string | null = null;
  let currentUserId: string | null = null;
  let active: { userId: string; prompt: boolean; promise: Promise<void> } | null = null;

  async function onToken(token: { value: string }) {
    const userId = currentUserId;
    try {
      if (!userId) {
        log("APNs registration arrived with no signed-in user");
        return;
      }
      const row = apnsSubscriptionRow(userId, token.value);
      if (!row || !canWriteOwnPushSubscription(userId, row.user_id)) {
        log("APNs token rejected before save");
        if (startedForUserId === userId) startedForUserId = null;
        return;
      }
      const error = await bridge.saveSubscription(row);
      if (error) {
        log("Failed to store APNs token", error);
        if (startedForUserId === userId) startedForUserId = null;
        return;
      }
      savedForUserId = userId;
    } catch (error) {
      log("Failed to store APNs token", error);
      if (userId && startedForUserId === userId) startedForUserId = null;
    }
  }

  function onRegistrationError(err: { error: string }) {
    log("APNs registration failed", err.error);
    startedForUserId = null;
  }

  function ensureListeners(): Promise<void> {
    if (!listenersReady) {
      listenersReady = Promise.all([
        bridge.addRegistrationListener(onToken),
        bridge.addRegistrationErrorListener(onRegistrationError),
      ]).then(() => undefined).catch((error) => {
        listenersReady = null;
        throw error;
      });
    }
    return listenersReady;
  }

  async function perform(userId: string, prompt: boolean): Promise<void> {
    try {
      const current = await bridge.checkPermissions();
      if (current.receive === "denied") return;
      if (current.receive !== "granted" && !(prompt && iosPushCanPrompt(current.receive))) return;
      const permission = current.receive === "granted" ? current : await bridge.requestPermissions();
      if (permission.receive !== "granted") {
        log("APNs permission not granted", permission.receive);
        return;
      }
      currentUserId = userId;
      await ensureListeners();
      startedForUserId = userId;
      try {
        await bridge.register();
      } catch (error) {
        if (startedForUserId === userId) startedForUserId = null;
        throw error;
      }
    } catch (error) {
      log("iOS push registration failed", error);
    }
  }

  return {
    async register(userId: string, options: IosPushRegisterOptions = {}): Promise<void> {
      const prompt = options.prompt ?? true;
      if (bridge.getPlatform() !== "ios") return;
      if (!userId) return;
      if (savedForUserId === userId || startedForUserId === userId) return;
      if (active?.userId === userId && (active.prompt || !prompt)) return active.promise;

      // A quiet check still in flight must not swallow a later prompt request.
      const before = active?.userId === userId ? active.promise : Promise.resolve();
      const promise = before
        .then(() => {
          if (savedForUserId === userId || startedForUserId === userId) return;
          return perform(userId, prompt);
        })
        .finally(() => {
          if (active?.promise === promise) active = null;
        });
      active = { userId, prompt, promise };
      return promise;
    },
  };
}
