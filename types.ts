
export interface MemeCaption {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  strokeColor: string;
  strokeWidth: number;
}

export interface Template {
  id: string;
  url: string;
  name: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  GENERATING_CAPTIONS = 'GENERATING_CAPTIONS',
  EDITING_IMAGE = 'EDITING_IMAGE',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
}

export interface AnalysisResult {
  description: string;
  mood: string;
  keywords: string[];
}
