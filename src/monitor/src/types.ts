export interface TvProduct {
  id: string;
  name: string;
  model?: string;
  price?: string;
  url: string;
  description: string;
}
export interface MonitorState {
  notifiedProductIds: string[];
  updatedAt: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  message: string;
  product: TvProduct;
}
