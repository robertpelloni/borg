"use client";

import { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';

interface ActivityInputProps {
  onSendMessage: (message: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function ActivityInput({ onSendMessage, disabled, placeholder = "Send a message..." }: ActivityInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!message.trim() || disabled) return;

    const msgToSend = message;
    setMessage(""); // Clear immediately for better UX
    
    // Reset height
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }

    await onSendMessage(msgToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-white/[0.08] bg-zinc-950/95 p-3"
    >
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholder}
          className="min-h-[56px] resize-none text-[11px] bg-black border-white/[0.08] text-white placeholder:text-white/30 focus:border-purple-500/50"
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send message"
          disabled={!message.trim() || disabled}
          className="h-9 w-9"
        >
          {disabled ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </form>
  );
}
