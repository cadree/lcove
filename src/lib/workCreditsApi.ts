import { callRpc } from "@/lib/rpc";
import type { PostCredit, WorkCredit } from "@/lib/workCredits";

export const workCreditsApi = {
  forProfile: (userId: string) => callRpc<WorkCredit[]>("profile_credits", { p_user: userId }),
  forPost: (postId: string) => callRpc<PostCredit[]>("post_credits", { p_post: postId }),
  creditOnPost: (postId: string, userId: string, role: string) =>
    callRpc<{ id: string; status: string; role: string; created: boolean }>("credit_post", { p_post: postId, p_user: userId, p_role: role }),
  removeFromPost: (creditId: string) => callRpc<null>("remove_post_credit", { p_credit: creditId }),
  respond: (creditId: string, show: boolean) => callRpc<string>("respond_work_credit", { p_credit: creditId, p_show: show }),
};
