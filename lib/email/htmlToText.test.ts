import { describe, expect, it } from "vitest";
import { htmlToText } from "./htmlToText";

describe("htmlToText", () => {
  it("turns paragraphs and line breaks into newlines and drops tags", () => {
    expect(htmlToText("<p>Hei Ola,</p><p>Takk!</p>Med hilsen,<br/>Otman")).toBe("Hei Ola,\n\nTakk!\n\nMed hilsen,\nOtman");
  });

  it("keeps a button's target visible as 'label: url'", () => {
    expect(htmlToText('<a href="https://otman.no/betaling/abc" style="x">Betal nå</a>')).toBe("Betal nå: https://otman.no/betaling/abc");
  });

  it("decodes the entities the email builders emit", () => {
    expect(htmlToText("<p>Ola &amp; Kari said &quot;hi&quot; &#039;ok&#039; &lt;3</p>")).toBe(`Ola & Kari said "hi" 'ok' <3`);
  });

  it("drops images and collapses runs of blank lines", () => {
    expect(htmlToText('<p>A</p><img src="x"/><p></p><p></p><p>B</p>')).toBe("A\n\nB");
  });
});
