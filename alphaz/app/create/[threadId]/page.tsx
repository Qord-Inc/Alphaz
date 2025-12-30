"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import Create from "../page";

export default function CreateWithThread({ params }: { params: Promise<{ threadId: string }> }) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  
  // Get optional draft selection params from URL
  const initialDraftId = searchParams.get('draftId') || undefined;
  const initialVersionId = searchParams.get('versionId') || undefined;
  
  return (
    <Create 
      threadId={resolvedParams.threadId}
      initialDraftId={initialDraftId}
      initialVersionId={initialVersionId}
    />
  );
}
