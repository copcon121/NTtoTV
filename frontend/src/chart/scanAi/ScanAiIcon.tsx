export function ScanAiSparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "inline-block", verticalAlign: "middle", marginRight: "5px", flexShrink: 0 }}
      aria-hidden="true"
    >
      {/* Large golden sparkle */}
      <path
        d="M10 2C10 6.418 6.418 10 2 10C6.418 10 10 13.582 10 18C10 13.582 13.582 10 18 10C13.582 10 10 6.418 10 2Z"
        fill="#facc15"
      />
      {/* Small cyan sparkle */}
      <path
        d="M18 13C18 15.209 16.209 17 14 17C16.209 17 18 18.791 18 21C18 18.791 19.791 17 22 17C19.791 17 18 15.209 18 13Z"
        fill="#38bdf8"
      />
      {/* Pink accent spark */}
      <circle cx="19.5" cy="5.5" r="1.5" fill="#fb7185" />
    </svg>
  );
}
