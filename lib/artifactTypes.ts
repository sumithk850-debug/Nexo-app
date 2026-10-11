export type ArtifactType = "excel";

export type ArtifactPreviewRow = Array<string | number | null>;

export interface ArtifactDescriptor {
  id: string;
  type: ArtifactType;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  sheets: string[];
  highlights: string[];
  preview: {
    columns: string[];
    rows: ArtifactPreviewRow[];
  };
  /** Base64 is used only for the current browser download; never contains secrets. */
  fileBase64: string;
}
