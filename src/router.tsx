import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { DeckDetailPage } from "./pages/DeckDetailPage";
import { DeckEditPage } from "./pages/DeckEditPage";
import { CardEditPage } from "./pages/CardEditPage";
import { CardNewPage } from "./pages/CardNewPage";
import { StudyPage } from "./pages/StudyPage";
import { CustomStudyPage } from "./pages/CustomStudyPage";
import { ImportQuizletPage } from "./pages/ImportQuizletPage";
import { StatsPage } from "./pages/StatsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";

// `base` in vite.config.ts produces correct asset paths;
// react-router needs the matching basename so links resolve under /fantastic-flashcards/.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <Layout />,
      errorElement: (
        <Layout>
          <NotFoundPage />
        </Layout>
      ),
      children: [
        { index: true, element: <HomePage /> },
        { path: "decks/:id", element: <DeckDetailPage /> },
        { path: "decks/:id/edit", element: <DeckEditPage /> },
        { path: "cards/:cardId/edit", element: <CardEditPage /> },
        { path: "cards/new", element: <CardNewPage /> },
        { path: "study", element: <StudyPage /> },
        { path: "study/custom", element: <CustomStudyPage /> },
        { path: "import/quizlet", element: <ImportQuizletPage /> },
        { path: "stats", element: <StatsPage /> },
        { path: "settings", element: <SettingsPage /> },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: basename || undefined },
);
