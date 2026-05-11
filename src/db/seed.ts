import { db } from "./schema";
import { createDeck } from "./decks";
import { createCard } from "./cards";

// Dev-only seed: 2 decks x 5 cards each. Guarded by an existing-deck check so
// repeated dev reloads don't multiply data.
export async function seedDevData(): Promise<void> {
  const existing = await db.decks.count();
  if (existing > 0) return;

  const french = await createDeck({
    name: "French vocabulary",
    description: "Everyday French words and phrases",
    subject: "French",
    colour: "#3D7AB8",
    pronunciationLanguage: "fr-FR",
  });

  const physics = await createDeck({
    name: "Physics: mechanics",
    description: "Year 11 mechanics foundations",
    subject: "Physics",
    colour: "#1E3A5F",
  });

  const frenchPairs: [string, string][] = [
    ["bonjour", "hello"],
    ["merci", "thank you"],
    ["chat", "cat"],
    ["livre", "book"],
    ["maison", "house"],
  ];
  for (const [front, back] of frenchPairs) {
    await createCard({
      deckId: french.id,
      type: "basic",
      tags: ["vocab", "easy"],
      content: {
        type: "basic",
        front: { text: front, language: "fr-FR" },
        back: { text: back },
        autoReverse: false,
      },
    });
  }

  const physicsCards: [string, string][] = [
    [
      "Newton's first law",
      "An object in motion stays in motion unless acted on by a net force.",
    ],
    ["Newton's second law", "F = ma"],
    [
      "Newton's third law",
      "Every action has an equal and opposite reaction.",
    ],
    ["Define momentum", "p = mv"],
    ["Define kinetic energy", "KE = 0.5 * m * v^2"],
  ];
  for (const [front, back] of physicsCards) {
    await createCard({
      deckId: physics.id,
      type: "basic",
      tags: ["mechanics"],
      content: {
        type: "basic",
        front: { text: front },
        back: { text: back },
        autoReverse: false,
      },
    });
  }
}

// Expose for manual reinvocation from devtools.
declare global {
  interface Window {
    __seedDev?: () => Promise<void>;
    __wipeDev?: () => Promise<void>;
  }
}

if (import.meta.env.DEV) {
  window.__seedDev = seedDevData;
  window.__wipeDev = async () => {
    await db.delete();
    location.reload();
  };
}
