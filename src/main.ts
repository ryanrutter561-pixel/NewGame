import './ui/theme.css';
import type { App, Route } from './ui/app';
import { AIClient } from './ai/client';
import { loadDevFlag, loadProgress, saveDevFlag, saveProgress } from './game/save';
import { menuScreen } from './ui/screens/menu';
import { setupScreen } from './ui/screens/setup';
import { loadoutScreen } from './ui/screens/loadout';
import { gameScreen } from './ui/screens/game';
import { casesScreen } from './ui/screens/cases';
import { caseScreen } from './ui/screens/case';
import { clear } from './ui/dom';
import { sound } from './audio/sound';

const root = document.getElementById('app')!;
let cleanup: () => void = () => {};
let ai: AIClient | null = null;

const startDev = loadDevFlag();

const app: App = {
  root,
  dev: startDev,
  progress: loadProgress(startDev),
  save: () => saveProgress(app.progress, app.dev),
  setDev(on: boolean) {
    app.save();
    app.dev = on;
    saveDevFlag(on);
    app.progress = loadProgress(on);
    sound.enabled = app.progress.sound;
    app.save();
  },
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

sound.enabled = app.progress.sound;
// Browsers only allow audio after a user gesture — wake the audio engine on the first tap/click.
window.addEventListener('pointerdown', () => sound.unlock(), { once: true });

app.go({ name: 'menu' });
