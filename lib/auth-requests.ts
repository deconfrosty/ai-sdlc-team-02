import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { z } from "zod";
import { isValidUsername } from "@/lib/auth-utils";

export const usernameSchema = z
  .string()
  .trim()
  .min(1, "Username is required")
  .max(64, "Username must be 64 characters or fewer")
  .refine(isValidUsername, "Username contains unsupported characters");

const responseBaseSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal("public-key"),
  clientExtensionResults: z.record(z.string(), z.unknown()),
  authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
});

export const registrationResponseSchema = responseBaseSchema
  .extend({
    response: z
      .object({
        clientDataJSON: z.string().min(1),
        attestationObject: z.string().min(1),
        authenticatorData: z.string().optional(),
        transports: z.array(z.string()).optional(),
        publicKeyAlgorithm: z.number().optional(),
        publicKey: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough()
  .transform((response) => response as RegistrationResponseJSON);

export const authenticationResponseSchema = responseBaseSchema
  .extend({
    response: z
      .object({
        clientDataJSON: z.string().min(1),
        authenticatorData: z.string().min(1),
        signature: z.string().min(1),
        userHandle: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough()
  .transform((response) => response as AuthenticationResponseJSON);

export const registrationVerifySchema = z.object({
  username: usernameSchema,
  challengeId: z.string().uuid(),
  response: registrationResponseSchema,
});

export const authenticationVerifySchema = z.object({
  username: usernameSchema,
  challengeId: z.string().uuid(),
  response: authenticationResponseSchema,
});
