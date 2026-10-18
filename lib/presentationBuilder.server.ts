import pptxgen from "pptxgenjs";
import type { PresentationDescriptor, PresentationLayout, PresentationSlide } from "./presentationTypes";

const MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MAX_SLIDES = 12;
const ACCENTS = ["06B6D4", "8B5CF6", "22C55E", "F59E0B", "EC4899"];

function clean(value: string, max = 240): string {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function titleFromPrompt(prompt: string): string {
  const cleaned = clean(prompt, 80);
  const match = cleaned.match(/(?:about|on|for|ගැන|සඳහා)\s+(.+)/i);
  return clean(match?.[1] ?? cleaned, 80) || "KYVORIX Presentation";
}

function makeSlides(prompt: string): PresentationSlide[] {
  const title = titleFromPrompt(prompt);
  const requested = Number(prompt.match(/\b(\d{1,2})\s*(?:slides?|pages?|ස්ලයිඩ්)/i)?.[1] ?? 0);
  const count = Math.min(MAX_SLIDES, Math.max(5, requested || 8));
  const outline: Array<{ title: string; body: string[]; layout: PresentationLayout }> = [
    { title, body: ["A concise, decision-ready presentation created from your brief."], layout: "title" },
    { title: "Executive summary", body: ["The core opportunity", "The main challenge to solve", "The outcome this plan is designed to achieve"], layout: "two-column" },
    { title: "Current landscape", body: ["What is changing now", "Who is affected", "The signal that makes this timely"], layout: "kpi" },
    { title: "Key opportunities", body: ["Opportunity one", "Opportunity two", "Opportunity three"], layout: "two-column" },
    { title: "Recommended approach", body: ["Start with a focused pilot", "Measure the leading indicators", "Scale only after validation"], layout: "timeline" },
    { title: "Success metrics", body: ["Adoption", "Efficiency", "Quality and customer impact"], layout: "kpi" },
    { title: "Risks and mitigations", body: ["Make assumptions explicit", "Protect sensitive data", "Keep a rollback path"], layout: "two-column" },
    { title: "Next steps", body: ["Confirm scope", "Assign owners", "Set the first review checkpoint"], layout: "closing" },
  ];
  const slides = outline.slice(0, count).map((item, index) => ({ id: `slide-${index + 1}`, ...item, accent: ACCENTS[index % ACCENTS.length] }));
  while (slides.length < count) slides.splice(slides.length - 1, 0, { id: `slide-${slides.length}`, title: `Deep dive ${slides.length - 1}`, body: ["Supporting detail", "Evidence to collect", "Decision to make"], layout: "two-column", accent: ACCENTS[slides.length % ACCENTS.length] });
  return slides;
}

function addHeader(slide: pptxgen.Slide, title: string, accent: string, page: number) {
  slide.background = { color: "0B1020" };
  slide.addShape(pptxgen.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.13, fill: { color: accent }, line: { color: accent } });
  slide.addText("KYVORIX ARTIFACT STUDIO", { x: 0.62, y: 0.42, w: 5.2, h: 0.2, fontFace: "Aptos", fontSize: 8, bold: true, color: "94A3B8", charSpacing: 1.4, margin: 0 });
  slide.addText(String(page).padStart(2, "0"), { x: 12.15, y: 0.4, w: 0.55, h: 0.2, fontFace: "Aptos", fontSize: 8, color: "94A3B8", align: "right", margin: 0 });
  slide.addText(title, { x: 0.62, y: 1.05, w: 11.1, h: 0.65, fontFace: "Aptos Display", fontSize: 27, bold: true, color: "F8FAFC", margin: 0, breakLine: false, fit: "shrink" });
}

function addBulletBody(slide: pptxgen.Slide, body: string[], x: number, y: number, w: number) {
  body.forEach((line, index) => {
    slide.addShape(pptxgen.ShapeType.ellipse, { x, y: y + index * 0.62 + 0.08, w: 0.12, h: 0.12, fill: { color: "22D3EE" }, line: { color: "22D3EE" } });
    slide.addText(clean(line), { x: x + 0.28, y: y + index * 0.62, w, h: 0.35, fontFace: "Aptos", fontSize: 16, color: "CBD5E1", margin: 0, breakLine: false, fit: "shrink" });
  });
}

