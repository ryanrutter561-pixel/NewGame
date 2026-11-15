import './ui/theme.css';
import type { App, Route } from './ui/app';
import { AIClient } from './ai/client';
import { loadProgress, saveProgress } from './game/save';
import { menuScreen } from './ui/screens/menu';
import { setupScreen } from './ui/screens/setup';
import { loadoutScreen } from './ui/screens/loadout';
import { gameScreen } from './ui/screens/game';
import { casesScreen } from './ui/screens/cases';
import { caseScreen } from './ui/screens/case';
import { clear } from './ui/dom';

const root = document.getElementById('app')!;
let cleanup: () => void = () => {};
let ai: AIClient | null = null;

const app: App = {
  root,
  progress: loadProgress(),
  save: () => saveProgress(app.progress),
  ai: () => (ai ??= new AIClient()),
  go(route: Route) {
    cleanup();
    clear(root);
    window.scrollTo(0, 0);
    switch (route.name) {
      case 'menu': cleanup = menuScreen(app, root, route); break;
      case 'setup': cleanup = setupScreen(app, root, route); break;
      case 'loadout': cleanup = loadoutScreen(app, root, route); break;
      case 'game': cleanup = gameScreen(app, root, route); break;
      case 'cases': cleanup = casesScreen(app, root, route); break;
      case 'case': cleanup = caseScreen(app, root, route); break;
    }
  },
};

app.go({ name: 'menu' });
