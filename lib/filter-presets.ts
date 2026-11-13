import { z } from "zod";

export const filterPresetsKey = "todo-app:filter-presets";
export const filterPresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  filters: z.object({
    search: z.string(),
    priority: z.enum(["", "high", "medium", "low"]),
    tagId: z.string().regex(/^\d*$/),
    completion: z.enum(["", "pending", "completed"]),
    dueDateFrom: z.string().regex(/^(?:\d{4}-\d{2}-\d{2})?$/),
    dueDateTo: z.string().regex(/^(?:\d{4}-\d{2}-\d{2})?$/),
  }),
  createdAt: z.string(),
});
export const filterPresetsSchema = z.array(filterPresetSchema);
export type FilterPreset = z.infer<typeof filterPresetSchema>;
