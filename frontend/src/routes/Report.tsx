import { useParams } from "react-router-dom";

import { Container } from "@/components/layout/Container";
import { Nav } from "@/components/layout/Nav";
import { Eyebrow } from "@/components/blocks/Eyebrow";

export default function Report() {
  const { reportId } = useParams<{ id: string; reportId: string }>();
  return (
    <>
      <Nav />
      <Container className="py-20">
        <Eyebrow>Report · {reportId}</Eyebrow>
        <h1 className="mt-6 text-5xl font-extrabold tracking-tight2 lg:text-6xl">
          Gap Report
        </h1>
        <p className="mt-4 max-w-xl font-mono text-xs uppercase tracking-mono text-fg-muted">
          The real screen lands in turn 4, pending Agent 7.
        </p>
      </Container>
    </>
  );
}
