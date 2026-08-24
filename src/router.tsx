import { installRandomUuidPolyfill } from "@/lib/random-uuid";
import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  installRandomUuidPolyfill();
  return createRouter({ routeTree, defaultErrorComponent: AppErrorComponent });
}
