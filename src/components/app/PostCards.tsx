/** بطاقة النشر الموحدة داخل المحادثة لكل الموظفين. */
import { memo, useState } from "react";
import { Send } from "lucide-react";

import { PublishPanel } from "@/components/app/PublishPanel";
import { Button } from "@/components/ui/button";

function PostCardsView({
  workspaceId,
  employeeId,
  taskId,
  request,
  body,
  channel,
}: {
  workspaceId: string;
  employeeId: string;
  taskId?: string | null;
  request?: string | null;
  body: string;
  channel?: string | undefined;
}) {
  const [opened, setOpened] = useState(false);
  if (!opened) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 rounded-full text-xs font-bold"
        onClick={() => setOpened(true)}
      >
        <Send className="size-3.5" /> انشر هذا المنشور
      </Button>
    );
  }
  return (
    <PublishPanel
      workspaceId={workspaceId}
      employeeId={employeeId}
      taskId={taskId ?? null}
      request={request ?? null}
      body={body}
      channel={channel ?? "instagram"}
      defaultOpen
    />
  );
}

/** لوحات النشر القديمة لا يعاد تركيبها أثناء كتابة الرد الحالي. */
export const PostCards = memo(PostCardsView);
