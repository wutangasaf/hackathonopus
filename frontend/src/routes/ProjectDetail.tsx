import { useParams } from "react-router-dom";

import { Container } from "@/components/layout/Container";
import { Nav } from "@/components/layout/Nav";
import { Eyebrow } from "@/components/blocks/Eyebrow";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <Nav />
      <Container className="py-20">
        <Eyebrow>Project · {id}</Eyebrow>
        <h1 className="mt-6 text-5xl font-extrabold tracking-tight2 lg:text-6xl">
          Project detail
        </h1>
        <p className="mt-4 max-w-xl font-mono text-xs uppercase tracking-mono text-fg-muted">
          Tabs for Plans · Finance · Photos · Reports land in turn 2.
        </p>
      </Container>
    </>
  );
}
