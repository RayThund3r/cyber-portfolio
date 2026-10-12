export type SystemAction = 
  | 'SCROLL_TO_PROJECTS' 
  | 'OPEN_CONTACT' 
  | 'START_DIAGNOSTIC' 
  | 'TOGGLE_THEME' 
  | 'NONE';

export interface EngineRequest {
  message: string;
  sessionState?: {
    lastIntent?: string;
    step?: number;
    collectedData?: Record<string, string>;
  };
}

export interface EngineResponse {
  reply: string;
  action: SystemAction;
  status: 'ONLINE';
  nextState?: {
    lastIntent?: string;
    step?: number;
    collectedData?: Record<string, string>;
  };
}