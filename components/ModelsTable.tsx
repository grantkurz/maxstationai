// @ts-nocheck - Placeholder component for missing ModelsTable
"use client";

import { modelRowWithSamples } from "@/types/utils";

interface ModelsTableProps {
  models: modelRowWithSamples[];
}

export default function ModelsTable({ models }: ModelsTableProps) {
  return (
    <div className="rounded-md border">
      <div className="p-4">
        <p className="text-sm text-muted-foreground">
          Models table component placeholder. {models.length} model(s) available.
        </p>
      </div>
    </div>
  );
}
