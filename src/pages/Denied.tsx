import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/seo/PageMeta";
import { LogOut, XCircle } from "lucide-react";

const Denied = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <PageMeta title="Access denied · Ether" description="This sign-in does not have access to Ether." />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-20 h-20 mx-auto mb-8 rounded-full bg-muted flex items-center justify-center"
        >
          <XCircle className="w-10 h-10 text-muted-foreground" />
        </motion.div>

        <div className="space-y-6">
          <h1 className="font-display text-2xl md:text-3xl text-foreground">
            This account was not approved.
          </h1>
          <p className="text-muted-foreground">
            Ether is still open. This sign-in does not have access.
          </p>

          <div className="h-px bg-border my-8" />

          {user ? (
            <Button onClick={handleSignOut} variant="outline" className="h-12 px-8 gap-2">
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
          ) : (
            <Button asChild variant="outline" className="h-12 px-8">
              <Link to="/">Go home</Link>
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Denied;
