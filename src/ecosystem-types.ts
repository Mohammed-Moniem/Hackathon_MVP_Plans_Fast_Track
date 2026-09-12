import type { SearchResult } from './providers.js';
export type MentorTool = 'search' | 'vision' | 'image';
export interface CustomMentor { id: string; name: string; domain: string; description: string; instructions: string; goals: string[]; tools: MentorTool[]; voice: 'health' | 'career'; color: string; createdAt: string; }
export interface SharedProfile { location: string; currency: 'AED'; monthlyIncome: number; essentialExpenses: number; savingsTarget: number; wellnessBudget: number; preferences: string; dietaryPreferences: string; goals: string; }
export interface VisionAnalysis { summary: string; merchant: string | null; total: number | null; currency: string | null; items: Array<{name: string; amount: number | null}>; uncertainties: string[]; }
export interface CouncilMessage { id: string; mentorId: string; mentorName: string; to: string; phase: 'proposal' | 'review' | 'resolution' | 'tool'; text: string; at: string; imageUrl?: string; }
export interface CouncilDecision { title: string; summary: string; conflicts: Array<{topic: string; positions: string; resolution: string}>; alternatives: Array<{title: string; estimatedCost: number | null; cadence: 'one-off' | 'monthly' | 'unknown'; rationale: string; sourceIds: string[]}>; recommendation: string; cautions: string[]; }
export interface CouncilRun { id: string; prompt: string; mentorIds: string[]; status: 'running' | 'pending' | 'approved' | 'rejected' | 'failed'; messages: CouncilMessage[]; sources: SearchResult[]; decision: CouncilDecision | null; error?: string; createdAt: string; approvedAt?: string; profileRevision: number; attachment?: VisionAnalysis; }
export interface EcosystemState { mentors: CustomMentor[]; profile: SharedProfile; profileRevision: number; run: CouncilRun | null; memory: string[]; capabilities: {agents: boolean; search: boolean; vision: boolean; image: boolean}; }
export interface CouncilInput { prompt: string; mentors: CustomMentor[]; profile: SharedProfile; memory: string[]; attachment?: VisionAnalysis; }
export interface CouncilHooks { message: (message: CouncilMessage) => void; sources: (sources: SearchResult[]) => void; }
export interface MealImage { url: string; prompt: string; caption: string; generatedAt: string; }
