export type PresentationLayout = "title" | "two-column" | "kpi" | "timeline" | "closing";

export interface PresentationSlide {
  id: string;
  title: string;
  body: string[];
  layout: PresentationLayout;
  accent: string;
}

export interface PresentationDescriptor {
  id: string;
  type: "presentation";
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  slides: PresentationSlide[];
  highlights: string[];
  fileBase64: string;
}
