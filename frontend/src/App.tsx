import { Route, Routes } from "react-router-dom";

import Landing from "@/routes/Landing";
import Projects from "@/routes/Projects";
import ProjectDetail from "@/routes/ProjectDetail";
import Report from "@/routes/Report";
import Runs from "@/routes/Runs";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/projects/:id" element={<ProjectDetail />} />
      <Route path="/projects/:id/reports/:reportId" element={<Report />} />
      <Route path="/projects/:id/runs" element={<Runs />} />
    </Routes>
  );
}
