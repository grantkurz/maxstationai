"use client";

import { useState } from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { GenerateAnnouncementDialog } from "./GenerateAnnouncementDialog";
import { Database } from "@/types/supabase";

type Speaker = Database["public"]["Tables"]["speakers"]["Row"];
type Event = Database["public"]["Tables"]["events"]["Row"];

interface GenerateAnnouncementButtonProps extends Omit<ButtonProps, "onClick"> {
  speaker: Speaker;
  event: Event;
}

export function GenerateAnnouncementButton({
  speaker,
  event,
  variant = "default",
  size = "sm",
  className,
  ...props
}: GenerateAnnouncementButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setDialogOpen(true)}
        {...props}
      >
        <Sparkles className="mr-2 h-4 w-4" />
        Announce
      </Button>

      <GenerateAnnouncementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        speaker={speaker}
        event={event}
      />
    </>
  );
}
