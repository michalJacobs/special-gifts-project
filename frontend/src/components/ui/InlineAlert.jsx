const styles = {
  error: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800"
};

export default function InlineAlert({ children, className = "", tone = "error" }) {
  return <div className={`rounded-md border px-4 py-3 text-sm ${styles[tone]} ${className}`}>{children}</div>;
}
