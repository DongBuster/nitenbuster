import { useState } from 'react';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { Game3DScreen } from './screens/Game3DScreen';
import { Showcase3D } from './screens/Showcase3D';
import { OnlineLobbyScreen } from './screens/OnlineLobbyScreen';
import { OnlineGame3DScreen } from './screens/OnlineGame3DScreen';
import { useOnlineRoom } from './online/useOnlineRoom';

type AppScreen = 'menu' | 'game' | 'online' | 'studio3d';

function OnlineModeContainer({ onBackToMenu }: { onBackToMenu: () => void }) {
  const room = useOnlineRoom();

  if (room.phase === 'playing' && room.gameState) {
    return <OnlineGame3DScreen room={room} onBackToMenu={onBackToMenu} />;
  }

  return <OnlineLobbyScreen room={room} onBackToMenu={onBackToMenu} />;
}

export function App() {
  const [screen, setScreen] = useState<AppScreen>('menu');

  return (
    <div className="relative min-h-screen">
      {/* Compact top-right navigation switcher on 3D Studio only */}
      {screen === 'studio3d' && (
        <nav
          aria-label="Điều hướng ứng dụng"
          className="fixed right-4 top-4 z-50 inline-flex items-center gap-1 rounded-full border border-amber-200/30 bg-[#2C1B11]/88 p-1 shadow-xl backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => setScreen('menu')}
            aria-pressed={false}
            className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-extrabold text-amber-100/85 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            🏠 Menu
          </button>
          <button
            type="button"
            onClick={() => setScreen('studio3d')}
            aria-pressed={true}
            className="cursor-pointer rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-3 py-1.5 text-xs font-extrabold text-[#2C1B11] shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            ✨ 3D Studio
          </button>
        </nav>
      )}

      {screen === 'menu' && (
        <MainMenuScreen
          onStartGame={() => setScreen('game')}
          onOpenOnline={() => setScreen('online')}
          onOpenStudio3D={() => setScreen('studio3d')}
        />
      )}
      {screen === 'game' && (
        <Game3DScreen onBackToMenu={() => setScreen('menu')} />
      )}
      {screen === 'online' && (
        <OnlineModeContainer onBackToMenu={() => setScreen('menu')} />
      )}
      {screen === 'studio3d' && <Showcase3D />}
    </div>
  );
}

export default App;
