import { useParams } from "react-router-dom";

import { Container } from "@/components/layout/Container";
import { Nav } from "@/components/layout/Nav";
import { Eyebrow } from "@/components/blocks/Eyebrow";

export default function Runs() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <Nav />
      <Container className="py-20">
        <Eyebrow>Runs · Project {id}</Eyebrow>
        <h1 className="mt-6 text-5xl font-extrabold tracking-tight2 lg:text-6xl">
          Agent runs
        </h1>
        <p className="mt-4 max-w-xl font-mono text-xs uppercase tracking-mono text-fg-muted">
          Live AgentRun stream lands in turn 3.
        </p>
      </Container>
    </>
  );
}