function renderSlide(pptx: pptxgen, item: PresentationSlide, index: number) {
  const slide = pptx.addSlide();
  if (item.layout === "title") {
    slide.background = { color: "0B1020" };
    slide.addShape(pptxgen.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "0B1020" }, line: { color: "0B1020" } });
    slide.addShape(pptxgen.ShapeType.arc, { x: 8.4, y: -0.4, w: 5.5, h: 5.5, line: { color: item.accent, transparency: 18, width: 3 } });
    slide.addText("KYVORIX", { x: 0.9, y: 1.12, w: 3, h: 0.3, fontFace: "Aptos", fontSize: 12, bold: true, color: item.accent, charSpacing: 2.5, margin: 0 });
    slide.addText(item.title, { x: 0.9, y: 2.0, w: 9.8, h: 1.5, fontFace: "Aptos Display", fontSize: 38, bold: true, color: "F8FAFC", margin: 0, fit: "shrink" });
    slide.addText(item.body[0], { x: 0.95, y: 4.2, w: 7.8, h: 0.6, fontFace: "Aptos", fontSize: 18, color: "94A3B8", margin: 0, fit: "shrink" });
    return;
  }
  addHeader(slide, item.title, item.accent, index + 1);
  if (item.layout === "kpi") {
    item.body.forEach((label, i) => {
      const x = 0.7 + i * 4.1;
      slide.addShape(pptxgen.ShapeType.roundRect, { x, y: 2.15, w: 3.5, h: 2.25, rectRadius: 0.08, fill: { color: "111A31", transparency: 4 }, line: { color: i === 0 ? item.accent : "25304D", width: 1 } });
      slide.addText(`${(i + 1) * 24}%`, { x: x + 0.28, y: 2.55, w: 2.7, h: 0.6, fontFace: "Aptos Display", fontSize: 30, bold: true, color: "F8FAFC", margin: 0 });
      slide.addText(clean(label), { x: x + 0.28, y: 3.45, w: 2.8, h: 0.5, fontFace: "Aptos", fontSize: 13, color: "94A3B8", margin: 0, fit: "shrink" });
    });
  } else if (item.layout === "timeline") {
    slide.addShape(pptxgen.ShapeType.line, { x: 1.2, y: 3.35, w: 10.7, h: 0, line: { color: "334155", width: 2 } });
    item.body.forEach((label, i) => {
      const x = 1.05 + i * 4.4;
      slide.addShape(pptxgen.ShapeType.ellipse, { x, y: 3.05, w: 0.6, h: 0.6, fill: { color: item.accent }, line: { color: item.accent } });
      slide.addText(String(i + 1), { x: x + 0.18, y: 3.2, w: 0.25, h: 0.2, fontSize: 12, bold: true, color: "0B1020", align: "center", margin: 0 });
      slide.addText(clean(label), { x: x - 0.1, y: 4.05, w: 2.5, h: 0.65, fontFace: "Aptos", fontSize: 14, color: "CBD5E1", margin: 0, fit: "shrink" });
    });
  } else {
    addBulletBody(slide, item.body, 1.0, 2.25, 9.4);
    slide.addShape(pptxgen.ShapeType.rect, { x: 10.85, y: 2.15, w: 1.25, h: 2.85, fill: { color: item.accent, transparency: 78 }, line: { color: item.accent, transparency: 100 } });
  }
}

export async function buildPresentationArtifact(prompt: string): Promise<PresentationDescriptor> {
  const slides = makeSlides(prompt);
  const title = titleFromPrompt(prompt);
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "KYVORIX AI";
  pptx.subject = "Structured presentation generated from a user brief";
  pptx.title = title;
  pptx.company = "KYVORIX";
  slides.forEach((slide, index) => renderSlide(pptx, slide, index));
  const buffer = await pptx.write({ outputType: "nodebuffer" }) as Buffer;
  return {
    id: `presentation_${Date.now().toString(36)}`,
    type: "presentation",
    title,
    filename: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kyvorix-presentation"}.pptx`,
    mimeType: MIME,
    sizeBytes: buffer.byteLength,
    createdAt: new Date().toISOString(),
    slides,
    highlights: ["Structured slide plan", "Professional dark theme", "Responsive preview", "Editable PPTX export", "Maximum 12 slides"],
    fileBase64: buffer.toString("base64"),
  };
}
