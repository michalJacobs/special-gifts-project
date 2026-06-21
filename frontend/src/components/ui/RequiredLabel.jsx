export default function RequiredLabel({ children }) {
  return (
    <span className="mb-1 block text-sm font-medium">
      {children} <span className="text-red-600">*</span>
    </span>
  );
}
