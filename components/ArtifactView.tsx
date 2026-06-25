export function ArtifactView({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="workspace-artifact">
      <h3 className="workspace-artifact-title">{title}</h3>
      <div className="workspace-artifact-body">{children}</div>
    </section>
  );
}
