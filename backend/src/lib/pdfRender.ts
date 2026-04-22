import { pdf } from "pdf-to-img";

export type RenderOptions = {
  scale?: number;
};

export async function renderPdfToPngs(
  input: string | Buffer,
  opts: RenderOptions = {},
): Promise<Buffer[]> {
  const doc = await pdf(input, { scale: opts.scale ?? 2 });
  const pages: Buffer[] = [];
  for await (const page of doc) {
    pages.push(Buffer.from(page));
  }
  return pages;
}
