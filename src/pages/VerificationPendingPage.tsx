import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VerificationPendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="h-7 w-7 text-primary" />
          </div>
        </div>
        <h1 className="text-xl font-semibold text-foreground">Check your email</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We've sent a verification link to your email address. Please click the link to verify your account before signing in.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">Back to Sign In</Link>
        </Button>
      </div>
    </div>
  );
}
