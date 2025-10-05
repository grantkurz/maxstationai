"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Database } from "@/types/supabase";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";

export const OtpInput = ({
  email,
  onBack,
  onResend,
}: {
  email: string;
  onBack: () => void;
  onResend?: () => Promise<void>;
}) => {
  const supabase = createClientComponentClient<Database>();
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { toast } = useToast();

  const MAX_ATTEMPTS = 5;
  const RESEND_COOLDOWN = 60; // 60 seconds

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setIsResending(true);

    try {
      if (onResend) {
        await onResend();
      } else {
        // Default resend using Supabase
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin + "/auth/callback",
          },
        });

        if (error) {
          throw error;
        }
      }

      toast({
        title: "Code sent",
        description: "A new code has been sent to your email.",
      });

      // Reset OTP input and attempts
      setOtp("");
      setOtpAttempts(0);
      setResendCooldown(RESEND_COOLDOWN);
    } catch (error) {
      toast({
        title: "Failed to resend",
        description: "Please try again or go back.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const verifyOtp = async () => {
    if (otpAttempts >= MAX_ATTEMPTS) {
      toast({
        title: "Too many attempts",
        description: "Please go back and request a new code.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (error) {
      setOtpAttempts((prev) => prev + 1);
      toast({
        title: "Invalid code",
        description: "Please check your code and try again.",
        variant: "destructive",
      });
      setIsVerifying(false);
      return;
    }

    // Success - verify session is established before redirecting
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      toast({
        title: "Authentication error",
        description: "Session not established. Please try again.",
        variant: "destructive",
      });
      setIsVerifying(false);
      return;
    }

    toast({
      title: "Success!",
      description: "You've been logged in.",
    });

    // Use window.location for hard navigation to ensure cookies are set
    window.location.href = "/";
  };

  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col gap-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 p-4 rounded-xl max-w-sm w-full">
        <h1 className="text-xl">Check your email</h1>
        <div className="flex flex-col gap-2">
          <p className="text-sm">We sent a 6-digit code to</p>
          <p className="text-sm font-semibold">{email}</p>
        </div>

        <Input
          type="text"
          placeholder="000000"
          value={otp}
          onChange={(e) =>
            setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          maxLength={6}
          className="text-center text-2xl tracking-widest font-mono"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]*"
        />

        {otpAttempts > 0 && otpAttempts < MAX_ATTEMPTS && (
          <p className="text-xs text-amber-600">
            {MAX_ATTEMPTS - otpAttempts} attempts remaining
          </p>
        )}

        <Button
          onClick={verifyOtp}
          disabled={otp.length !== 6 || isVerifying}
          isLoading={isVerifying}
        >
          Verify Code
        </Button>

        <div className="flex gap-2">
          <Button
            onClick={handleResendCode}
            disabled={resendCooldown > 0 || isResending}
            isLoading={isResending}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            {resendCooldown > 0
              ? `Resend code (${resendCooldown}s)`
              : "Resend code"}
          </Button>

          <Button onClick={onBack} variant="secondary" size="sm">
            <ArrowLeft size={14} />
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
};
