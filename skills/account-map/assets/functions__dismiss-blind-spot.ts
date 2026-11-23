// Database: accountmap
import { z } from "zod";
import { blindSpots, blindSpotZ, db, DB, eq, getBlindSpot } from "./lib/store.ts";

export const schema = {
  description:
    "Dismiss a blind spot, or restore a dismissed one. A dismissed spot stays out of the map and is not revived by a later scan.",
  userIdentity: "workspace_user_required",
  input: z.object({ id: z.number(), dismissed: z.boolean().optional() }).strict(),
  output: z.object({ blindSpot: blindSpotZ }),
};

export default {
  async fetch(request: Request): Promise<Response> {
    const { id, dismissed = true } = await request.json();
    const spot = getBlindSpot(id);
    if (!spot) return Response.json({ error: `No blind spot with id ${id}` }, { status: 404 });
    db(DB).update(blindSpots)
      .set({ status: dismissed ? "dismissed" : "open", updatedAt: new Date() })
      .where(eq(blindSpots.id, id)).run();
    return Response.json({ blindSpot: getBlindSpot(id) });
  },
};
