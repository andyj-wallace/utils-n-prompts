import { useState } from "react";
import { FONTS } from "./theme.js";
import { loadEvents, saveEvents, clearEvents } from "./persistence/storage.js";
import Tracker from "./Tracker.jsx";
import Onboarding from "./onboarding/Onboarding.jsx";

export default function App() {
  const [events, setEvents] = useState(() => loadEvents());
  const [saveVersion, setSaveVersion] = useState(0);

  const handleOnboardingComplete = (seedEvents) => {
    saveEvents(seedEvents);
    setEvents(seedEvents);
    setSaveVersion((v) => v + 1);
  };

  const handleReset = () => {
    clearEvents();
    setEvents(null);
    setSaveVersion((v) => v + 1);
  };

  return (
    <>
      <style>{FONTS}</style>
      {events === null
        ? <Onboarding key={saveVersion} onComplete={handleOnboardingComplete} />
        : <Tracker key={saveVersion} initialEvents={events} onReset={handleReset} />}
    </>
  );
}
