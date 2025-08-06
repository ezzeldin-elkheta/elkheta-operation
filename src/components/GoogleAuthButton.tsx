import { Button } from "./ui/button";
import { useGoogleAuth } from "../hooks/useGoogleAuth";

export function GoogleAuthButton() {
  const { isSignedIn, signIn, signOut } = useGoogleAuth();

  return (
    <Button 
      onClick={isSignedIn ? signOut : signIn}
      className="flex items-center gap-2"
    >
      {isSignedIn ? "Sign Out" : "Sign in with Google"}
    </Button>
  );
}