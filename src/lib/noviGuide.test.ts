import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NOVI_GUIDE, NOVI_GUIDE_FALLBACK } from "../content/noviGuide.ts";
import { searchGuide } from "./noviGuide.ts";

describe("novi guide search", () => {
  it("returns the typed list when the query is empty", () => {
    assert.deepEqual(
      searchGuide("").map((entry) => entry.id),
      NOVI_GUIDE.map((entry) => entry.id),
    );
    assert.deepEqual(
      searchGuide("  the ").map((entry) => entry.id),
      NOVI_GUIDE.map((entry) => entry.id),
    );
  });

  it("ranks the matching how-to first", () => {
    assert.equal(searchGuide("how do I post")[0]?.id, "post");
    assert.equal(searchGuide("go live")[0]?.id, "live");
    assert.equal(searchGuide("earn XP")[0]?.id, "xp");
    assert.equal(searchGuide("repost")[0]?.id, "share");
    assert.equal(searchGuide("studio rental")[0]?.id, "store");
    assert.equal(searchGuide("get paid")[0]?.id, "paid");
    assert.equal(searchGuide("report someone")[0]?.id, "report");
  });

  it("points nowhere when nothing matches", () => {
    assert.deepEqual(searchGuide("zzzz-nope"), []);
    assert.equal(NOVI_GUIDE_FALLBACK.helpHref, "/guidelines");
    assert.equal(NOVI_GUIDE_FALLBACK.reportLabel, "Report");
    assert.match(NOVI_GUIDE_FALLBACK.message, /help/i);
    assert.match(NOVI_GUIDE_FALLBACK.message, /report/i);
  });
});
