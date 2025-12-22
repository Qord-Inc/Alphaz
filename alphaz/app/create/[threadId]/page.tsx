"use client";

import { use } from "react";
import Create from "../page";

export default function CreateWithThread({ params }: { params: Promise<{ threadId: string }> }) {
  const resolvedParams = use(params);
  return <Create threadId={resolvedParams.threadId} />;
}
