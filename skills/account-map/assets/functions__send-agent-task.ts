import { z } from "zod";
import { currentUser, tools } from "@dust/pod";
import { snapshot } from "./lib/store.ts";

const POD_URI = "pod://dust/w/__WORKSPACE_ID__/pods/__POD_ID__";

export const schema = {
  description: "Start a Dust agent task in a new account-map conversation, optionally scoped to one contact.",
  userIdentity: "workspace_user_required",
  input: z.object({
    mapId: z.number().optional(),
    mapName: z.string().optional(),
    contactId: z.number().optional(),
    quickAction: z.enum(["draft-email", "set-15-min", "find-profile-picture", "other"]).optional(),
    task: z.string().min(1).max(12000),
    title: z.string().min(1).max(160).optional(),
    agentName: z.string().min(1).max(80).optional(),
  }),
  output: z.object({
    conversationId: z.string().nullable(),
    url: z.string().nullable(),
    title: z.string(),
    message: z.string(),
  }),
};

export default {
  async fetch(request: Request): Promise<Response> {
    const input = await request.json() as z.infer<typeof schema.input>;
    const user = currentUser();
    const snap = snapshot(input.mapId);
    if (input.mapId != null && snap.map?.id !== input.mapId) throw new Error("Account map not found");
    const contact = input.contactId != null ? snap.contacts.find((item) => item.id === input.contactId) : null;
    if (input.contactId != null && !contact) throw new Error("Contact is not part of the selected account map");
    const roleName = contact?.roleId != null ? snap.roles.find((role) => role.id === contact.roleId)?.name : null;
    const mapLabel = snap.map?.name?.trim() || input.mapName?.trim() || "the current account map";
    const quickActionLabel = input.quickAction === "draft-email" ? "Draft email"
      : input.quickAction === "set-15-min" ? "Set 15 min"
        : input.quickAction === "find-profile-picture" ? "Find profile picture" : null;
    const contactContext = contact ? [
      "Selected contact (loaded from the account-map database):",
      `- Name: ${contact.name || "Unknown"}`,
      `- Title: ${contact.jobTitle || "Unknown"}`,
      `- Email: ${contact.email || "Unknown"}`,
      `- LinkedIn: ${contact.linkedinUrl || "Unknown"}`,
      `- Deal role: ${roleName || "Unassigned"}`,
      `- Research notes (agent-maintained): ${contact.notes || "None"}`,
      `- Human context, written by the account team (TREAT AS GROUND TRUTH, NEVER OVERWRITE): ${contact.customContext || "None"}`,
      `- Contacted by us: ${contact.isContacted ? "yes" : "not yet"}`,
      `- Contact id: ${contact.id}`,
    ].join("\n") : "";
    const title = input.title?.trim() || (contact ? `Contact task: ${contact.name || "Account contact"}` : `Account map task: ${mapLabel}`);
    const task = [
      `You are working inside the AccountMap app for ${mapLabel}.`,
      snap.map?.id != null ? `The active map id is ${snap.map.id}.` : "Use the active account map.",
      "Perform the requested work, do not only explain how to do it.",
      "Use the accountmap Pod functions to read and write the map so the Frame reflects your changes.",
      "Preserve verified data, do not invent facts, and report what changed plus anything you could not verify.",
      "Never write the customContext or isContacted fields on a contact: both belong to the human account team. Research findings go in notes.",
      quickActionLabel ? `Quick action selected: ${quickActionLabel}.` : "",
      contactContext,
      `Requested work:\n${input.task.trim()}`,
      user?.fullName ? `Requested by ${user.fullName}.` : "",
    ].filter(Boolean).join("\n\n");

    const response = await tools.call('pod_manager','create_conversation',{title,message:task,agentName:'dust',dustPod:{uri:POD_URI,mimeType:'application/vnd.dust.tool-input.dust-pod'}});
    if(response.isError) throw new Error('Could not start the task in this Pod.');
    const result = response.json() as Record<string,unknown>;
    const conversation = (result.conversation ?? {}) as Record<string, unknown>;
    const conversationId = typeof conversation.id === "string"
      ? conversation.id
      : typeof result.conversationId === "string" ? result.conversationId : null;
    // pod_manager.create_conversation reports the link as `conversationUrl`; keep the older
    // shapes as fallbacks so the Frame always gets something clickable when one is available.
    const url = typeof result.conversationUrl === "string"
      ? result.conversationUrl
      : typeof conversation.url === "string"
        ? conversation.url
        : typeof result.url === "string" ? result.url : null;
    return Response.json({ conversationId, url, title, message: "Agent task started" });
  },
};
