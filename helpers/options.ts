export function parseOptions(optionTexts: string[]) {
  return Object.fromEntries(
    optionTexts.map((text) => {
      const [key, ...valueParts] = text.split(":");
      return [key.trim(), valueParts.join(":").trim().replace(/\s+/g, " ")];
    }),
  );
}
