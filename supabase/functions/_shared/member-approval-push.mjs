/**
 * "Your account was approved" phone push for a newly accepted member.
 * ether_enqueue_member_approval_push queues one job per acceptance event;
 * this drains member_approval_pushes. Tapping the push opens Explore people.
 */
export const APPROVAL_PUSH_PATH = "/explore?section=people";
const QUEUE = "member_approval_pushes";
const MAX_READS = 5;

/**
 * How a send-push-notification response should settle a job:
 * "done" when a device got it, or when there is nothing to retry (no devices
 * on file, push switched off); "retry" when a device was there but the send failed.
 */
export function approvalPushOutcome(response) {
  if (!response || typeof response !== "object" || response.error) return "retry";
  if (typeof response.sent === "number" && response.sent > 0) return "done";
  const results = Array.isArray(response.results) ? response.results : [];
  return results.some((row) => row?.status === "failed") ? "retry" : "done";
}

export function approvalPushPayload(applicant) {
  const first = String(applicant.display_name || "").trim().split(/\s+/)[0];
  return {
    user_id: applicant.user_id,
    title: "You're approved",
    body: `${first ? `Welcome to ETHER, ${first.slice(0, 40)}. ` : "Welcome to ETHER. "}Tap to meet creatives near you.`,
    url: APPROVAL_PUSH_PATH,
    notification_type: "membership_accepted",
    data: { applicant_id: applicant.user_id },
  };
}

export async function dispatchMemberApprovalPushes({ supabase, deliverPush, logger = console }) {
  const { data: jobs, error: readError } = await supabase.rpc("read_email_batch", {
    queue_name: QUEUE,
    batch_size: 10,
    vt: 90,
  });
  if (readError) {
    logger.error("Could not read member approval push queue", readError);
    return;
  }

  for (const job of jobs ?? []) {
    const applicantId = job.message?.applicant_id;
    const acknowledge = async () => {
      const { error } = await supabase.rpc("delete_email", { queue_name: QUEUE, message_id: job.msg_id });
      if (error) logger.error("Could not acknowledge member approval push", error);
    };
    const giveUpOrWait = async () => {
      if ((job.read_ct ?? 0) < MAX_READS) return; // visibility timeout brings it back
      const { error } = await supabase.rpc("move_to_dlq", {
        source_queue: QUEUE,
        dlq_name: `${QUEUE}_dlq`,
        message_id: job.msg_id,
        payload: job.message,
      });
      if (error) logger.error("Could not move approval push job to dead-letter queue", error);
    };

    if (typeof applicantId !== "string" || !/^[0-9a-f-]{36}$/i.test(applicantId)) {
      await acknowledge();
      continue;
    }

    try {
      const { data: applicant, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, onboarding_completed, access_status")
        .eq("user_id", applicantId)
        .maybeSingle();
      if (error) throw error;
      // Approval was reversed (or the account is gone) before the push went out.
      if (!applicant || applicant.access_status !== "active" || applicant.onboarding_completed !== true) {
        await acknowledge();
        continue;
      }
      const response = await deliverPush(approvalPushPayload(applicant));
      if (approvalPushOutcome(response) === "done") await acknowledge();
      else await giveUpOrWait();
    } catch (error) {
      logger.error("Member approval push dispatch failed", { applicantId, error });
      await giveUpOrWait();
    }
  }
}
