export function ScopeMark({ size = 28 }: { size?: number }) {
  return (
    <span className="scope-mark" style={{ width: size, height: size }} aria-hidden="true">
      <img className="scope-mark-dark" src="/brand/scope-logo-on-dark.png" alt="" />
      <img className="scope-mark-light" src="/brand/scope-logo-on-light.png" alt="" />
    </span>
  );
}
