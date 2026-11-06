import { describe, expect, it } from "vitest";
import { selectSpeechVoice, speechLanguageTag } from "./voices";

type Voice = {
  name: string;
  lang: string;
  localService: boolean;
};

function voice(name: string, lang: string, localService: boolean): Voice {
  return { name, lang, localService };
}

describe("selectSpeechVoice", () => {
  it("prefers a local voice in the requested language", () => {
    const voices = [
      voice("remote-en", "en-US", false),
      voice("local-en", "en-GB", true),
      voice("local-es", "es-ES", true),
    ];

    expect(selectSpeechVoice(voices, "en")?.name).toBe("local-en");
    expect(selectSpeechVoice(voices, "es")?.name).toBe("local-es");
  });

  it("falls back to a remote voice when there is no local one", () => {
    const voices = [voice("remote-en", "en-US", false)];

    expect(selectSpeechVoice(voices, "en")?.name).toBe("remote-en");
  });

  it("does not mix languages", () => {
    const voices = [voice("local-es", "es-ES", true)];

    expect(selectSpeechVoice(voices, "en")).toBeNull();
  });

  it("returns null when there are no voices", () => {
    expect(selectSpeechVoice([], "en")).toBeNull();
  });
});

describe("speechLanguageTag", () => {
  it("maps each language to its BCP-47 tag", () => {
    expect(speechLanguageTag("en")).toBe("en-US");
    expect(speechLanguageTag("es")).toBe("es-ES");
  });
});
