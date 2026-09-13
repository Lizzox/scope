import { describe, expect, it } from "vitest";
import { transcriptFromVtt } from "./transcript";

describe("Teams transcript normalization", () => {
  it("keeps speaker text and removes VTT timing metadata", () => {
    expect(
      transcriptFromVtt(
        "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<v Nikita>Hallo Scope</v>\n\n00:00:04.000 --> 00:00:05.000\nNächster Punkt",
      ),
    ).toBe("Nikita: Hallo Scope\nNächster Punkt");
  });
});
