import { useState } from 'react';
import { Career } from './screens/Career';
import { Home } from './screens/Home';
import { Sandbox } from './screens/Sandbox';
import { TeamPicker } from './screens/TeamPicker';
import { clearSave, loadSave, SAVE_VERSION, writeSave, type CareerSave } from './util';

type Screen = { name: 'home' } | { name: 'pick' } | { name: 'career'; save: CareerSave } | { name: 'sandbox' };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const home = () => setScreen({ name: 'home' });

  switch (screen.name) {
    case 'home':
      return (
        <Home
          save={loadSave()}
          onContinue={(save) => setScreen({ name: 'career', save })}
          onNew={() => setScreen({ name: 'pick' })}
          onSandbox={() => setScreen({ name: 'sandbox' })}
        />
      );
    case 'pick':
      return (
        <TeamPicker
          onBack={home}
          onPick={(team) => {
            const save: CareerSave = { version: SAVE_VERSION, team, seed: Math.floor(Math.random() * 1e9), answers: [], updatedAt: Date.now() };
            clearSave();
            writeSave(save);
            setScreen({ name: 'career', save });
          }}
        />
      );
    case 'career':
      return <Career save={screen.save} onExit={home} />;
    case 'sandbox':
      return <Sandbox onBack={home} />;
  }
}
