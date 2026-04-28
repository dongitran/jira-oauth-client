import { z } from "zod";

const nonEmptyStringSchema = z.string().min(1);

export const atlassianTokenResponseSchema = z.object({
  access_token: nonEmptyStringSchema,
  refresh_token: nonEmptyStringSchema,
  expires_in: z.number().int().positive(),
  scope: z.string(),
  token_type: nonEmptyStringSchema.default("Bearer"),
});

export const atlassianResourceSchema = z.object({
  id: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  url: z.string().optional(),
  scopes: z.array(z.string()).default([]),
  avatarUrl: z.string().optional(),
});

export const atlassianResourcesSchema = z.array(atlassianResourceSchema);

export const jiraTokensSchema = z.object({
  accessToken: nonEmptyStringSchema,
  refreshToken: nonEmptyStringSchema,
  expiresIn: z.number().int().positive(),
  scope: z.string(),
  tokenType: nonEmptyStringSchema,
  cloudId: nonEmptyStringSchema,
  cloudName: nonEmptyStringSchema,
  issuedAt: z.number().int().nonnegative(),
});
