/**
 * Deliver new-member application pushes only to administrators who opt in.
 * A separate durable queue keeps this independent of the review-inbox email.
 */
export async function dispatchMemberApplicationPushes({
  supabase,
  sendPush,
  logger = console,
}) {
  const queueName = "member_application_pushes";
  const { data: jobs, error: readError } = await supabase.rpc("read_email_batch", {
    queue_name: queueName,
    batch_size: 10,
    vt: 90,
  });
  if (readError) {
    logger.error("Could not read member application push queue", readError);
    return;
  }

  for (const job of jobs ?? []) {
    const applicantId = job.message?.applicant_id;
    const acknowledge = async () => {
      const { error } = await supabase.rpc("delete_email", {
        queue_name: queueName,
        message_id: job.msg_id,
      });
      if (error) logger.error("Could not acknowledge member application push", error);
    };

    if (typeof applicantId !== "string" || !/^[0-9a-f-]{36}$/i.test(applicantId)) {
      await acknowledge();
      continue;
    }

    try {
      // Stop notifying once the applicant is no longer awaiting review.
      const { data: applicant, error: applicantError } = await supabase
        .from("profiles")
        .select("user_id, display_name, onboarding_completed, access_status")
        .eq("user_id", applicantId)
        .maybeSingle();
      if (applicantError) throw applicantError;
      if (!applicant || applicant.access_status !== "pending" || applicant.onboarding_completed !== true) {
        await acknowledge();
        continue;
      }

      const { data: admins, error: adminsError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (adminsError) throw adminsError;
      const adminIds = [...new Set((admins ?? []).map((row) => row.user_id).filter(Boolean))];
      if (!adminIds.length) {
        await acknowledge();
        continue;
      }

      const { data: preferences, error: preferencesError } = await supabase
        .from("notification_preferences")
        .select("user_id, push_enabled, new_member_applications_push_enabled")
        .in("user_id", adminIds)
        .eq("new_member_applications_push_enabled", true)
        .eq("push_enabled", true);
      if (preferencesError) throw preferencesError;

      let failed = false;
      for (const preference of preferences ?? []) {
        const adminId = preference.user_id;
        const { data: existing, error: deliveryError } = await supabase
          .from("application_push_deliveries")
          .select("admin_user_id")
          .eq("applicant_user_id", applicantId)
          .eq("admin_user_id", adminId)
          .maybeSingle();
        if (deliveryError) {
          logger.error("Could not check application push receipt", deliveryError);
          failed = true;
          continue;
        }
        if (existing) continue;

        try {
          await sendPush({
            user_id: adminId,
            title: "New ETHER membership application",
            body: `${applicant.display_name || "A creator"} is awaiting approval.`,
            url: `/admin/onboarding/${applicantId}`,
            notification_type: "member_application",
            data: { applicant_id: applicantId },
          });
          const { error: saveError } = await supabase.from("application_push_deliveries").insert({
            applicant_user_id: applicantId,
            admin_user_id: adminId,
          });
          if (saveError && saveError.code !== "23505") throw saveError;
        } catch (error) {
          logger.error("Member application push was not delivered", { applicantId, error });
          failed = true;
        }
      }

      if (!failed) await acknowledge();
      else if ((job.read_ct ?? 0) >= 5) {
        const { error: dlqError } = await supabase.rpc("move_to_dlq", {
          source_queue: queueName,
          dlq_name: `${queueName}_dlq`,
          message_id: job.msg_id,
          payload: job.message,
        });
        if (dlqError) logger.error("Could not move application push job to dead-letter queue", dlqError);
      }
    } catch (error) {
      logger.error("Member application push dispatch failed", { applicantId, error });
    }
  }
}
