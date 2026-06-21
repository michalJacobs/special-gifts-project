export default function Spinner({ className = "h-4 w-4 border-white" }) {
  return <span className={`animate-spin rounded-full border-2 border-t-transparent ${className}`} />;
}
