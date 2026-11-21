// cspell:ignore Charlote Atlnta Xyzzyville
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cityFilterOptions, cityMatchesFilter, cityMatchesQuery } from "./cityNormalization.ts";
import { resolveCity, suggestCities } from "./cities.ts";

describe("city filter grouping", () => {
  it("shows one chip for Charlotte spellings and the state written out", () => {
    const options = cityFilterOptions([
      "Charlotte",
      "Charlotte, NC",
      "Charlotte, North Carolina",
      "charlotte nc",
      "  Charlotte ,  nc ",
    ]);

    assert.deepEqual(options, [{ key: "charlotte|nc", display: "Charlotte, NC" }]);
    assert.equal(cityMatchesFilter("Charlotte", "charlotte|nc"), true);
    assert.equal(cityMatchesFilter("Charlotte, NC", "charlotte|nc"), true);
    assert.equal(cityMatchesFilter("charlotte, nc", "charlotte|nc"), true);
  });

  it("keeps an explicit different state separate and folds a bare name into the dominant city", () => {
    const options = cityFilterOptions(["Portland, OR", "Portland, ME", "Portland"]);

    assert.deepEqual(
      options.map((option) => option.display),
      ["Portland, ME", "Portland, OR"],
    );
    assert.equal(cityMatchesFilter("Portland", "portland|or"), true);
    assert.equal(cityMatchesFilter("Portland, OR", "portland|or"), true);
    assert.equal(cityMatchesFilter("Portland, ME", "portland|or"), false);
    assert.equal(cityMatchesFilter("Portland, ME", "portland|me"), true);
  });

  it("does not invent a state for an unknown or ambiguous place", () => {
    assert.equal(resolveCity("Narnia").confidence, "free");
    assert.equal(resolveCity("Narnia").city_display, "Narnia");
    assert.equal(resolveCity("Springfield").city_key, "springfield");
    assert.equal(resolveCity("Springfield, MO").city_key, "springfield|mo");
    assert.notEqual(resolveCity("Springfield").city_key, resolveCity("Springfield, IL").city_key);
  });
});

describe("fuzzy city match", () => {
  it("suggests Charlotte, NC for Charlote and folds the typo into that city", () => {
    const resolved = resolveCity("Charlote");
    assert.equal(resolved.confidence, "fuzzy");
    assert.equal(resolved.suggestion?.label, "Charlotte, NC");
    assert.equal(resolved.city_key, "charlotte|nc");

    const suggestions = suggestCities("Charlote");
    assert.equal(suggestions[0]?.label, "Charlotte, NC");

    const options = cityFilterOptions(["Charlote", "Charlotte", "Charlotte, NC"]);
    assert.deepEqual(options, [{ key: "charlotte|nc", display: "Charlotte, NC" }]);
    assert.equal(cityMatchesQuery("Charlotte, NC", "Charlote"), true);
  });

  it("suggests Atlanta, GA for Atlnta", () => {
    const resolved = resolveCity("Atlnta");
    assert.equal(resolved.confidence, "fuzzy");
    assert.equal(resolved.suggestion?.label, "Atlanta, GA");
    assert.equal(cityMatchesQuery("Atlanta", "Atlnta"), true);
    assert.equal(cityMatchesQuery("Portland, ME", "Atlnta"), false);
  });

  it("treats New York as New York City", () => {
    assert.equal(resolveCity("New York").city_key, "new york city|ny");
    assert.equal(resolveCity("NYC").city_key, resolveCity("New York City, NY").city_key);
    assert.equal(suggestCities("New York")[0]?.label, "New York City, NY");
  });

  it("keeps free text when nothing is close", () => {
    const resolved = resolveCity("Xyzzyville");
    assert.equal(resolved.confidence, "free");
    assert.equal(resolved.suggestion, null);
    assert.equal(resolved.city_key, "xyzzyville");
  });
});
