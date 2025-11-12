import { useState, useEffect } from 'react';
import type { ActorType, ActorConfig } from '../types/actors';
import { ACTOR_DEFINITIONS } from '../types/actors';

export function useActorImages(actorCounts: Record<ActorType, number>) {
  const [loadedActors, setLoadedActors] = useState<ActorConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActors = async () => {
      setLoading(true);
      const actorsToLoad: ActorConfig[] = [];

      for (const [actorType, count] of Object.entries(actorCounts)) {
        if (count > 0) {
          const definition = ACTOR_DEFINITIONS[actorType as ActorType];
          if (definition) {
            const actor: ActorConfig = {
              ...definition,
              count,
              image: null
            };

            // Cargar imagen
            try {
              const img = new Image();
              await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject();
                img.src = definition.imagePath;
              });
              actor.image = img;
            } catch (error) {
              console.warn(`No se pudo cargar la imagen para ${actorType}:`, error);
            }

            actorsToLoad.push(actor);
          }
        }
      }

      setLoadedActors(actorsToLoad);
      setLoading(false);
    };

    loadActors();
  }, [actorCounts]);

  return { actors: loadedActors, loading };
}