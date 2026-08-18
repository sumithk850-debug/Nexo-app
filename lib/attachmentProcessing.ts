import type { ChatImageAttachment } from "./types";

export const MAX_ATTACHMENTS_PER_MESSAGE = 10;
export const MAX_PDF_PAGES_PER_MESSAGE = 6;



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

function captureVideoPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Video preview preparation timed out."));
    }, 8_000);
    video.muted = true;
    video.preload = "metadata";
    video.playsInline = true;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(Math.max(video.duration * 0.1, 0.1), 1);
    };
    video.onseeked = () => {
      window.clearTimeout(timeout);
      const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight, 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        cleanup();
        reject(new Error("Your browser could not prepare a video preview."));
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const preview = canvas.toDataURL("image/jpeg", 0.82);
      cleanup();
      resolve(preview);
    };
    video.onerror = () => {
      window.clearTimeout(timeout);
      cleanup();
      reject(new Error("Nexo could not prepare a preview for this video."));
    };
    video.src = objectUrl;
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

export type PreparedAttachmentSet = {
  images: ChatImageAttachment[];
  imagePayloads: { base64Image: string }[];
  sourceNames: string[];
  extractedText?: string;
};

export async function prepareAttachmentsForVision(files: File[]): Promise<PreparedAttachmentSet> {
  const images: ChatImageAttachment[] = [];
  const sourceNames: string[] = [];
  const textSnippets: string[] = [];

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
      continue;
    }
    if (file.type.startsWith("video/")) {
      sourceNames.push(file.name);
      try {
        const preview = await captureVideoPreview(file);
        images.push({ dataUrl: preview, name: `${file.name} · representative frame` });
        textSnippets.push(`--- VIDEO ATTACHMENT: ${file.name} ---\nA representative video frame is available for visual analysis. Audio and full-motion analysis are not available in this chat.\n--- END VIDEO ATTACHMENT ---`);
      } catch (error) {
        textSnippets.push(`--- VIDEO ATTACHMENT: ${file.name} ---\nVideo preview could not be prepared: ${error instanceof Error ? error.message : "unknown error"}. Do not claim that the video was fully read.\n--- END VIDEO ATTACHMENT ---`);
      }
      continue;
    }
    if (file.type.startsWith("audio/")) {
      sourceNames.push(file.name);
      textSnippets.push(`--- AUDIO ATTACHMENT: ${file.name} ---\nAudio transcription is not available in this chat. Do not claim that this audio was read.\n--- END AUDIO ATTACHMENT ---`);
      continue;
    }
    // For general files (code, text, markdown, json, etc.), read text content directly.
    // Binary media files are handled above so the browser never tries to decode
    // them as text and leaves a misleading long-running read status.
    try {
      const text = await file.text();
      if (text.trim()) {
        textSnippets.push(`--- FILE: ${file.name} ---\n${text.slice(0, 15000)}\n--- END FILE ---`);
        sourceNames.push(file.name);
      } else {
        sourceNames.push(file.name);
      }
    } catch {
      sourceNames.push(file.name);
    }
  }

  return {
    images,
    imagePayloads: images.map((image) => ({ base64Image: image.dataUrl })),
    sourceNames,
    extractedText: textSnippets.length > 0 ? textSnippets.join("\n\n") : undefined,
  };
}
