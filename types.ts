
export interface MemeCaption {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  strokeColor: string;
  strokeWidth: number;
  textAlign: 'left' | 'center' | 'right';
  isUppercase: boolean;
}

export interface Template {
  id: string;
  url: string;
  name: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  GENERATING_PROMPTS = 'GENERATING_PROMPTS',
  EDITING_IMAGE = 'EDITING_IMAGE',
  GENERATING_IMAGE = 'GENERATING_IMAGE',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
}

export interface AnalysisResult {
  description: string;
  mood: string;
  keywords: string[];
}
