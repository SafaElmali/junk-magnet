import { initCrazyGames } from "./crazygames";

// CrazyGames build entry: cloud saves must replace browser storage before any
// game module reads it, so the game starts only after the SDK settles.
void initCrazyGames().finally(() => import("./main"));
