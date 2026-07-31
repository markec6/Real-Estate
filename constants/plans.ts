export const PLAN_CREDITS = {
  STARTER: 200,
  PRO: 600,
  TEAM: 2000,
} as const

export type PlanTier = keyof typeof PLAN_CREDITS
