"use server";
import { callRpc } from "@/lib/server-action";

export async function tableCheckin(matchId: string) { return callRpc("table_checkin", { p_match: matchId }); }
export async function quickMessage(matchId: string, code: string) { return callRpc("quick_message", { p_match: matchId, p_code: code }); }
export async function regenPassword(matchId: string) { return callRpc<string>("regen_password", { p_match: matchId }); }
export async function reportResult(matchId: string, mine: number, theirs: number, draws: number) {
  return callRpc<string>("report_result", { p_match: matchId, p_mine: mine, p_theirs: theirs, p_draws: draws });
}
export async function confirmResult(matchId: string) { return callRpc("confirm_result", { p_match: matchId }); }
export async function disputeResult(matchId: string) { return callRpc<number>("dispute_result", { p_match: matchId }); }
export async function reportDisconnect(matchId: string, who: "yo" | "rival", returned: boolean) {
  return callRpc<string>("report_disconnect", { p_match: matchId, p_who: who, p_returned: returned });
}
export async function callJudge(matchId: string, kind: "ausente" | "conducta" | "juez") { return callRpc<number>("call_judge", { p_match: matchId, p_kind: kind }); }
export async function caseReply(caseId: number, code: string, attachment?: string) {
  return callRpc("case_reply", { p_case: caseId, p_code: code, p_attachment: attachment ?? null });
}
export async function setAvailability(matchId: string, slots: string[]) { return callRpc<string | null>("set_availability", { p_match: matchId, p_slots: slots }); }
export async function proposeTime(matchId: string, at: string) { return callRpc("propose_time", { p_match: matchId, p_at: at }); }
export async function acceptTime(matchId: string) { return callRpc("accept_time", { p_match: matchId }); }
