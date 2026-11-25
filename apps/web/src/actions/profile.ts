"use server";
import { callRpc } from "@/lib/server-action";

export async function updateUsername(name: string) { return callRpc("update_username", { p_username: name.trim() }); }
export async function setTitle(medal: string | null, form: "a" | "b" = "a") { return callRpc("set_title", { p_medal: medal, p_form: form }); }
export async function setPrivateProfile(v: boolean) { return callRpc("set_private_profile", { p_private: v }); }
export async function updatePrivateData(pocketName: string, friendId: string, timezone: string, notify?: Record<string, boolean>, reduceMotion?: boolean) {
  return callRpc("update_private_data", { p_pocket_name: pocketName, p_friend_id: friendId, p_timezone: timezone, p_notify: notify ?? null, p_reduce_motion: reduceMotion ?? null });
}
export async function requestDeletion() { return callRpc<string>("request_account_deletion"); }
export async function cancelDeletion() { return callRpc("cancel_account_deletion"); }
export async function exportMyData() { return callRpc<Record<string, unknown>>("export_my_data"); }
export async function follow(userId: string) { return callRpc("follow", { p_user: userId }); }
export async function unfollow(userId: string) { return callRpc("unfollow", { p_user: userId }); }
export async function blockUser(userId: string) { return callRpc("block_user", { p_user: userId }); }
export async function unblockUser(userId: string) { return callRpc("unblock_user", { p_user: userId }); }
export async function reportUser(userId: string, kind: string, detail?: string) { return callRpc("report_user", { p_user: userId, p_kind: kind, p_detail: detail ?? null }); }
export async function markRead(ids?: number[]) { return callRpc("mark_notifications_read", { p_ids: ids ?? null }); }
export async function savePush(endpoint: string, p256dh: string, auth: string) { return callRpc("save_push_subscription", { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth }); }
export async function deletePush(endpoint: string) { return callRpc("delete_push_subscription", { p_endpoint: endpoint }); }
export async function pushPublicKey() { return callRpc<string | null>("push_public_key"); }
