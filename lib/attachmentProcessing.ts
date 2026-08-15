import type { ChatImageAttachment } from "./types";

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_PDF_PAGES_PER_MESSAGE = 6;

export type PreparedAttachmentSet = {
  images: ChatImageAttachment[];
  imagePayloads: { base64Image: string }[];
  sourceNames: string[];
};

function normalizeImageForVision(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const largestSide = Math.max(image.naturalWidth, image.naturalHeight, 1);
      const scale = Math.min(1, 1280 / largestSide);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      URL.revokeObjectURL(objectUrl);
      if (!context) {
        reject(new Error(`Could not prepare ${file.name}.`));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not read ${file.name}.`));
    };
    image.src = objectUrl;
  });
}

async function renderPdfPages(file: File): Promise<ChatImageAttachment[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(await file.arrayBuffer());
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES_PER_MESSAGE);
  const rendered: ChatImageAttachment[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1.5, 1280 / Math.max(baseViewport.width, 1));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this PDF preview.");
    await page.render({ canvasContext: context, viewport }).promise;
    rendered.push({
      dataUrl: canvas.toDataURL("image/jpeg", 0.82),
      name: `${file.name} · page ${pageNumber}`,
    });
  }
  return rendered;
}

export async function prepareAttachmentsForVision(files: File[]): Promise<PreparedAttachmentSet> {
  const images: ChatImageAttachment[] = [];
  const sourceNames: string[] = [];

  for (const file of files.slice(0, MAX_ATTACHMENTS_PER_MESSAGE)) {
    if (file.type.startsWith("image/")) {
      images.push({ dataUrl: await normalizeImageForVision(file), name: file.name });
      sourceNames.push(file.name);
      continue;
    }
    if (file.type === "application/pdf") {
      const pages = await renderPdfPages(file);
      images.push(...pages);
      sourceNames.push(`${file.name}${pages.length > 1 ? ` (${pages.length} pages)` : ""}`);
    }
  }

  return {
    images,
    imagePayloads: images.map((image) => ({ base64Image: image.dataUrl })),
    sourceNames,
  };
}
