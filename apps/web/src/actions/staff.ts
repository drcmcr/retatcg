"use server";
import { redirect } from "next/navigation";
import { callCore, callRpc, type ActionResult } from "@/lib/server-action";

export async function createTournament(payload: Record<string, unknown>, publish: boolean): Promise<ActionResult> {
  const r = await callRpc<string>("create_tournament", { p: payload });
  if (!r.ok) return r;
  if (publish) {
    const p = await callRpc<string>("publish_tournament", { p_id: r.data });
    if (!p.ok) return p;
  }
  redirect(`/staff/torneo/${r.data}`);
}
export async function updateTournament(id: string, payload: Record<string, unknown>) { return callRpc("update_tournament", { p_id: id, p: payload }); }
export async function publishTournament(id: string) { return callRpc<string>("publish_tournament", { p_id: id }); }
export async function approveTournament(id: string, approve: boolean) { return callRpc("approve_tournament", { p_id: id, p_approve: approve }); }
export async function cancelTournament(id: string) { return callRpc("cancel_tournament", { p_id: id }); }
export async function startTournament(id: string) { return callCore("start", id); }
export async function nextRound(id: string) { return callCore("next", id); }
export async function setAnnouncement(id: string, text: string) { return callRpc("set_announcement", { p_tournament: id, p_text: text }); }
export async function addStaff(id: string, username: string, role: "judge" | "organizer") { return callRpc("add_staff", { p_tournament: id, p_username: username, p_role: role }); }
export async function removeStaff(id: string, userId: string) { return callRpc("remove_staff", { p_tournament: id, p_user: userId }); }
export async function addGuest(id: string, name: string) { return callRpc("add_guest", { p_tournament: id, p_name: name }); }
export async function staffRegistration(regId: string, action: "checkin" | "drop" | "remove") { return callRpc("staff_registration", { p_registration: regId, p_action: action }); }
export async function roundClock(roundId: string, action: "pausar" | "reanudar" | "agregar", minutes = 5) {
  return callRpc("staff_round_clock", { p_round: roundId, p_action: action, p_minutes: minutes });
}
export async function staffMatch(matchId: string, action: "recordar" | "extender" | "repetir", hours = 12) {
  return callRpc("staff_match", { p_match: matchId, p_action: action, p_hours: hours });
}
export async function setResult(matchId: string, a: number, b: number, d: number, doubleLoss: boolean, reason: string) {
  return callRpc("staff_set_result", { p_match: matchId, p_games_a: a, p_games_b: b, p_draws: d, p_double_loss: doubleLoss, p_reason: reason });
}
export async function staffNoShow(matchId: string, absentRegId: string) { return callRpc("staff_no_show", { p_match: matchId, p_absent: absentRegId }); }
export async function judgeMessage(caseId: number, body: string) { return callRpc("judge_message", { p_case: caseId, p_body: body }); }
export async function resolveCase(caseId: number, resolution: string) { return callRpc("resolve_case", { p_case: caseId, p_resolution: resolution }); }
export async function addSanction(userId: string, tournamentId: string, kind: string, reason: string, pr: number, days: number) {
  return callRpc("add_sanction", { p_user: userId, p_tournament: tournamentId, p_kind: kind, p_reason: reason, p_pr_penalty: pr, p_days: days });
}
export async function reviewDeck(declId: string, approve: boolean, note?: string) { return callRpc("review_deck", { p_declaration: declId, p_approve: approve, p_note: note ?? null }); }
export async function setPlatformRole(username: string, role: "organizer" | "superadmin", grant: boolean) {
  return callRpc("set_platform_role", { p_username: username, p_role: role, p_grant: grant });
}
export async function handleModReport(id: number, status: "resolved" | "dismissed") { return callRpc("handle_mod_report", { p_report: id, p_status: status }); }
export async function moderateRename(userId: string) { return callRpc<string>("moderate_rename", { p_user: userId }); }
export async function addBlockedTerm(term: string, kind: string, fields: string[], wholeWord: boolean) {
  return callRpc<number>("admin_add_term", { p_term: term, p_kind: kind, p_fields: fields, p_whole_word: wholeWord });
}
export async function removeBlockedTerm(id: number) { return callRpc("admin_remove_term", { p_id: id }); }
export async function testText(text: string, field: string) { return callRpc<string | null>("admin_test_text", { p_text: text, p_field: field }); }
export async function adminRenameTournament(code: string, name: string) { return callRpc("admin_rename_tournament", { p_code: code, p_name: name }); }
export async function adminRenameClub(oldName: string, newName: string) { return callRpc<number>("admin_rename_club", { p_old: oldName, p_new: newName }); }
