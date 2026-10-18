import type { PopupRoute } from '../routes/routes';

type HeaderProps = {
  activeRoute: PopupRoute;
  onNavigate: (route: PopupRoute) => void;
};

export function Header({ activeRoute, onNavigate }: HeaderProps) {
  return (
    <header className="header">
      <div>
        <p className="eyebrow">Sales Nav</p>
        <h1>Search Memory</h1>
      </div>
      <nav className="nav" aria-label="Popup routes">
        <button className={activeRoute === 'home' ? 'active' : ''} onClick={() => onNavigate('home')}>
          Search
        </button>
        <button className={activeRoute === 'projects' ? 'active' : ''} onClick={() => onNavigate('projects')}>
          Projects
        </button>
      </nav>
    </header>
  );
}
