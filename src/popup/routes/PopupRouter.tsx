import { useState } from 'react';
import { Header } from '../components/Header';
import { HomeRoute } from './HomeRoute';
import { ProjectsRoute } from './ProjectsRoute';
import type { PopupRoute } from './routes';

export function PopupRouter() {
  const [route, setRoute] = useState<PopupRoute>('home');

  return (
    <main className="popup-shell">
      <Header activeRoute={route} onNavigate={setRoute} />
      {route === 'home' ? <HomeRoute /> : <ProjectsRoute />}
    </main>
  );
}
