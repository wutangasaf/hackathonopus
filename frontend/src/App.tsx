import { Route, Routes } from "react-router-dom";

import ContractorPortal from "@/routes/contractor/ContractorPortal";
import DrawRequest from "@/routes/contractor/DrawRequest";
import GanttBuilder from "@/routes/gantt/GanttBuilder";
import InspectorCapture from "@/routes/inspector/InspectorCapture";
import InspectorPortal from "@/routes/inspector/InspectorPortal";
import Landing from "@/routes/Landing";
import PhotoDetail from "@/routes/PhotoDetail";
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
      <Route path="/projects/:id/gantt" element={<GanttBuilder />} />
      <Route
        path="/projects/:id/photos/:photoId"
        element={<PhotoDetail />}
      />
      <Route path="/projects/:id/reports/:reportId" element={<Report />} />
      <Route path="/projects/:id/runs" element={<Runs />} />
      <Route path="/contractor" element={<ContractorPortal />} />
      <Route
        path="/contractor/draw-request/:projectId"
        element={<DrawRequest />}
      />
      <Route path="/inspector" element={<InspectorPortal />} />
      <Route path="/inspector/:projectId" element={<InspectorCapture />} />
    </Routes>
  );
}
