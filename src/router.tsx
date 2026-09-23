import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { BrandLoaderScreen } from "./components/site/BrandLoader";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 250,
    defaultPendingMinMs: 400,
    defaultPendingComponent: () => <BrandLoaderScreen />,
  });

  return router;
};
