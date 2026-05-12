"use client";

import { useParams } from "next/navigation";
import LeadDetailContent from "../LeadDetailContent";

export default function LeadDetailPage() {
  const params = useParams();
  const rowIndex = parseInt(String(params.rowIndex), 10);
  if (isNaN(rowIndex) || rowIndex < 2)
    return <div className="text-amber-600">Invalid lead</div>;

  return (
    <LeadDetailContent rowIndex={rowIndex} />
  );
}
