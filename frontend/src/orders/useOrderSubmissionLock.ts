import { useRef, useState } from "react";

/** All manual entry controls share this lock, including before React renders. */
export function useOrderSubmissionLock() {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  return {
    pending,
    acquire: () => {
      if (locked.current) return false;
      locked.current = true;
      setPending(true);
      return true;
    },
    release: () => {
      locked.current = false;
      setPending(false);
    },
  };
}
