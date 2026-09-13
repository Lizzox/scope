export function transcriptFromVtt(value: string) {
  return value
    .replace(/^WEBVTT[^\n]*\n+/i, "")
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split("\n")
        .filter((line) => !/^\d\d:\d\d/.test(line) && !/^\d+$/.test(line))
        .join(" ")
        .replace(/<v(?:\.[^ >]+)?\s+([^>]+)>(.*?)<\/v>/gi, "$1: $2")
        .replace(/<[^>]+>/g, "")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}
